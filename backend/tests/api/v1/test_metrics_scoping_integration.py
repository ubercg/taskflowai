"""
Integration tests for membership scoping of org-wide metrics (TSK-002).
Tier: PostgreSQL (requires docker-compose.test.yml with db_test service).

These cover the one branch the unit tier CANNOT reach: the non-empty
membership filter `project_id = ANY(:project_ids)` in /metrics/projects and
/metrics/aging. SQLite has no ANY(), so the unit tests can only exercise the
empty-membership short-circuit that returns [] before the SQL runs.

Without these tests, "a developer sees only their own projects" — the actual
security claim of TSK-002 — is unverified while the suite stays green.

Run via:
    docker compose -f docker-compose.test.yml run --rm backend_test_integration
"""
import os

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
    """Set to a real users.id by the fixture — the membership query needs it."""

    id = None
    role = UserRole.developer


@pytest.fixture(scope="module")
def scoped_env():
    """
    Developer client plus two projects: the user is a member of `a` only.

    Yields (client, project_a_id, project_b_id).
    """
    if not _postgres_reachable():
        pytest.skip("PostgreSQL not reachable — skipping integration tier")

    engine = _pg_engine()
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    seed = Session()

    user_id = seed.execute(
        text("""
            INSERT INTO users (name, email, password_hash, role, color, is_active, created_at)
            VALUES ('Scoping Dev', 'scoping_dev@test.example', 'x', 'developer', '#123456', true, NOW())
            ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """)
    ).scalar()

    project_a = seed.execute(
        text("""
            INSERT INTO projects (name, description, status, created_at)
            VALUES ('Scoping_A_member', 'member', 'active', NOW())
            RETURNING id
        """)
    ).scalar()
    project_b = seed.execute(
        text("""
            INSERT INTO projects (name, description, status, created_at)
            VALUES ('Scoping_B_outsider', 'not a member', 'active', NOW())
            RETURNING id
        """)
    ).scalar()

    # Membership on A only — this is what the filter must honour.
    seed.execute(
        text("""
            INSERT INTO project_members (project_id, user_id, role)
            VALUES (:pid, :uid, 'developer')
            ON CONFLICT DO NOTHING
        """),
        {"pid": project_a, "uid": user_id},
    )

    # Distinct statuses so /aging (which groups by status, not project) can
    # still prove the scoping: A contributes in_progress, B contributes blocked.
    for pid, status in ((project_a, "in_progress"), (project_b, "blocked")):
        seed.execute(
            text("""
                INSERT INTO tasks (
                    project_id, title, status, type, parent_id, assignee_id,
                    completed_at, due_date, estimated_hours, logged_hours,
                    position, created_at
                ) VALUES (
                    :pid, 'Scoping task',
                    CAST(:status AS task_status), CAST('task' AS task_type),
                    NULL, NULL, NULL, NULL, NULL, NULL,
                    0, NOW() - INTERVAL '2 days'
                )
            """),
            {"pid": pid, "status": status},
        )
    seed.commit()

    _DevUser.id = user_id

    def override_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    def override_auth():
        return _DevUser()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_authenticated] = override_auth
    app.dependency_overrides[require_manager_or_above] = override_auth

    with TestClient(app) as tc:
        yield tc, project_a, project_b

    app.dependency_overrides.clear()

    seed.execute(
        text("DELETE FROM tasks WHERE project_id IN (:a, :b)"),
        {"a": project_a, "b": project_b},
    )
    seed.execute(
        text("DELETE FROM project_members WHERE project_id IN (:a, :b)"),
        {"a": project_a, "b": project_b},
    )
    seed.execute(
        text("DELETE FROM projects WHERE id IN (:a, :b)"),
        {"a": project_a, "b": project_b},
    )
    seed.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user_id})
    seed.commit()
    seed.close()
    engine.dispose()


@pytest.mark.integration
class TestProjectsMetricsMembershipScoping:
    def test_lists_member_project_and_hides_the_rest(self, scoped_env):
        client, project_a, project_b = scoped_env

        resp = client.get("/api/v1/metrics/projects")
        assert resp.status_code == 200

        returned = {row["project_id"] for row in resp.json()}
        assert project_a in returned, "member project must be listed"
        assert project_b not in returned, "non-member project must not leak"

    def test_returns_only_memberships_not_every_project(self, scoped_env):
        """Guards against a filter that silently degrades to 'return all'."""
        client, project_a, _ = scoped_env

        resp = client.get("/api/v1/metrics/projects")
        assert resp.status_code == 200

        rows = resp.json()
        assert rows, "developer with one membership must not get an empty list"
        assert {row["project_id"] for row in rows} == {project_a}


@pytest.mark.integration
class TestAgingMembershipScoping:
    def test_aging_covers_only_member_projects(self, scoped_env):
        client, _, _ = scoped_env

        resp = client.get("/api/v1/metrics/aging")
        assert resp.status_code == 200

        statuses = {row["status"] for row in resp.json()}
        # A (member) holds the in_progress task, B (outsider) the blocked one.
        assert "in_progress" in statuses
        assert "blocked" not in statuses, "outsider project leaked into aging"


@pytest.mark.integration
class TestSingleProjectGateOnPostgres:
    def test_member_reaches_own_project(self, scoped_env):
        client, project_a, _ = scoped_env
        resp = client.get(f"/api/v1/metrics/flow?project_id={project_a}")
        assert resp.status_code == 200

    def test_outsider_blocked_from_existing_project(self, scoped_env):
        """403, not 404 — an existing project must not be distinguishable."""
        client, _, project_b = scoped_env
        resp = client.get(f"/api/v1/metrics/flow?project_id={project_b}")
        assert resp.status_code == 403
        assert resp.json()["detail"]["code"] == "PROJECT_ACCESS_DENIED"
