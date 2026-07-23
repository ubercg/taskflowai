"""Integration: analyze_bottleneck persists kanban_bottlenecks (TSK-005)."""
import os
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.modules.intelligence.bottleneck import analyze_bottleneck


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
class TestBottleneckOwnsSession:
    def test_analyze_bottleneck_upserts_kanban_bottlenecks(self, pg_raw, monkeypatch):
        """After analysis, kanban_bottlenecks has rows with a fresh detected_at.

        Uses the real SessionLocal pointing at the same DB URL so we exercise
        the owned-session path (not the request session).
        """
        from app.modules.intelligence import bottleneck as bottleneck_mod
        from app.db import database as database_mod

        # Point SessionLocal at the same engine this fixture uses.
        monkeypatch.setattr(database_mod, "SessionLocal", sessionmaker(
            autocommit=False, autoflush=False, bind=pg_raw.get_bind()
        ))
        monkeypatch.setattr(bottleneck_mod, "SessionLocal", database_mod.SessionLocal)

        # Seed a project + one open parent task.
        pid = pg_raw.execute(
            text(
                """
                INSERT INTO projects (name, status, created_at)
                VALUES (:name, 'active', NOW())
                RETURNING id
                """
            ),
            {"name": f"TSK005_Bottleneck_{datetime.now(timezone.utc).timestamp()}"},
        ).scalar()
        pg_raw.commit()

        try:
            pg_raw.execute(
                text(
                    """
                    INSERT INTO tasks (
                        project_id, title, status, priority, type, position, created_at
                    )
                    VALUES (
                        :pid, 'aging task', 'in_progress', 'medium', 'task', 0,
                        NOW() - INTERVAL '48 hours'
                    )
                    """
                ),
                {"pid": pid},
            )
            pg_raw.commit()

            before = datetime.now(timezone.utc)
            analyze_bottleneck(pid)  # must not raise; owns its session

            rows = pg_raw.execute(
                text(
                    """
                    SELECT status, task_count, detected_at
                    FROM kanban_bottlenecks
                    WHERE project_id = :pid
                    """
                ),
                {"pid": pid},
            ).mappings().all()

            assert rows, "expected at least one kanban_bottlenecks row"
            in_progress = [r for r in rows if r["status"] == "in_progress"]
            assert in_progress, f"missing in_progress row; got {rows}"
            assert in_progress[0]["task_count"] >= 1
            detected = in_progress[0]["detected_at"]
            assert detected is not None
            if detected.tzinfo is None:
                detected = detected.replace(tzinfo=timezone.utc)
            # Allow 2s skew between app NOW() and client clock.
            assert (before - detected).total_seconds() < 2
            assert (detected - before).total_seconds() < 5
        finally:
            pg_raw.execute(
                text("DELETE FROM kanban_bottlenecks WHERE project_id = :pid"),
                {"pid": pid},
            )
            pg_raw.execute(text("DELETE FROM tasks WHERE project_id = :pid"), {"pid": pid})
            pg_raw.execute(text("DELETE FROM projects WHERE id = :pid"), {"pid": pid})
            pg_raw.commit()
