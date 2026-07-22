"""
Integration tests for TSK-003 membership filters that need Postgres.

Covers the non-empty `ANY(:project_ids)` branch in GET /objectives (SQLite
has no ANY). Tasks list uses ORM `.in_()` and is covered at the unit tier;
we still assert objectives + timelog access here against real rows.
"""
import os
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.security import require_authenticated, require_manager_or_above
from app.db.database import get_db
from app.main import app
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


class _DevUser:
    id = None
    role = UserRole.developer


class _ManagerUser:
    id = None
    role = UserRole.manager


@pytest.fixture(scope="module")
def tsk003_env():
    if not _postgres_reachable():
        pytest.skip("PostgreSQL not reachable — skipping integration tier")

    engine = _pg_engine()
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    seed = Session()

    user_id = seed.execute(
        text("""
            INSERT INTO users (name, email, password_hash, role, color, is_active, created_at)
            VALUES ('TSK003 Dev', 'tsk003_dev@test.example', 'x', 'developer', '#111111', true, NOW())
            ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """)
    ).scalar()

    manager_id = seed.execute(
        text("""
            INSERT INTO users (name, email, password_hash, role, color, is_active, created_at)
            VALUES ('TSK003 Mgr', 'tsk003_mgr@test.example', 'x', 'manager', '#222222', true, NOW())
            ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """)
    ).scalar()

    project_a = seed.execute(
        text("""
            INSERT INTO projects (name, description, status, created_at)
            VALUES ('TSK003_A_member', 'member', 'active', NOW())
            RETURNING id
        """)
    ).scalar()
    project_b = seed.execute(
        text("""
            INSERT INTO projects (name, description, status, created_at)
            VALUES ('TSK003_B_outsider', 'not a member', 'active', NOW())
            RETURNING id
        """)
    ).scalar()

    seed.execute(
        text("""
            INSERT INTO project_members (project_id, user_id, role)
            VALUES (:pid, :uid, 'developer'), (:pid, :mid, 'manager')
            ON CONFLICT DO NOTHING
        """),
        {"pid": project_a, "uid": user_id, "mid": manager_id},
    )

    task_a = seed.execute(
        text("""
            INSERT INTO tasks (
                project_id, title, status, type, parent_id, assignee_id,
                position, created_at
            ) VALUES (
                :pid, 'TSK003 task A',
                CAST('todo' AS task_status), CAST('task' AS task_type),
                NULL, :uid, 0, NOW()
            )
            RETURNING id
        """),
        {"pid": project_a, "uid": user_id},
    ).scalar()
    task_b = seed.execute(
        text("""
            INSERT INTO tasks (
                project_id, title, status, type, parent_id, assignee_id,
                position, created_at
            ) VALUES (
                :pid, 'TSK003 task B',
                CAST('todo' AS task_status), CAST('task' AS task_type),
                NULL, NULL, 0, NOW()
            )
            RETURNING id
        """),
        {"pid": project_b},
    ).scalar()

    seed.execute(
        text("""
            INSERT INTO time_logs (task_id, user_id, hours, description, log_date, created_at)
            VALUES (:tid, :uid, 2.0, 'secret hours', CURRENT_DATE, NOW())
        """),
        {"tid": task_b, "uid": user_id},
    )

    obj_a = seed.execute(
        text("""
            INSERT INTO objectives (project_id, title, description, due_date, mode, created_at)
            VALUES (:pid, 'OKR A', NULL, NOW() + INTERVAL '30 days', 'milestone', NOW())
            RETURNING id
        """),
        {"pid": project_a},
    ).scalar()
    obj_b = seed.execute(
        text("""
            INSERT INTO objectives (project_id, title, description, due_date, mode, created_at)
            VALUES (:pid, 'OKR B', NULL, NOW() + INTERVAL '30 days', 'milestone', NOW())
            RETURNING id
        """),
        {"pid": project_b},
    ).scalar()

    seed.commit()

    _DevUser.id = user_id
    _ManagerUser.id = manager_id

    def override_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    def as_dev():
        return _DevUser()

    def as_manager():
        return _ManagerUser()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_authenticated] = as_manager
    app.dependency_overrides[require_manager_or_above] = as_manager

    with TestClient(app) as tc:
        yield {
            "client": tc,
            "as_dev": as_dev,
            "as_manager": as_manager,
            "project_a": project_a,
            "project_b": project_b,
            "task_a": task_a,
            "task_b": task_b,
            "obj_a": obj_a,
            "obj_b": obj_b,
            "user_id": user_id,
            "manager_id": manager_id,
        }

    app.dependency_overrides.clear()

    seed.execute(text("DELETE FROM time_logs WHERE task_id IN (:a, :b)"), {"a": task_a, "b": task_b})
    seed.execute(text("DELETE FROM objectives WHERE id IN (:a, :b)"), {"a": obj_a, "b": obj_b})
    seed.execute(text("DELETE FROM tasks WHERE id IN (:a, :b)"), {"a": task_a, "b": task_b})
    seed.execute(
        text("DELETE FROM project_members WHERE project_id IN (:a, :b)"),
        {"a": project_a, "b": project_b},
    )
    seed.execute(
        text("DELETE FROM projects WHERE id IN (:a, :b)"),
        {"a": project_a, "b": project_b},
    )
    seed.execute(
        text("DELETE FROM users WHERE id IN (:u, :m)"),
        {"u": user_id, "m": manager_id},
    )
    seed.commit()
    seed.close()
    engine.dispose()


@pytest.mark.integration
class TestObjectivesMembershipFilter:
    def test_lists_only_member_objectives(self, tsk003_env):
        env = tsk003_env
        resp = env["client"].get("/api/v1/objectives")
        assert resp.status_code == 200
        ids = {row["id"] for row in resp.json()}
        assert env["obj_a"] in ids
        assert env["obj_b"] not in ids

    def test_does_not_degrade_to_all(self, tsk003_env):
        env = tsk003_env
        resp = env["client"].get("/api/v1/objectives")
        assert resp.status_code == 200
        assert {row["id"] for row in resp.json()} == {env["obj_a"]}


@pytest.mark.integration
class TestTimelogProjectGate:
    def test_member_reads_own_project_logs(self, tsk003_env):
        env = tsk003_env
        app.dependency_overrides[require_authenticated] = env["as_dev"]
        resp = env["client"].get(f"/api/v1/time-logs?task_id={env['task_a']}")
        assert resp.status_code == 200
        app.dependency_overrides[require_authenticated] = env["as_manager"]

    def test_outsider_denied_foreign_task_logs(self, tsk003_env):
        env = tsk003_env
        app.dependency_overrides[require_authenticated] = env["as_dev"]
        resp = env["client"].get(f"/api/v1/time-logs?task_id={env['task_b']}")
        assert resp.status_code == 403
        assert resp.json()["detail"]["code"] == "PROJECT_ACCESS_DENIED"
        app.dependency_overrides[require_authenticated] = env["as_manager"]


@pytest.mark.integration
class TestTasksListMembershipFilter:
    def test_manager_sees_only_member_project_tasks(self, tsk003_env):
        env = tsk003_env
        resp = env["client"].get("/api/v1/tasks")
        assert resp.status_code == 200
        ids = {row["id"] for row in resp.json()}
        assert env["task_a"] in ids
        assert env["task_b"] not in ids
