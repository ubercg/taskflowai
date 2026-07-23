"""Project membership manager sees full project board (global role may be developer)."""
from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.core.security import get_current_user, hash_password
from app.db.database import get_db
from app.main import app
from app.models.models import (
    Project,
    ProjectMember,
    ProjectStatus,
    Task,
    TaskPriority,
    TaskStatus,
    TaskType,
    User,
    UserRole,
)


@contextmanager
def _client(session, *, as_user: User):
    def _db():
        yield session

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: as_user
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _seed(session):
    lead = User(
        name="Lead",
        email="lead@test.com",
        password_hash=hash_password("x"),
        role=UserRole.developer,  # global developer…
        is_active=True,
    )
    peer = User(
        name="Peer",
        email="peer@test.com",
        password_hash=hash_password("x"),
        role=UserRole.developer,
        is_active=True,
    )
    session.add_all([lead, peer])
    session.flush()

    project = Project(
        name="Board Proj",
        status=ProjectStatus.active,
    )
    session.add(project)
    session.flush()

    session.add(
        ProjectMember(
            project_id=project.id,
            user_id=lead.id,
            role=UserRole.manager,  # …but project manager
        )
    )
    session.add(
        ProjectMember(
            project_id=project.id,
            user_id=peer.id,
            role=UserRole.developer,
        )
    )

    own = Task(
        title="lead-task",
        project_id=project.id,
        assignee_id=lead.id,
        status=TaskStatus.todo,
        priority=TaskPriority.medium,
        type=TaskType.task,
        position=0,
    )
    other = Task(
        title="peer-task",
        project_id=project.id,
        assignee_id=peer.id,
        status=TaskStatus.in_progress,
        priority=TaskPriority.high,
        type=TaskType.task,
        position=1,
    )
    session.add_all([own, other])
    session.commit()
    session.refresh(lead)
    session.refresh(peer)
    session.refresh(project)
    session.refresh(other)
    return lead, peer, project, other


def test_project_manager_lists_all_project_tasks(sqlite_session):
    lead, _peer, project, _other = _seed(sqlite_session)

    with _client(sqlite_session, as_user=lead) as client:
        res = client.get(f"/api/v1/tasks?project_id={project.id}")
    assert res.status_code == 200, res.text
    titles = {t["title"] for t in res.json()}
    assert titles == {"lead-task", "peer-task"}


def test_plain_developer_lists_only_own_on_project(sqlite_session):
    _lead, peer, project, _other = _seed(sqlite_session)

    with _client(sqlite_session, as_user=peer) as client:
        res = client.get(f"/api/v1/tasks?project_id={project.id}")
    assert res.status_code == 200, res.text
    titles = {t["title"] for t in res.json()}
    assert titles == {"peer-task"}


def test_project_manager_can_open_peer_task(sqlite_session):
    lead, _peer, _project, other = _seed(sqlite_session)

    with _client(sqlite_session, as_user=lead) as client:
        res = client.get(f"/api/v1/tasks/{other.id}")
    assert res.status_code == 200, res.text
    assert res.json()["title"] == "peer-task"


def test_plain_developer_cannot_open_peer_task(sqlite_session):
    _lead, peer, _project, _other = _seed(sqlite_session)
    lead_task_id = (
        sqlite_session.query(Task).filter_by(title="lead-task").one().id
    )

    with _client(sqlite_session, as_user=peer) as client:
        res = client.get(f"/api/v1/tasks/{lead_task_id}")
    assert res.status_code == 403, res.text
    assert res.json()["detail"]["code"] == "TASK_VIEW_FORBIDDEN"
