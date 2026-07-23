"""must_change_password flow (TSK-014) — SQLite unit tier."""
from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import hash_password, require_admin, get_current_user
from app.db.database import get_db
from app.main import app
from app.models.models import User, UserRole


@contextmanager
def _client(session, *, as_user: User | None = None):
    """Override get_db (and optionally auth) for one test, then always clear."""

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


def test_admin_create_sets_must_change_password(sqlite_session):
    admin = User(
        name="Admin",
        email="admin@test.com",
        password_hash=hash_password("admin-pass"),
        role=UserRole.admin,
        is_active=True,
        must_change_password=False,
    )
    sqlite_session.add(admin)
    sqlite_session.commit()
    sqlite_session.refresh(admin)

    with _client(sqlite_session, as_user=admin) as client:
        res = client.post(
            "/api/v1/admin/users",
            json={
                "name": "New Dev",
                "email": "new@test.com",
                "role": "developer",
                "color": "#abcdef",
            },
        )
    assert res.status_code == 200, res.text

    created = (
        sqlite_session.query(User).filter(User.email == "new@test.com").one()
    )
    assert created.must_change_password is True


def test_login_returns_must_change_password_flag(sqlite_session):
    user = User(
        name="Temp",
        email="temp@test.com",
        password_hash=hash_password(settings.DEFAULT_NEW_USER_PASSWORD),
        role=UserRole.developer,
        is_active=True,
        must_change_password=True,
    )
    sqlite_session.add(user)
    sqlite_session.commit()

    with _client(sqlite_session) as client:
        res = client.post(
            "/api/v1/auth/login",
            data={
                "username": "temp@test.com",
                "password": settings.DEFAULT_NEW_USER_PASSWORD,
            },
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user"]["must_change_password"] is True


def _login_token(session, email: str, password: str) -> str:
    """Real login (no auth override) so server-side enforcement runs."""
    with _client(session) as client:
        res = client.post(
            "/api/v1/auth/login", data={"username": email, "password": password}
        )
        assert res.status_code == 200, res.text
        return res.json()["access_token"]


def test_backend_blocks_protected_endpoints_until_password_changed(sqlite_session):
    """A valid token for a must_change_password user is inert everywhere but
    the allowlist — closing the API-direct bypass of the frontend gate."""
    user = User(
        name="Temp",
        email="pending@test.com",
        password_hash=hash_password(settings.DEFAULT_NEW_USER_PASSWORD),
        role=UserRole.developer,
        is_active=True,
        must_change_password=True,
    )
    sqlite_session.add(user)
    sqlite_session.commit()

    token = _login_token(
        sqlite_session, "pending@test.com", settings.DEFAULT_NEW_USER_PASSWORD
    )
    auth = {"Authorization": f"Bearer {token}"}

    # Only get_db — get_current_user runs for real (no auth override leak).
    def _db():
        yield sqlite_session

    app.dependency_overrides[get_db] = _db
    try:
        client = TestClient(app)

        # Blocked: a normal authenticated endpoint returns 403 with the code.
        blocked = client.get("/api/v1/projects/", headers=auth)
        assert blocked.status_code == 403, blocked.text
        assert blocked.json()["detail"]["code"] == "PASSWORD_CHANGE_REQUIRED"

        # Escape hatch stays open: read own identity...
        me = client.get("/api/v1/auth/me", headers=auth)
        assert me.status_code == 200, me.text

        # ...and change the password, which clears the flag and reopens the app.
        changed = client.post(
            "/api/v1/auth/change-password",
            headers=auth,
            json={
                "current_password": settings.DEFAULT_NEW_USER_PASSWORD,
                "new_password": "brand-new-pass",
            },
        )
        assert changed.status_code == 200, changed.text

        after = client.get("/api/v1/projects/", headers=auth)
        assert after.status_code == 200, after.text
    finally:
        app.dependency_overrides.clear()


def test_change_password_clears_must_change_flag(sqlite_session):
    user = User(
        name="Temp",
        email="temp2@test.com",
        password_hash=hash_password("old-pass"),
        role=UserRole.developer,
        is_active=True,
        must_change_password=True,
    )
    sqlite_session.add(user)
    sqlite_session.commit()
    sqlite_session.refresh(user)

    with _client(sqlite_session, as_user=user) as client:
        res = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "old-pass", "new_password": "new-pass-ok"},
        )
    assert res.status_code == 200, res.text
    assert res.json()["must_change_password"] is False

    sqlite_session.refresh(user)
    assert user.must_change_password is False
