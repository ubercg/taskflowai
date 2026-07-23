"""Native PATCH progress_pct for manual objectives (UI unblock for archive)."""
from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.core.security import get_current_user, hash_password, require_manager_or_above
from app.db.database import get_db
from app.main import app
from app.models.models import (
    Objective,
    Project,
    ProjectMember,
    ProjectStatus,
    User,
    UserRole,
)
from datetime import datetime, timezone


@contextmanager
def _client(session, *, as_user: User):
    def _db():
        yield session

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: as_user
    app.dependency_overrides[require_manager_or_above] = lambda: as_user
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _seed(session, *, mode: str):
    admin = User(
        name="Admin",
        email="admin-obj@test.com",
        password_hash=hash_password("x"),
        role=UserRole.admin,
        is_active=True,
    )
    session.add(admin)
    session.flush()
    project = Project(name="P", status=ProjectStatus.active)
    session.add(project)
    session.flush()
    obj = Objective(
        title="KPI",
        project_id=project.id,
        due_date=datetime(2026, 12, 1, tzinfo=timezone.utc),
        mode=mode,
        progress_pct=0 if mode == "manual" else None,
    )
    session.add(obj)
    session.commit()
    session.refresh(admin)
    session.refresh(obj)
    return admin, obj


def test_patch_manual_progress_pct(sqlite_session):
    admin, obj = _seed(sqlite_session, mode="manual")
    with _client(sqlite_session, as_user=admin) as client:
        res = client.patch(
            f"/api/v1/objectives/{obj.id}",
            json={"progress_pct": 100},
        )
    assert res.status_code == 200, res.text
    assert res.json()["progress"] == 100
    assert res.json()["mode"] == "manual"


def test_patch_milestone_progress_rejected(sqlite_session):
    admin, obj = _seed(sqlite_session, mode="milestone")
    with _client(sqlite_session, as_user=admin) as client:
        res = client.patch(
            f"/api/v1/objectives/{obj.id}",
            json={"progress_pct": 50},
        )
    assert res.status_code == 409, res.text
    assert res.json()["detail"]["code"] == "OBJECTIVE_PROGRESS_IMMUTABLE"


def test_project_manager_developer_can_patch_manual_progress(sqlite_session):
    lead = User(
        name="Lead",
        email="lead-obj@test.com",
        password_hash=hash_password("x"),
        role=UserRole.developer,
        is_active=True,
    )
    sqlite_session.add(lead)
    sqlite_session.flush()
    project = Project(name="P2", status=ProjectStatus.active)
    sqlite_session.add(project)
    sqlite_session.flush()
    sqlite_session.add(
        ProjectMember(project_id=project.id, user_id=lead.id, role=UserRole.manager)
    )
    obj = Objective(
        title="Manual KPI",
        project_id=project.id,
        due_date=datetime(2026, 12, 1, tzinfo=timezone.utc),
        mode="manual",
        progress_pct=10,
    )
    sqlite_session.add(obj)
    sqlite_session.commit()
    sqlite_session.refresh(lead)
    sqlite_session.refresh(obj)

    with _client(sqlite_session, as_user=lead) as client:
        res = client.patch(
            f"/api/v1/objectives/{obj.id}",
            json={"progress_pct": 100},
        )
    assert res.status_code == 200, res.text
    assert res.json()["progress"] == 100
