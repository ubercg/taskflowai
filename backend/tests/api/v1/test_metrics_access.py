"""
Access-control tests for /api/v1/metrics (TSK-002).

Tier: SQLite — only the guards run (membership + existence). Endpoints that
would then execute Postgres-only SQL are not exercised past the gate.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.core.security import (
    require_authenticated,
    require_manager_or_above,
    get_current_user,
)
from app.models.models import Project, ProjectMember, UserRole


class _DevUser:
    id = 42
    role = UserRole.developer


class _AdminUser:
    id = 1
    role = UserRole.admin


class _ManagerUser:
    id = 7
    role = UserRole.manager


@pytest.fixture
def seed_project(sqlite_session):
    project = Project(name="Secured Project", description="access test")
    sqlite_session.add(project)
    sqlite_session.flush()
    return project


def _client_as(sqlite_session, user, *, raise_server_exceptions=True):
    def _override_get_db():
        try:
            yield sqlite_session
        finally:
            pass

    def _override_auth():
        return user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[require_authenticated] = _override_auth
    app.dependency_overrides[require_manager_or_above] = _override_auth
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


@pytest.fixture
def outsider_client(sqlite_session, seed_project):
    sqlite_session.commit()
    with _client_as(sqlite_session, _DevUser) as tc:
        yield tc, seed_project
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(sqlite_session, seed_project):
    sqlite_session.commit()
    with _client_as(sqlite_session, _AdminUser, raise_server_exceptions=False) as tc:
        yield tc, seed_project
    app.dependency_overrides.clear()


@pytest.fixture
def manager_outsider_client(sqlite_session, seed_project):
    """Global manager without project membership — still denied by membership gate."""
    sqlite_session.commit()
    with _client_as(sqlite_session, _ManagerUser) as tc:
        yield tc, seed_project
    app.dependency_overrides.clear()


@pytest.fixture
def member_client(sqlite_session, seed_project):
    sqlite_session.add(
        ProjectMember(
            project_id=seed_project.id,
            user_id=_DevUser.id,
            role=UserRole.developer,
        )
    )
    sqlite_session.commit()
    with _client_as(sqlite_session, _DevUser, raise_server_exceptions=False) as tc:
        yield tc, seed_project
    app.dependency_overrides.clear()


class TestMetricsProjectAccessDenied:
    def test_flow_outsider_gets_403(self, outsider_client):
        client, project = outsider_client
        resp = client.get(f"/api/v1/metrics/flow?project_id={project.id}")
        assert resp.status_code == 403
        assert resp.json()["detail"]["code"] == "PROJECT_ACCESS_DENIED"

    def test_velocity_outsider_gets_403(self, outsider_client):
        client, project = outsider_client
        resp = client.get(f"/api/v1/metrics/velocity?project_id={project.id}")
        assert resp.status_code == 403

    def test_burndown_outsider_gets_403(self, outsider_client):
        client, project = outsider_client
        resp = client.get(
            f"/api/v1/metrics/burndown"
            f"?project_id={project.id}&start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 403

    def test_aging_outsider_gets_403(self, outsider_client):
        client, project = outsider_client
        resp = client.get(f"/api/v1/metrics/aging?project_id={project.id}")
        assert resp.status_code == 403

    def test_bottlenecks_outsider_gets_403(self, outsider_client):
        client, project = outsider_client
        resp = client.get(f"/api/v1/metrics/bottlenecks?project_id={project.id}")
        assert resp.status_code == 403

    def test_global_manager_without_membership_gets_403(self, manager_outsider_client):
        client, project = manager_outsider_client
        resp = client.get(f"/api/v1/metrics/flow?project_id={project.id}")
        assert resp.status_code == 403


class TestMetricsAdminAndMemberBypass:
    def test_admin_passes_access_gate(self, admin_client):
        client, project = admin_client
        resp = client.get(
            f"/api/v1/metrics/flow"
            f"?project_id={project.id}&start_date=2026-06-01&end_date=2026-07-01",
        )
        assert resp.status_code != 403

    def test_member_passes_access_gate(self, member_client):
        client, project = member_client
        resp = client.get(f"/api/v1/metrics/aging?project_id={project.id}")
        assert resp.status_code != 403


class TestMetricsExistenceOrder:
    def test_admin_unknown_project_still_404(self, sqlite_session):
        with _client_as(sqlite_session, _AdminUser) as client:
            resp = client.get("/api/v1/metrics/flow?project_id=99999")
            assert resp.status_code == 404
            assert resp.json()["detail"]["code"] == "PROJECT_NOT_FOUND"
        app.dependency_overrides.clear()

    def test_outsider_unknown_project_gets_403_not_404(self, sqlite_session):
        """Access check runs before existence — no existence leak."""
        with _client_as(sqlite_session, _DevUser) as client:
            resp = client.get("/api/v1/metrics/flow?project_id=99999")
            assert resp.status_code == 403
            assert resp.json()["detail"]["code"] == "PROJECT_ACCESS_DENIED"
        app.dependency_overrides.clear()


class TestMetricsListScoping:
    def test_aging_without_project_empty_membership_returns_empty(self, sqlite_session):
        sqlite_session.commit()
        with _client_as(sqlite_session, _DevUser) as client:
            resp = client.get("/api/v1/metrics/aging")
            assert resp.status_code == 200
            assert resp.json() == []
        app.dependency_overrides.clear()

    def test_projects_metrics_empty_membership_returns_empty(self, sqlite_session):
        sqlite_session.commit()
        with _client_as(sqlite_session, _DevUser) as client:
            resp = client.get("/api/v1/metrics/projects")
            assert resp.status_code == 200
            assert resp.json() == []
        app.dependency_overrides.clear()


class TestTeamVelocityRoleGate:
    def test_developer_denied_team_velocity(self, sqlite_session):
        def _override_get_db():
            try:
                yield sqlite_session
            finally:
                pass

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_user] = lambda: _DevUser()
        app.dependency_overrides.pop(require_manager_or_above, None)
        app.dependency_overrides.pop(require_authenticated, None)

        with TestClient(app) as client:
            resp = client.get("/api/v1/metrics/velocity/team")
            assert resp.status_code == 403
            assert resp.json()["detail"]["code"] == "AUTH_ROLE_FORBIDDEN"
        app.dependency_overrides.clear()

    def test_manager_passes_team_velocity_role_gate(self, sqlite_session):
        def _override_get_db():
            try:
                yield sqlite_session
            finally:
                pass

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_user] = lambda: _ManagerUser()
        app.dependency_overrides.pop(require_manager_or_above, None)

        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.get("/api/v1/metrics/velocity/team")
            assert resp.status_code != 403
            assert resp.status_code != 401
        app.dependency_overrides.clear()
