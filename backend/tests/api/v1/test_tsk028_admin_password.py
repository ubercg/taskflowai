"""Admin reset/assign password (TSK-028 / REQ-010 slice B) — SQLite unit tier."""
from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import (
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from app.db.database import get_db
from app.main import app
from app.models.models import User, UserRole


@contextmanager
def _client(session, *, as_user: User | None = None):
    def _db():
        yield session

    app.dependency_overrides[get_db] = _db
    if as_user is not None:
        app.dependency_overrides[get_current_user] = lambda: as_user
        app.dependency_overrides[require_admin] = lambda: as_user
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _seed_admin_and_target(session):
    admin = User(
        name="Admin",
        email="admin@test.com",
        password_hash=hash_password("admin-pass"),
        role=UserRole.admin,
        is_active=True,
        must_change_password=False,
    )
    target = User(
        name="Dev",
        email="dev@test.com",
        password_hash=hash_password("old-secret"),
        role=UserRole.developer,
        is_active=True,
        must_change_password=False,
    )
    session.add_all([admin, target])
    session.commit()
    session.refresh(admin)
    session.refresh(target)
    return admin, target


def test_admin_reset_sets_default_and_must_change(sqlite_session):
    admin, target = _seed_admin_and_target(sqlite_session)

    with _client(sqlite_session, as_user=admin) as client:
        res = client.post(
            f"/api/v1/admin/users/{target.id}/password",
            json={"mode": "reset"},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["must_change_password"] is True
    assert body["password_reset"] is True
    assert body["mode"] == "reset"
    assert "password" not in body
    assert "password_hash" not in body

    sqlite_session.refresh(target)
    assert target.must_change_password is True
    assert verify_password(settings.DEFAULT_NEW_USER_PASSWORD, target.password_hash)
    assert not verify_password("old-secret", target.password_hash)


def test_admin_assign_sets_temp_and_must_change(sqlite_session):
    admin, target = _seed_admin_and_target(sqlite_session)

    with _client(sqlite_session, as_user=admin) as client:
        res = client.post(
            f"/api/v1/admin/users/{target.id}/password",
            json={"mode": "assign", "new_password": "temp-assigned-99"},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["must_change_password"] is True
    assert body["mode"] == "assign"
    assert "temp-assigned-99" not in res.text
    assert "password_hash" not in body

    sqlite_session.refresh(target)
    assert target.must_change_password is True
    assert verify_password("temp-assigned-99", target.password_hash)


def test_assign_requires_password(sqlite_session):
    admin, target = _seed_admin_and_target(sqlite_session)

    with _client(sqlite_session, as_user=admin) as client:
        missing = client.post(
            f"/api/v1/admin/users/{target.id}/password",
            json={"mode": "assign"},
        )
        blank = client.post(
            f"/api/v1/admin/users/{target.id}/password",
            json={"mode": "assign", "new_password": "   "},
        )
    assert missing.status_code == 422, missing.text
    assert missing.json()["detail"]["code"] == "USER_PASSWORD_REQUIRED"
    assert blank.status_code == 422, blank.text
    assert blank.json()["detail"]["code"] == "USER_PASSWORD_REQUIRED"


def test_reset_rejects_new_password(sqlite_session):
    admin, target = _seed_admin_and_target(sqlite_session)

    with _client(sqlite_session, as_user=admin) as client:
        res = client.post(
            f"/api/v1/admin/users/{target.id}/password",
            json={"mode": "reset", "new_password": "should-not"},
        )
    assert res.status_code == 422, res.text
    assert res.json()["detail"]["code"] == "USER_PASSWORD_FORBIDDEN_ON_RESET"


def test_non_admin_forbidden(sqlite_session):
    admin, target = _seed_admin_and_target(sqlite_session)
    manager = User(
        name="Mgr",
        email="mgr@test.com",
        password_hash=hash_password("mgr-pass"),
        role=UserRole.manager,
        is_active=True,
    )
    sqlite_session.add(manager)
    sqlite_session.commit()
    sqlite_session.refresh(manager)

    def _db():
        yield sqlite_session

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: manager
    try:
        client = TestClient(app)
        res = client.post(
            f"/api/v1/admin/users/{target.id}/password",
            json={"mode": "reset"},
        )
        assert res.status_code == 403, res.text
        assert res.json()["detail"]["code"] == "AUTH_ROLE_FORBIDDEN"
    finally:
        app.dependency_overrides.clear()


def test_admin_can_reset_self(sqlite_session):
    admin, _ = _seed_admin_and_target(sqlite_session)

    with _client(sqlite_session, as_user=admin) as client:
        res = client.post(
            f"/api/v1/admin/users/{admin.id}/password",
            json={"mode": "reset"},
        )
    assert res.status_code == 200, res.text
    sqlite_session.refresh(admin)
    assert admin.must_change_password is True
    assert verify_password(settings.DEFAULT_NEW_USER_PASSWORD, admin.password_hash)


def test_enforcement_after_reset_until_change_password(sqlite_session):
    admin, target = _seed_admin_and_target(sqlite_session)

    with _client(sqlite_session, as_user=admin) as client:
        res = client.post(
            f"/api/v1/admin/users/{target.id}/password",
            json={"mode": "reset"},
        )
    assert res.status_code == 200, res.text

    with _client(sqlite_session) as client:
        login = client.post(
            "/api/v1/auth/login",
            data={
                "username": "dev@test.com",
                "password": settings.DEFAULT_NEW_USER_PASSWORD,
            },
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]

    auth = {"Authorization": f"Bearer {token}"}

    def _db():
        yield sqlite_session

    app.dependency_overrides[get_db] = _db
    try:
        client = TestClient(app)
        blocked = client.get("/api/v1/projects/", headers=auth)
        assert blocked.status_code == 403, blocked.text
        assert blocked.json()["detail"]["code"] == "PASSWORD_CHANGE_REQUIRED"

        changed = client.post(
            "/api/v1/auth/change-password",
            headers=auth,
            json={
                "current_password": settings.DEFAULT_NEW_USER_PASSWORD,
                "new_password": "brand-new-after-reset",
            },
        )
        assert changed.status_code == 200, changed.text

        after = client.get("/api/v1/projects/", headers=auth)
        assert after.status_code == 200, after.text
    finally:
        app.dependency_overrides.clear()


def test_user_not_found(sqlite_session):
    admin, _ = _seed_admin_and_target(sqlite_session)

    with _client(sqlite_session, as_user=admin) as client:
        res = client.post(
            "/api/v1/admin/users/99999/password",
            json={"mode": "reset"},
        )
    assert res.status_code == 404, res.text
    assert res.json()["detail"]["code"] == "USER_NOT_FOUND"
