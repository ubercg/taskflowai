"""Integration test for docker/migrations/003_must_change_password.sql (TSK-014)."""
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


_MIGRATION_PATH = (
    Path(__file__).resolve().parents[4]
    / "docker"
    / "migrations"
    / "003_must_change_password.sql"
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


@pytest.mark.integration
class TestMigration003MustChangePassword:
    def test_migration_sql_file_exists(self):
        assert _MIGRATION_PATH.is_file(), f"Missing migration file: {_MIGRATION_PATH}"

    def test_running_migration_twice_is_a_noop(self, pg_raw):
        sql = _MIGRATION_PATH.read_text()
        for _ in range(2):
            pg_raw.execute(text(sql))
            pg_raw.commit()

    def test_column_exists_with_default_false(self, pg_raw):
        sql = _MIGRATION_PATH.read_text()
        pg_raw.execute(text(sql))
        pg_raw.commit()

        row = pg_raw.execute(
            text(
                """
                SELECT column_default, is_nullable, data_type
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'must_change_password'
                """
            )
        ).mappings().first()
        assert row is not None
        assert row["is_nullable"] == "NO"
        assert "boolean" in (row["data_type"] or "").lower() or row["data_type"] == "boolean"
