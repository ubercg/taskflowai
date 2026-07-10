"""
Shared local helpers for KPI-objective integration tests (Slice 1).

Not a conftest.py on purpose — follows the established repo convention
(test_objective_mode_progress.py) of keeping each Postgres integration test
file self-contained via explicit imports rather than autouse fixtures.

Tier: PostgreSQL (requires docker-compose.test.yml with db_test service).
KPI-objective endpoints reuse `_PROGRESS_SELECT`, which relies on Postgres-only
SQL (`::int` cast, CASE), so these tests cannot run against the SQLite tier.
"""
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.core.config import settings
from app.core.security import require_authenticated
from app.models.models import UserRole

SIGAO_KEY = "test-sigao-key-kpi"


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
def sigao_pg_client():
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
    settings.SIGAO_API_KEY = SIGAO_KEY

    with TestClient(app) as tc:
        yield tc

    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture(scope="module")
def pg_raw(sigao_pg_client):
    engine = _pg_engine()
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


def sigao_headers() -> dict:
    return {"X-SIGAO-Key": SIGAO_KEY}


def seed_project(session, name: str) -> int:
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


def seed_objective(session, project_id: int, mode: str, progress_pct=None) -> int:
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


def cleanup(session, project_id: int):
    session.execute(text("DELETE FROM projects WHERE id = :pid"), {"pid": project_id})
    session.commit()
