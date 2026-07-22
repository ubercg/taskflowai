"""
Access-control tests for POST /time-logs (TSK-025).

Tier: SQLite — membership gate + logged_hours side-effect, and the same
existence/access enumeration rule already enforced on GET.
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.core.security import require_authenticated, require_manager_or_above
from app.models.models import Project, ProjectMember, Task, UserRole


class _ManagerUser:
    id = 7
    role = UserRole.manager


class _AdminUser:
    id = 1
    role = UserRole.admin


class _DevUser:
    id = 42
    role = UserRole.developer


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


def _post_body(task_id: int, hours: float = 3.0) -> dict:
    return {
        "task_id": task_id,
        "user_id": 999,  # ignored by the endpoint
        "hours": hours,
        "description": "tsk-025",
        "log_date": "2026-07-22",
    }


@pytest.fixture
def foreign_task(sqlite_session):
    project = Project(name="Foreign for write gate")
    sqlite_session.add(project)
    sqlite_session.flush()
    task = Task(
        project_id=project.id,
        title="Untouched hours",
        logged_hours=Decimal("10.0"),
    )
    sqlite_session.add(task)
    sqlite_session.commit()
    return task


@pytest.fixture
def member_task(sqlite_session):
    project = Project(name="Member write project")
    sqlite_session.add(project)
    sqlite_session.flush()
    sqlite_session.add(
        ProjectMember(
            project_id=project.id,
            user_id=_ManagerUser.id,
            role=UserRole.manager,
        )
    )
    task = Task(
        project_id=project.id,
        title="Writable",
        logged_hours=Decimal("1.0"),
        assignee_id=_ManagerUser.id,
    )
    sqlite_session.add(task)
    sqlite_session.commit()
    return task


class TestPostTimelogMembershipGate:
    def test_manager_without_membership_gets_403_and_hours_unchanged(
        self, sqlite_session, foreign_task
    ):
        before = float(foreign_task.logged_hours)

        with _client_as(sqlite_session, _ManagerUser) as client:
            resp = client.post("/api/v1/time-logs", json=_post_body(foreign_task.id, hours=5.0))
            assert resp.status_code == 403
            assert resp.json()["detail"]["code"] == "PROJECT_ACCESS_DENIED"

        sqlite_session.refresh(foreign_task)
        assert float(foreign_task.logged_hours) == before
        app.dependency_overrides.clear()

    def test_member_manager_can_log_hours(self, sqlite_session, member_task):
        with _client_as(sqlite_session, _ManagerUser) as client:
            resp = client.post("/api/v1/time-logs", json=_post_body(member_task.id, hours=2.5))
            assert resp.status_code == 200
            assert float(resp.json()["hours"]) == 2.5
            assert resp.json()["user_id"] == _ManagerUser.id

        sqlite_session.refresh(member_task)
        assert float(member_task.logged_hours) == 3.5
        app.dependency_overrides.clear()

    def test_missing_and_foreign_task_are_indistinguishable_for_manager(
        self, sqlite_session, foreign_task
    ):
        with _client_as(sqlite_session, _ManagerUser) as client:
            foreign = client.post("/api/v1/time-logs", json=_post_body(foreign_task.id))
            missing = client.post("/api/v1/time-logs", json=_post_body(99999))
            assert foreign.status_code == 403
            assert missing.status_code == 403
            assert foreign.json() == missing.json()
        app.dependency_overrides.clear()

    def test_admin_missing_task_still_404(self, sqlite_session):
        with _client_as(sqlite_session, _AdminUser) as client:
            resp = client.post("/api/v1/time-logs", json=_post_body(99999))
            assert resp.status_code == 404
            assert resp.json()["detail"]["code"] == "TASK_NOT_FOUND"
        app.dependency_overrides.clear()

    def test_developer_still_blocked_on_unassigned_member_task(self, sqlite_session):
        """Membership alone is not enough for developers — assignee check remains."""
        project = Project(name="Dev own-only")
        sqlite_session.add(project)
        sqlite_session.flush()
        sqlite_session.add(
            ProjectMember(
                project_id=project.id,
                user_id=_DevUser.id,
                role=UserRole.developer,
            )
        )
        task = Task(
            project_id=project.id,
            title="Someone else's",
            assignee_id=99,
            logged_hours=Decimal("0"),
        )
        sqlite_session.add(task)
        sqlite_session.commit()

        with _client_as(sqlite_session, _DevUser) as client:
            resp = client.post("/api/v1/time-logs", json=_post_body(task.id))
            assert resp.status_code == 403
            assert resp.json()["detail"]["code"] == "TIMELOG_OWN_ONLY"
        app.dependency_overrides.clear()
