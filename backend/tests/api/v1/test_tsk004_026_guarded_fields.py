"""Regression tests for TSK-004 / TSK-026 — guarded fields have ONE path.

Both bugs shared one root cause: a business invariant lived in a dedicated
endpoint, but a generic PATCH wrote the same field with a blind setattr,
skipping the guard.

Fix (Option A): the guarded field was removed from the generic update schema,
so it can ONLY change through its guarded endpoint.

  - Task.status      -> only via PATCH /tasks/{id}/move   (RN-01 WIP, RN-02 open subtasks)
  - User.is_active   -> only via PATCH /admin/users/{id}/toggle (HAS_ACTIVE_TASKS)

Each test proves BOTH halves: the generic PATCH is now inert for the field,
and the dedicated guarded endpoint still fires.
"""
import pytest

from app.main import app
from app.core.security import require_admin
from app.models.models import (
    Project,
    Task,
    TaskStatus,
    User,
    UserRole,
)


# ---------------------------------------------------------------------------
# TSK-004 — Task.status cannot be set through the generic PATCH
# ---------------------------------------------------------------------------


def _seed_parent_with_open_subtask(session):
    project = Project(id=1, name="P", status="active")
    parent = Task(id=10, project_id=1, title="Parent", status=TaskStatus.backlog)
    subtask = Task(
        id=11,
        project_id=1,
        parent_id=10,
        title="Open subtask",
        status=TaskStatus.backlog,
    )
    session.add_all([project, parent, subtask])
    session.commit()


def test_generic_patch_cannot_set_task_status(client, sqlite_session):
    """PATCH /tasks/{id} must ignore `status` — the field left the schema."""
    _seed_parent_with_open_subtask(sqlite_session)

    resp = client.patch("/api/v1/tasks/10", json={"status": "done", "title": "Renamed"})

    assert resp.status_code == 200
    body = resp.json()
    # The allowed field still applies...
    assert body["title"] == "Renamed"
    # ...but status is inert through this path — no bypass of the guard.
    assert body["status"] == "backlog"
    sqlite_session.expire_all()
    assert sqlite_session.get(Task, 10).status == TaskStatus.backlog


def test_move_endpoint_still_enforces_open_subtasks_guard(client, sqlite_session):
    """The only status path (/move) still blocks done with open subtasks."""
    _seed_parent_with_open_subtask(sqlite_session)

    resp = client.patch(
        "/api/v1/tasks/10/move", json={"status": "done", "user_id": 1}
    )

    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "OPEN_SUBTASKS"
    sqlite_session.expire_all()
    assert sqlite_session.get(Task, 10).status == TaskStatus.backlog


# ---------------------------------------------------------------------------
# TSK-026 — User.is_active cannot be set through the generic PATCH
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_client(client):
    """`client` plus a require_admin override (conftest only overrides
    require_authenticated). Cleared by the conftest client fixture teardown."""

    class _Admin:
        id = 1
        role = UserRole.admin

    app.dependency_overrides[require_admin] = lambda: _Admin()
    return client


def _seed_user_with_active_task(session):
    project = Project(id=1, name="P", status="active")
    target = User(
        id=2,
        email="target@test.com",
        password_hash="pw",
        name="Target",
        role=UserRole.developer,
        is_active=True,
    )
    task = Task(
        id=20,
        project_id=1,
        title="Active task",
        status=TaskStatus.in_progress,
        assignee_id=2,
    )
    session.add_all([project, target, task])
    session.commit()


def test_generic_patch_cannot_deactivate_user(admin_client, sqlite_session):
    """PATCH /admin/users/{id} must ignore `is_active` — field left the schema."""
    _seed_user_with_active_task(sqlite_session)

    resp = admin_client.patch(
        "/api/v1/admin/users/2", json={"is_active": False, "name": "Renamed"}
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Renamed"
    # is_active is inert through this path — no bypass of HAS_ACTIVE_TASKS.
    assert body["is_active"] is True
    sqlite_session.expire_all()
    assert sqlite_session.get(User, 2).is_active is True


def test_toggle_endpoint_still_enforces_active_tasks_guard(admin_client, sqlite_session):
    """The only deactivation path (/toggle) still blocks users with active tasks."""
    _seed_user_with_active_task(sqlite_session)

    resp = admin_client.patch("/api/v1/admin/users/2/toggle")

    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "HAS_ACTIVE_TASKS"
    sqlite_session.expire_all()
    assert sqlite_session.get(User, 2).is_active is True


# ---------------------------------------------------------------------------
# Schema-shape seal — the behavioral tests above prove the field is inert
# *today*, but they pass by coincidence if the field is re-added and the
# guard silently drops. These fail the instant a guarded field reappears in
# its generic update schema, naming the regression directly.
# ---------------------------------------------------------------------------


def test_task_update_schema_has_no_status_field():
    """`status` must never live on TaskUpdate — its only path is /move."""
    from app.schemas.schemas import TaskUpdate

    assert "status" not in TaskUpdate.model_fields, (
        "TSK-004 regression: `status` is back on TaskUpdate, so a generic "
        "PATCH /tasks/{id} bypasses the WIP / open-subtasks guard. Its only "
        "write path is PATCH /tasks/{id}/move."
    )


def test_user_admin_update_schema_has_no_is_active_field():
    """`is_active` must never live on UserAdminUpdate — its only path is /toggle."""
    from app.api.v1.endpoints.admin_users import UserAdminUpdate

    assert "is_active" not in UserAdminUpdate.model_fields, (
        "TSK-026 regression: `is_active` is back on UserAdminUpdate, so a "
        "generic PATCH /admin/users/{id} bypasses the HAS_ACTIVE_TASKS guard. "
        "Its only write path is PATCH /admin/users/{id}/toggle."
    )
