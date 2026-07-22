"""
Access-control tests for timelogs / objectives / tasks list (TSK-003).

Tier: SQLite — gates and ORM filters. Objectives' non-empty membership
branch uses Postgres `ANY()` and is covered in the integration suite.
"""
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.core.security import require_authenticated, require_manager_or_above
from app.models.models import (
    Project,
    ProjectMember,
    Task,
    TimeLog,
    Objective,
    UserRole,
)


class _DevUser:
    id = 42
    role = UserRole.developer


class _ManagerUser:
    id = 7
    role = UserRole.manager


class _AdminUser:
    id = 1
    role = UserRole.admin


def _client_as(sqlite_session, user):
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
    return TestClient(app)


@pytest.fixture
def two_projects(sqlite_session):
    a = Project(name="Member Project")
    b = Project(name="Foreign Project")
    sqlite_session.add_all([a, b])
    sqlite_session.flush()
    return a, b


class TestTimelogAccess:
    def test_outsider_gets_403(self, sqlite_session, two_projects):
        _, foreign = two_projects
        task = Task(project_id=foreign.id, title="Secret task")
        sqlite_session.add(task)
        sqlite_session.commit()

        with _client_as(sqlite_session, _DevUser) as client:
            resp = client.get(f"/api/v1/time-logs?task_id={task.id}")
            assert resp.status_code == 403
            assert resp.json()["detail"]["code"] == "PROJECT_ACCESS_DENIED"
        app.dependency_overrides.clear()

    def test_outsider_missing_task_also_gets_403(self, sqlite_session):
        """
        Same answer for 'does not exist' and 'not yours', so task ids are not
        enumerable. Mirrors the metrics gate from TSK-002.
        """
        with _client_as(sqlite_session, _DevUser) as client:
            resp = client.get("/api/v1/time-logs?task_id=99999")
            assert resp.status_code == 403
            assert resp.json()["detail"]["code"] == "PROJECT_ACCESS_DENIED"
        app.dependency_overrides.clear()

    def test_outsider_cannot_distinguish_missing_from_forbidden(
        self, sqlite_session, two_projects
    ):
        """The whole point: both answers must be byte-identical."""
        _, foreign = two_projects
        task = Task(project_id=foreign.id, title="Secret task")
        sqlite_session.add(task)
        sqlite_session.commit()

        with _client_as(sqlite_session, _DevUser) as client:
            existing = client.get(f"/api/v1/time-logs?task_id={task.id}")
            missing = client.get("/api/v1/time-logs?task_id=99999")

        assert existing.status_code == missing.status_code == 403
        assert existing.json() == missing.json()
        app.dependency_overrides.clear()

    def test_admin_missing_task_still_404(self, sqlite_session):
        """Admins get the truthful answer — there is nothing to hide from them."""
        with _client_as(sqlite_session, _AdminUser) as client:
            resp = client.get("/api/v1/time-logs?task_id=99999")
            assert resp.status_code == 404
            assert resp.json()["detail"]["code"] == "TASK_NOT_FOUND"
        app.dependency_overrides.clear()

    def test_member_can_read(self, sqlite_session, two_projects):
        member_project, _ = two_projects
        sqlite_session.add(
            ProjectMember(
                project_id=member_project.id,
                user_id=_DevUser.id,
                role=UserRole.developer,
            )
        )
        task = Task(project_id=member_project.id, title="Own task")
        sqlite_session.add(task)
        sqlite_session.flush()
        sqlite_session.add(
            TimeLog(
                task_id=task.id,
                user_id=_DevUser.id,
                hours=1.5,
                description="work",
                log_date=date(2026, 7, 1),
            )
        )
        sqlite_session.commit()

        with _client_as(sqlite_session, _DevUser) as client:
            resp = client.get(f"/api/v1/time-logs?task_id={task.id}")
            assert resp.status_code == 200
            assert len(resp.json()) == 1
            assert float(resp.json()[0]["hours"]) == 1.5
        app.dependency_overrides.clear()

    def test_admin_bypasses_membership(self, sqlite_session, two_projects):
        _, foreign = two_projects
        task = Task(project_id=foreign.id, title="Admin can see")
        sqlite_session.add(task)
        sqlite_session.commit()

        with _client_as(sqlite_session, _AdminUser) as client:
            resp = client.get(f"/api/v1/time-logs?task_id={task.id}")
            assert resp.status_code == 200
            assert resp.json() == []
        app.dependency_overrides.clear()


class TestObjectivesListScoping:
    def test_empty_membership_returns_empty(self, sqlite_session, two_projects):
        a, _ = two_projects
        sqlite_session.add(
            Objective(
                project_id=a.id,
                title="Hidden OKR",
                due_date=datetime(2026, 12, 1, tzinfo=timezone.utc),
            )
        )
        sqlite_session.commit()

        with _client_as(sqlite_session, _ManagerUser) as client:
            resp = client.get("/api/v1/objectives")
            assert resp.status_code == 200
            assert resp.json() == []
        app.dependency_overrides.clear()

    def test_with_project_id_outsider_gets_403(self, sqlite_session, two_projects):
        _, foreign = two_projects
        with _client_as(sqlite_session, _ManagerUser) as client:
            resp = client.get(f"/api/v1/objectives?project_id={foreign.id}")
            assert resp.status_code == 403
        app.dependency_overrides.clear()

    def test_admin_without_project_id_reaches_query(self, sqlite_session, two_projects):
        """
        Admin skips the membership filter (where=TRUE). On SQLite the progress
        SQL may 500 — anything other than leaking a filtered empty list for
        the wrong reason is fine as long as it is not 403.
        """
        a, _ = two_projects
        sqlite_session.add(
            Objective(
                project_id=a.id,
                title="Visible to admin",
                due_date=datetime(2026, 12, 1, tzinfo=timezone.utc),
            )
        )
        sqlite_session.commit()

        with _client_as(sqlite_session, _AdminUser) as client:
            # raise_server_exceptions default True — use False for SQL dialect
            pass
        app.dependency_overrides.clear()

        def _override_get_db():
            try:
                yield sqlite_session
            finally:
                pass

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[require_authenticated] = lambda: _AdminUser()
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.get("/api/v1/objectives")
            assert resp.status_code != 403
        app.dependency_overrides.clear()


class TestTasksListScoping:
    def test_manager_without_membership_sees_nothing(self, sqlite_session, two_projects):
        a, b = two_projects
        sqlite_session.add_all(
            [
                Task(project_id=a.id, title="A task"),
                Task(project_id=b.id, title="B task"),
            ]
        )
        sqlite_session.commit()

        with _client_as(sqlite_session, _ManagerUser) as client:
            resp = client.get("/api/v1/tasks")
            assert resp.status_code == 200
            assert resp.json() == []
        app.dependency_overrides.clear()

    def test_manager_sees_only_member_projects(self, sqlite_session, two_projects):
        a, b = two_projects
        sqlite_session.add(
            ProjectMember(
                project_id=a.id,
                user_id=_ManagerUser.id,
                role=UserRole.manager,
            )
        )
        sqlite_session.add_all(
            [
                Task(project_id=a.id, title="Mine"),
                Task(project_id=b.id, title="Theirs"),
            ]
        )
        sqlite_session.commit()

        with _client_as(sqlite_session, _ManagerUser) as client:
            resp = client.get("/api/v1/tasks")
            assert resp.status_code == 200
            titles = {t["title"] for t in resp.json()}
            assert titles == {"Mine"}
        app.dependency_overrides.clear()

    def test_admin_sees_all_projects(self, sqlite_session, two_projects):
        a, b = two_projects
        sqlite_session.add_all(
            [
                Task(project_id=a.id, title="A task"),
                Task(project_id=b.id, title="B task"),
            ]
        )
        sqlite_session.commit()

        with _client_as(sqlite_session, _AdminUser) as client:
            resp = client.get("/api/v1/tasks")
            assert resp.status_code == 200
            titles = {t["title"] for t in resp.json()}
            assert titles == {"A task", "B task"}
        app.dependency_overrides.clear()
