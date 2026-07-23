"""TSK-027 / REQ-010 — archive projects with completion guard + list filter."""
from datetime import datetime, timezone

from app.models.models import (
    Objective,
    ObjectiveMode,
    Project,
    ProjectMember,
    ProjectStatus,
    Task,
    TaskStatus,
    User,
    UserRole,
)

_DUE = datetime(2030, 1, 1, tzinfo=timezone.utc)


def _seed_project(session, *, project_id=1, status=ProjectStatus.active):
    project = Project(id=project_id, name=f"P{project_id}", status=status)
    session.add(project)
    session.commit()
    return project


def test_archive_empty_project_succeeds(client, sqlite_session):
    _seed_project(sqlite_session)
    resp = client.post("/api/v1/projects/1/archive")
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "archived"
    sqlite_session.expire_all()
    assert sqlite_session.get(Project, 1).status == ProjectStatus.archived


def test_archive_blocked_by_open_tasks(client, sqlite_session):
    _seed_project(sqlite_session)
    sqlite_session.add(
        Task(id=1, project_id=1, title="Open", status=TaskStatus.todo)
    )
    sqlite_session.commit()

    resp = client.post("/api/v1/projects/1/archive")
    assert resp.status_code == 422, resp.text
    body = resp.json()["detail"]
    assert body["code"] == "PROJECT_NOT_READY_TO_ARCHIVE"
    assert body["open_tasks"] == 1
    assert body["incomplete_objectives"] == 0
    sqlite_session.expire_all()
    assert sqlite_session.get(Project, 1).status == ProjectStatus.active


def test_archive_blocked_by_incomplete_objective(client, sqlite_session):
    _seed_project(sqlite_session)
    sqlite_session.add(
        Objective(
            id=1,
            project_id=1,
            title="OKR",
            due_date=_DUE,
            mode=ObjectiveMode.manual.value,
            progress_pct=50,
        )
    )
    sqlite_session.commit()

    resp = client.post("/api/v1/projects/1/archive")
    assert resp.status_code == 422, resp.text
    body = resp.json()["detail"]
    assert body["code"] == "PROJECT_NOT_READY_TO_ARCHIVE"
    assert body["incomplete_objectives"] == 1


def test_archive_succeeds_when_tasks_done_and_objectives_complete(
    client, sqlite_session
):
    _seed_project(sqlite_session)
    sqlite_session.add_all(
        [
            Task(id=1, project_id=1, title="Done", status=TaskStatus.done),
            Objective(
                id=1,
                project_id=1,
                title="OKR",
                due_date=_DUE,
                mode=ObjectiveMode.manual.value,
                progress_pct=100,
            ),
        ]
    )
    sqlite_session.commit()

    resp = client.post("/api/v1/projects/1/archive")
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "archived"


def test_generic_patch_cannot_set_archived(client, sqlite_session):
    _seed_project(sqlite_session)
    resp = client.patch("/api/v1/projects/1", json={"status": "archived"})
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["code"] == "PROJECT_ARCHIVE_USE_DEDICATED_PATH"
    sqlite_session.expire_all()
    assert sqlite_session.get(Project, 1).status == ProjectStatus.active


def test_list_excludes_archived_by_default(client, sqlite_session):
    _seed_project(sqlite_session, project_id=1, status=ProjectStatus.active)
    _seed_project(sqlite_session, project_id=2, status=ProjectStatus.archived)

    resp = client.get("/api/v1/projects")
    assert resp.status_code == 200, resp.text
    ids = {p["id"] for p in resp.json()}
    assert ids == {1}


def test_list_include_archived(client, sqlite_session):
    _seed_project(sqlite_session, project_id=1, status=ProjectStatus.active)
    _seed_project(sqlite_session, project_id=2, status=ProjectStatus.archived)

    resp = client.get("/api/v1/projects?include_archived=true")
    assert resp.status_code == 200, resp.text
    ids = {p["id"] for p in resp.json()}
    assert ids == {1, 2}


def test_list_status_archived_filter(client, sqlite_session):
    _seed_project(sqlite_session, project_id=1, status=ProjectStatus.active)
    _seed_project(sqlite_session, project_id=2, status=ProjectStatus.archived)

    resp = client.get("/api/v1/projects?status=archived")
    assert resp.status_code == 200, resp.text
    ids = {p["id"] for p in resp.json()}
    assert ids == {2}


def test_developer_cannot_archive(client, sqlite_session):
    """Override auth to a developer who is only a developer member."""
    from app.main import app
    from app.core.security import require_authenticated

    _seed_project(sqlite_session)
    dev = User(
        id=2,
        email="dev@test.com",
        password_hash="pw",
        name="Dev",
        role=UserRole.developer,
        is_active=True,
    )
    sqlite_session.add(dev)
    sqlite_session.add(
        ProjectMember(project_id=1, user_id=2, role=UserRole.developer)
    )
    sqlite_session.commit()

    class _Dev:
        id = 2
        role = UserRole.developer

    app.dependency_overrides[require_authenticated] = lambda: _Dev()
    try:
        resp = client.post("/api/v1/projects/1/archive")
        assert resp.status_code == 403, resp.text
        assert resp.json()["detail"]["code"] == "PROJECT_ARCHIVE_FORBIDDEN"
    finally:
        pass


def test_project_manager_can_archive(client, sqlite_session):
    from app.main import app
    from app.core.security import require_authenticated

    _seed_project(sqlite_session)
    mgr = User(
        id=3,
        email="mgr@test.com",
        password_hash="pw",
        name="Mgr",
        role=UserRole.manager,
        is_active=True,
    )
    sqlite_session.add(mgr)
    sqlite_session.add(
        ProjectMember(project_id=1, user_id=3, role=UserRole.manager)
    )
    sqlite_session.commit()

    class _Mgr:
        id = 3
        role = UserRole.manager

    app.dependency_overrides[require_authenticated] = lambda: _Mgr()
    try:
        resp = client.post("/api/v1/projects/1/archive")
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "archived"
    finally:
        pass
