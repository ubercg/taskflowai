"""
Integration tests for mode-aware objective progress (_PROGRESS_SELECT).

Tier: PostgreSQL (requires docker-compose.test.yml with db_test service).
Exercises the real SQL CASE branch on `objectives.mode` — SQLite cannot run
this query (Postgres `::int` cast + CASE), so this stays in the pg tier,
matching the pattern in test_metrics_integration.py.
"""
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.core.security import require_authenticated
from app.models.models import UserRole


def _pg_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql://taskflow:taskflow_secret@localhost:5435/taskflow_db",
    )


def _pg_engine():
    return create_engine(_pg_url(), connect_args={"connect_timeout": 5})


def _postgres_reachable() -> bool:
    try:
        eng = _pg_engine()
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except Exception:
        return False


class _MockAdmin:
    id = 9999
    role = UserRole.admin


@pytest.fixture(scope="module")
def pg_client():
    if not _postgres_reachable():
        pytest.skip("PostgreSQL not reachable — skipping integration tier")

    engine = _pg_engine()
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    def override_auth():
        return _MockAdmin()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_authenticated] = override_auth

    with TestClient(app) as tc:
        yield tc

    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture(scope="module")
def pg_raw(pg_client):
    engine = _pg_engine()
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


def _seed_project(session, name: str) -> int:
    r = session.execute(
        text(
            """
            INSERT INTO projects (name, status, created_at)
            VALUES (:name, 'active', NOW())
            RETURNING id
            """
        ),
        {"name": name},
    )
    session.commit()
    return r.scalar()


def _seed_objective(session, project_id: int, mode: str, progress_pct=None) -> int:
    r = session.execute(
        text(
            """
            INSERT INTO objectives (project_id, title, due_date, mode, progress_pct, created_at)
            VALUES (:pid, 'KPI objective', NOW() + INTERVAL '30 days', :mode, :progress_pct, NOW())
            RETURNING id
            """
        ),
        {"pid": project_id, "mode": mode, "progress_pct": progress_pct},
    )
    session.commit()
    return r.scalar()


def _seed_task(session, project_id: int, objective_id: int, status: str) -> int:
    r = session.execute(
        text(
            """
            INSERT INTO tasks (project_id, objective_id, title, status, position, created_at)
            VALUES (:pid, :oid, 'Hito del KPI', CAST(:status AS task_status), 0, NOW())
            RETURNING id
            """
        ),
        {"pid": project_id, "oid": objective_id, "status": status},
    )
    session.commit()
    return r.scalar()


def _cleanup(session, project_id: int):
    session.execute(text("DELETE FROM projects WHERE id = :pid"), {"pid": project_id})
    session.commit()


@pytest.mark.integration
class TestObjectiveModeProgress:
    def test_manual_mode_returns_stored_progress_pct(self, pg_client, pg_raw):
        pid = _seed_project(pg_raw, "Manual_Mode_Test")
        try:
            oid = _seed_objective(pg_raw, pid, mode="manual", progress_pct=42)
            resp = pg_client.get(f"/api/v1/objectives/{oid}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["mode"] == "manual"
            assert data["progress"] == 42
        finally:
            _cleanup(pg_raw, pid)

    def test_milestone_mode_returns_derived_progress(self, pg_client, pg_raw):
        pid = _seed_project(pg_raw, "Milestone_Mode_Test")
        try:
            oid = _seed_objective(pg_raw, pid, mode="milestone")
            _seed_task(pg_raw, pid, oid, "done")
            _seed_task(pg_raw, pid, oid, "done")
            _seed_task(pg_raw, pid, oid, "todo")
            _seed_task(pg_raw, pid, oid, "todo")

            resp = pg_client.get(f"/api/v1/objectives/{oid}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["mode"] == "milestone"
            assert data["progress"] == 50
        finally:
            _cleanup(pg_raw, pid)

    def test_manual_mode_null_progress_pct_returns_zero(self, pg_client, pg_raw):
        pid = _seed_project(pg_raw, "Manual_Null_Test")
        try:
            oid = _seed_objective(pg_raw, pid, mode="manual", progress_pct=None)
            resp = pg_client.get(f"/api/v1/objectives/{oid}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["mode"] == "manual"
            assert data["progress"] == 0
        finally:
            _cleanup(pg_raw, pid)

    def test_default_new_objective_is_milestone_and_derives_from_tasks(
        self, pg_client, pg_raw
    ):
        """Sanity: native objectives (no mode passed) keep deriving progress
        from tasks — ADR-16 (default 'milestone' protects existing behavior)."""
        pid = _seed_project(pg_raw, "Native_Objective_Test")
        try:
            obj_id = pg_raw.execute(
                text(
                    """
                    INSERT INTO objectives (project_id, title, due_date, created_at)
                    VALUES (:pid, 'Native OKR', NOW() + INTERVAL '30 days', NOW())
                    RETURNING id
                    """
                ),
                {"pid": pid},
            ).scalar()
            pg_raw.commit()
            _seed_task(pg_raw, pid, obj_id, "done")
            _seed_task(pg_raw, pid, obj_id, "todo")

            resp = pg_client.get(f"/api/v1/objectives/{obj_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["mode"] == "milestone"
            assert data["progress"] == 50
        finally:
            _cleanup(pg_raw, pid)
