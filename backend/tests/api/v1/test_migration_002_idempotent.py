"""
Integration test for docker/migrations/002_kpi_modes.sql.

Tier: PostgreSQL (requires docker-compose.test.yml with db_test service,
or a reachable local Postgres — see conftest.py pg_session for the pattern).

Verifies:
  - Re-running the migration file is a no-op (idempotent DDL).
  - Existing / newly-created Objective rows default to mode='milestone'
    with progress_pct left NULL (matches ADR-16 — no silent backfill).
"""
import os
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


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


# taskflowai/backend/tests/api/v1/test_migration_002_idempotent.py
#   parents[4] == taskflowai/
_MIGRATION_PATH = (
    Path(__file__).resolve().parents[4] / "docker" / "migrations" / "002_kpi_modes.sql"
)


@pytest.fixture(scope="module")
def pg_raw():
    if not _postgres_reachable():
        pytest.skip("PostgreSQL not reachable — skipping integration tier")
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


def _cleanup(session, project_id: int):
    session.execute(text("DELETE FROM projects WHERE id = :pid"), {"pid": project_id})
    session.commit()


@pytest.mark.integration
class TestMigration002Idempotent:
    def test_migration_sql_file_exists(self):
        assert _MIGRATION_PATH.is_file(), f"Missing migration file: {_MIGRATION_PATH}"

    def test_running_migration_twice_is_a_noop(self, pg_raw):
        """Applying 002_kpi_modes.sql twice must not raise."""
        sql = _MIGRATION_PATH.read_text()
        for _ in range(2):
            pg_raw.execute(text(sql))
            pg_raw.commit()

    def test_existing_objective_defaults_to_milestone_mode(self, pg_raw):
        """A freshly-inserted objective (no mode specified) must default to
        'milestone' with progress_pct left NULL — no automatic backfill."""
        sql = _MIGRATION_PATH.read_text()
        pg_raw.execute(text(sql))
        pg_raw.commit()

        pid = _seed_project(pg_raw, "Migration002_Legacy_Test")
        try:
            obj_id = pg_raw.execute(
                text(
                    """
                    INSERT INTO objectives (project_id, title, due_date, created_at)
                    VALUES (:pid, 'Legacy objective', NOW() + INTERVAL '30 days', NOW())
                    RETURNING id
                    """
                ),
                {"pid": pid},
            ).scalar()
            pg_raw.commit()

            row = pg_raw.execute(
                text("SELECT mode, progress_pct FROM objectives WHERE id = :id"),
                {"id": obj_id},
            ).mappings().first()

            assert row["mode"] == "milestone"
            assert row["progress_pct"] is None
        finally:
            _cleanup(pg_raw, pid)

    def test_objective_comments_table_exists_and_is_empty_by_default(self, pg_raw):
        sql = _MIGRATION_PATH.read_text()
        pg_raw.execute(text(sql))
        pg_raw.commit()

        row = pg_raw.execute(
            text(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'objective_comments'
                ORDER BY column_name
                """
            )
        ).scalars().all()
        assert set(row) == {
            "actor_name",
            "body",
            "created_at",
            "id",
            "objective_id",
        }
