"""TSK-001: POST /api/v1/users must not exist as an open registration surface.

The only supported user-creation path is POST /api/v1/admin/users (require_admin).
"""
import pytest
from fastapi.testclient import TestClient

from app.core.security import require_admin
from app.db.database import get_db
from app.main import app
from app.models.models import User, UserRole


class _AdminStub:
    id = 1
    role = UserRole.admin


@pytest.fixture
def anon_client(sqlite_session):
    """TestClient with DB wired but NO auth dependency override."""

    def _override_get_db():
        try:
            yield sqlite_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(sqlite_session):
    """TestClient with require_admin satisfied (admin path regression)."""

    def _override_get_db():
        try:
            yield sqlite_session
        finally:
            pass

    def _override_require_admin():
        return _AdminStub()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[require_admin] = _override_require_admin
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


class TestPostUsersRemoved:
    def test_anonymous_post_users_is_rejected(self, anon_client, sqlite_session):
        before = sqlite_session.query(User).count()
        resp = anon_client.post(
            "/api/v1/users",
            json={
                "name": "Attacker",
                "email": "attacker@example.com",
                "role": "admin",
                "color": "#000000",
            },
        )
        # Method gone → 405; some stacks may surface 404. Never 2xx.
        assert resp.status_code in (404, 405)
        assert sqlite_session.query(User).count() == before

    def test_authenticated_client_cannot_create_via_users(self, client, sqlite_session):
        # `client` overrides require_authenticated, but the route itself must
        # not exist — privilege is irrelevant.
        before = sqlite_session.query(User).count()
        resp = client.post(
            "/api/v1/users",
            json={
                "name": "Should Fail",
                "email": "should.fail@example.com",
                "role": "admin",
            },
        )
        assert resp.status_code in (404, 405)
        assert sqlite_session.query(User).count() == before


class TestAdminUsersCreateStillGuarded:
    def test_anonymous_cannot_create_admin_user(self, anon_client, sqlite_session):
        before = sqlite_session.query(User).count()
        resp = anon_client.post(
            "/api/v1/admin/users",
            json={
                "name": "Attacker Admin",
                "email": "attacker.admin@example.com",
                "role": "admin",
                "color": "#ff0000",
            },
        )
        assert resp.status_code in (401, 403)
        assert sqlite_session.query(User).count() == before

    def test_admin_can_still_create_user(self, admin_client, sqlite_session):
        resp = admin_client.post(
            "/api/v1/admin/users",
            json={
                "name": "Nuevo Dev",
                "email": "nuevo.dev@example.com",
                "role": "developer",
                "color": "#6366f1",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == "nuevo.dev@example.com"
        assert body["role"] in (UserRole.developer.value, "developer", UserRole.developer)

        user = (
            sqlite_session.query(User)
            .filter(User.email == "nuevo.dev@example.com")
            .first()
        )
        assert user is not None
        assert user.role == UserRole.developer
