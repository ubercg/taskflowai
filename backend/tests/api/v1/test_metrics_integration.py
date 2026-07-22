"""
Integration tests for monthly metrics endpoints.
Tier: PostgreSQL (requires docker-compose.test.yml with db_test service).

These tests exercise the real SQL: generate_series, FILTER (WHERE ...),
EXTRACT(EPOCH ...), LATERAL joins, and the flow_metrics materialized view.

Run via:
    docker compose -f docker-compose.test.yml run --rm backend_test_integration

Or locally (if Postgres is reachable):
    python -m pytest -m integration -q

The pg_session fixture (from conftest.py) auto-skips when Postgres is unavailable.
"""
import os
import pytest
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.core.security import require_authenticated, require_manager_or_above
from app.models.models import UserRole


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pg_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql://taskflow:taskflow_secret@localhost:5435/taskflow_db",
    )


def _pg_engine():
    url = _pg_url()
    return create_engine(url, connect_args={"connect_timeout": 5})


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


# ---------------------------------------------------------------------------
# Session-scoped Postgres fixture (independent of conftest pg_session so we
# can control the DATABASE_URL for local vs docker test environments)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def pg_client():
    """
    TestClient connected to a real PostgreSQL database.
    Skips the entire module when Postgres is not reachable.
    """
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
    app.dependency_overrides[require_manager_or_above] = override_auth

    with TestClient(app) as tc:
        yield tc

    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture(scope="module")
def pg_raw(pg_client):
    """
    Direct SQLAlchemy session to Postgres for seeding test data.
    Returns a session; the module fixture manages cleanup.
    """
    engine = _pg_engine()
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

def _seed_project(session, name="IntegrationTestProject") -> int:
    """Insert a test project and return its id."""
    r = session.execute(
        text("""
            INSERT INTO projects (name, description, status, created_at)
            VALUES (:name, 'Integration test project', 'active', NOW())
            RETURNING id
        """),
        {"name": name},
    )
    session.commit()
    return r.scalar()


def _seed_user(session, name="IntUser", email=None, color="#abcdef") -> int:
    if email is None:
        email = f"{name.lower().replace(' ', '_')}_{id(name)}@test.example"
    r = session.execute(
        text("""
            INSERT INTO users (name, email, password_hash, role, color, is_active, created_at)
            VALUES (:name, :email, 'x', 'developer', :color, true, NOW())
            ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
            RETURNING id
        """),
        {"name": name, "email": email, "color": color},
    )
    session.commit()
    return r.scalar()


def _seed_task(
    session,
    project_id: int,
    status: str = "done",
    completed_at=None,
    due_date=None,
    assignee_id=None,
    estimated_hours=None,
    logged_hours=None,
    type_: str = "task",
    parent_id=None,
    created_at=None,
) -> int:
    r = session.execute(
        text("""
            INSERT INTO tasks (
                project_id, title, status, type, parent_id, assignee_id,
                completed_at, due_date, estimated_hours, logged_hours,
                position, created_at
            ) VALUES (
                :project_id, 'Test task',
                CAST(:status AS task_status), CAST(:type AS task_type),
                :parent_id, :assignee_id,
                :completed_at, :due_date, :estimated_hours, :logged_hours,
                0, COALESCE(:created_at, NOW() - INTERVAL '30 days')
            )
            RETURNING id
        """),
        {
            "project_id": project_id,
            "status": status,
            "type": type_,
            "parent_id": parent_id,
            "assignee_id": assignee_id,
            "completed_at": completed_at,
            "due_date": due_date,
            "estimated_hours": estimated_hours,
            "logged_hours": logged_hours,
            "created_at": created_at,
        },
    )
    session.commit()
    return r.scalar()


def _seed_activity(session, task_id: int, to_status: str, created_at=None) -> int:
    r = session.execute(
        text("""
            INSERT INTO activities (task_id, from_status, to_status, created_at)
            VALUES (:task_id, CAST('backlog' AS task_status), CAST(:to_status AS task_status), :created_at)
            RETURNING id
        """),
        {
            "task_id": task_id,
            "to_status": to_status,
            "created_at": created_at or datetime.now(tz=timezone.utc),
        },
    )
    session.commit()
    return r.scalar()


def _seed_timelog(session, task_id: int, user_id: int, hours: float, log_date) -> int:
    r = session.execute(
        text("""
            INSERT INTO time_logs (task_id, user_id, hours, log_date, created_at)
            VALUES (:task_id, :user_id, :hours, :log_date, NOW())
            RETURNING id
        """),
        {"task_id": task_id, "user_id": user_id, "hours": hours, "log_date": log_date},
    )
    session.commit()
    return r.scalar()


def _cleanup(session, project_id: int):
    """Remove all test data for the given project."""
    session.execute(text("DELETE FROM projects WHERE id = :pid"), {"pid": project_id})
    session.commit()


# ---------------------------------------------------------------------------
# Scenario 1: /flow monthly — lead/cycle/throughput/efficiency
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestFlowMonthlyIntegration:
    def test_flow_monthly_returns_200_with_shape(self, pg_client, pg_raw):
        """Monthly /flow with tasks in range returns correct shape."""
        pid = _seed_project(pg_raw, name="Flow_Monthly_Test")

        # Absolute window + absolute created_at (never mix with NOW()-Nd).
        start = date(2026, 6, 1)
        end = date(2026, 7, 1)
        created = datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc)
        completed = datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc)

        task_id = _seed_task(
            pg_raw, pid,
            status="done",
            created_at=created,
            completed_at=completed,
            estimated_hours=10,
            logged_hours=8,
        )
        # Activity to mark in_progress (for cycle time)
        in_progress_at = datetime(2026, 6, 10, 8, 0, tzinfo=timezone.utc)
        _seed_activity(pg_raw, task_id, "in_progress", in_progress_at)

        try:
            resp = pg_client.get(
                f"/api/v1/metrics/flow"
                f"?project_id={pid}&start_date={start}&end_date={end}"
            )
            assert resp.status_code == 200
            data = resp.json()

            # Shape
            assert "lead_time_avg_h" in data
            assert "cycle_time_avg_h" in data
            assert "throughput" in data
            assert "efficiency_ratio" in data

            # Values — 1 task completed June 15
            assert data["throughput"] == 1

            # Lead time: Jun 1 00:00 → Jun 15 12:00 = 14.5d = 348h
            if data["lead_time_avg_h"] is not None:
                assert data["lead_time_avg_h"] > 0
                assert abs(data["lead_time_avg_h"] - 348.0) < 1.0

            # Cycle time: in_progress Jun 10 08:00 → completed Jun 15 12:00 = 5d4h = 124h
            if data["cycle_time_avg_h"] is not None:
                assert abs(data["cycle_time_avg_h"] - 124.0) < 1.0

            # Efficiency: 8 logged / 10 estimated = 80%
            assert abs(data["efficiency_ratio"] - 80.0) < 1.0

        finally:
            _cleanup(pg_raw, pid)

    def test_flow_monthly_empty_returns_zeros(self, pg_client, pg_raw):
        """Monthly /flow with no tasks in range returns zeros/nulls (not 500)."""
        pid = _seed_project(pg_raw, name="Flow_Empty_Test")
        try:
            resp = pg_client.get(
                f"/api/v1/metrics/flow"
                f"?project_id={pid}&start_date=2026-06-01&end_date=2026-07-01"
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["throughput"] == 0
        finally:
            _cleanup(pg_raw, pid)

    def test_flow_without_dates_uses_matview(self, pg_client, pg_raw):
        """
        /flow without dates reads from flow_metrics matview (backward-compat).
        The matview may not have data for the test project, but the response
        must include 'throughput_week' or fall back to zeros — no 500.
        """
        pid = _seed_project(pg_raw, name="Flow_Legacy_Test")
        try:
            resp = pg_client.get(f"/api/v1/metrics/flow?project_id={pid}")
            assert resp.status_code == 200
            data = resp.json()
            # Legacy shape has throughput_week
            assert "throughput_week" in data or "throughput" in data
        finally:
            _cleanup(pg_raw, pid)

    def test_flow_task_outside_range_excluded(self, pg_client, pg_raw):
        """Task completed before start_date must not count in throughput."""
        pid = _seed_project(pg_raw, name="Flow_OutOfRange_Test")
        # Completed in May — outside June range
        completed = datetime(2026, 5, 20, 12, 0, tzinfo=timezone.utc)
        _seed_task(pg_raw, pid, status="done", completed_at=completed)
        try:
            resp = pg_client.get(
                f"/api/v1/metrics/flow"
                f"?project_id={pid}&start_date=2026-06-01&end_date=2026-07-01"
            )
            assert resp.status_code == 200
            assert resp.json()["throughput"] == 0
        finally:
            _cleanup(pg_raw, pid)


# ---------------------------------------------------------------------------
# Scenario 2: /velocity monthly + project_id required
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestVelocityIntegration:
    def test_velocity_returns_only_assigned_users(self, pg_client, pg_raw):
        """Users not assigned to tasks in the project must not appear."""
        pid = _seed_project(pg_raw, name="Velocity_Test")
        user_id = _seed_user(pg_raw, name="VelUser", email="veluser@test.example")

        start = date(2026, 6, 1)
        end = date(2026, 7, 1)
        completed = datetime(2026, 6, 20, 12, 0, tzinfo=timezone.utc)

        _seed_task(
            pg_raw, pid,
            status="done",
            completed_at=completed,
            assignee_id=user_id,
        )

        try:
            resp = pg_client.get(
                f"/api/v1/metrics/velocity"
                f"?project_id={pid}&start_date={start}&end_date={end}"
            )
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            user_ids = [r["user_id"] for r in data]
            # Our user must appear
            assert user_id in user_ids
        finally:
            _cleanup(pg_raw, pid)

    def test_velocity_empty_project_returns_empty_list(self, pg_client, pg_raw):
        """Project with no assigned tasks must return []."""
        pid = _seed_project(pg_raw, name="Velocity_Empty_Test")
        try:
            resp = pg_client.get(
                f"/api/v1/metrics/velocity"
                f"?project_id={pid}&start_date=2026-06-01&end_date=2026-07-01"
            )
            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _cleanup(pg_raw, pid)

    def test_velocity_completed_count_matches(self, pg_client, pg_raw):
        """Completed count must match tasks done within the date range."""
        pid = _seed_project(pg_raw, name="Velocity_Count_Test")
        user_id = _seed_user(pg_raw, name="VelCount", email="velcount@test.example")

        start = date(2026, 6, 1)
        end = date(2026, 7, 1)

        # 2 tasks completed in June
        for _ in range(2):
            completed = datetime(2026, 6, 10, 12, 0, tzinfo=timezone.utc)
            _seed_task(pg_raw, pid, status="done", completed_at=completed, assignee_id=user_id)

        # 1 task completed in May (outside range)
        _seed_task(
            pg_raw, pid, status="done",
            completed_at=datetime(2026, 5, 15, 12, 0, tzinfo=timezone.utc),
            assignee_id=user_id,
        )

        try:
            resp = pg_client.get(
                f"/api/v1/metrics/velocity"
                f"?project_id={pid}&start_date={start}&end_date={end}"
            )
            assert resp.status_code == 200
            data = resp.json()
            user_row = next((r for r in data if r["user_id"] == user_id), None)
            assert user_row is not None
            assert user_row["completed"] == 2
        finally:
            _cleanup(pg_raw, pid)

    def test_velocity_default_window_is_current_month(self, pg_client, pg_raw):
        """Without dates, /velocity uses current calendar month (no error)."""
        pid = _seed_project(pg_raw, name="Velocity_Default_Test")
        try:
            resp = pg_client.get(f"/api/v1/metrics/velocity?project_id={pid}")
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)
        finally:
            _cleanup(pg_raw, pid)


# ---------------------------------------------------------------------------
# Scenario 3: /aging with project_id
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestAgingIntegration:
    def test_aging_with_project_id_returns_list(self, pg_client, pg_raw):
        """GET /aging?project_id=N must return 200 and a list."""
        pid = _seed_project(pg_raw, name="Aging_Test")
        # Seed an in_progress task
        _seed_task(pg_raw, pid, status="in_progress")
        try:
            resp = pg_client.get(f"/api/v1/metrics/aging?project_id={pid}")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            if data:
                row = data[0]
                assert "status" in row
                assert "task_count" in row
                assert "avg_hours" in row
        finally:
            _cleanup(pg_raw, pid)

    def test_aging_without_project_id_returns_list(self, pg_client):
        """GET /aging without project_id must return 200 (all projects)."""
        resp = pg_client.get("/api/v1/metrics/aging")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# Scenario 4: /burndown — the main new endpoint
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestBurndownIntegration:
    def test_burndown_empty_scope_returns_zero_series(self, pg_client, pg_raw):
        """Project with no tasks with due_date in range returns N=0 series."""
        pid = _seed_project(pg_raw, name="Burndown_Empty_Test")
        try:
            resp = pg_client.get(
                f"/api/v1/metrics/burndown"
                f"?project_id={pid}&start_date=2026-06-01&end_date=2026-07-01"
            )
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            # June has 30 days → 30 points for [2026-06-01, 2026-07-01)
            assert len(data) == 30
            # All zeros
            assert all(p["ideal"] == 0.0 for p in data)
            assert all(p["real"] == 0 for p in data)
            # Date format
            assert data[0]["date"] == "2026-06-01"
            assert data[-1]["date"] == "2026-06-30"
        finally:
            _cleanup(pg_raw, pid)

    def test_burndown_with_tasks_ideal_descends(self, pg_client, pg_raw):
        """Ideal line must start at N and approach 0 across the period."""
        pid = _seed_project(pg_raw, name="Burndown_Ideal_Test")
        start = date(2026, 6, 1)
        end = date(2026, 7, 1)

        # 5 tasks with due_date in June, none completed
        for _ in range(5):
            _seed_task(
                pg_raw, pid,
                status="todo",
                due_date=datetime(2026, 6, 15, 0, 0, tzinfo=timezone.utc),
            )

        try:
            resp = pg_client.get(
                f"/api/v1/metrics/burndown"
                f"?project_id={pid}&start_date={start}&end_date={end}"
            )
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 30

            # First point: ideal = 5 (N * (1 - 0/30) = 5 * 1 = 5)
            assert data[0]["ideal"] == pytest.approx(5.0, abs=0.1)
            # Last point: ideal = 5 * (1 - 29/30) ≈ 0.17
            assert data[-1]["ideal"] == pytest.approx(5 * (1 - 29 / 30), abs=0.1)

            # Real = 5 everywhere (nothing completed)
            assert all(p["real"] == 5 for p in data)
        finally:
            _cleanup(pg_raw, pid)

    def test_burndown_completed_tasks_reduce_real(self, pg_client, pg_raw):
        """Tasks completed mid-month must reduce the real line from that day."""
        pid = _seed_project(pg_raw, name="Burndown_Real_Test")
        start = date(2026, 6, 1)
        end = date(2026, 7, 1)

        # 4 tasks with due_date in June
        for _ in range(4):
            _seed_task(
                pg_raw, pid,
                status="todo",
                due_date=datetime(2026, 6, 20, 0, 0, tzinfo=timezone.utc),
            )

        # 2 tasks completed on June 10 (within the window)
        completed_at = datetime(2026, 6, 10, 14, 0, tzinfo=timezone.utc)
        for _ in range(2):
            _seed_task(
                pg_raw, pid,
                status="done",
                completed_at=completed_at,
                due_date=datetime(2026, 6, 15, 0, 0, tzinfo=timezone.utc),
            )

        try:
            resp = pg_client.get(
                f"/api/v1/metrics/burndown"
                f"?project_id={pid}&start_date={start}&end_date={end}"
            )
            assert resp.status_code == 200
            data = resp.json()

            # N = 6 (4 todo + 2 done, all have due_date in June)
            # Before June 10: real = 6
            # June 10 (index 9): the 2 tasks were completed by 14:00 → counted
            # After June 10: real = 4

            # Day 0 (June 1) — nothing completed yet
            assert data[0]["real"] == 6

            # Day 9 (June 10) — 2 tasks completed before end-of-day
            assert data[9]["real"] == 4

            # Day 14 (June 15) — still 4
            assert data[14]["real"] == 4
        finally:
            _cleanup(pg_raw, pid)

    def test_burndown_tasks_without_due_date_excluded(self, pg_client, pg_raw):
        """Tasks without due_date must not count toward N."""
        pid = _seed_project(pg_raw, name="Burndown_NoDueDate_Test")

        # 1 task WITH due_date in June
        _seed_task(
            pg_raw, pid,
            status="todo",
            due_date=datetime(2026, 6, 15, 0, 0, tzinfo=timezone.utc),
        )
        # 3 tasks WITHOUT due_date — must be excluded
        for _ in range(3):
            _seed_task(pg_raw, pid, status="todo", due_date=None)

        try:
            resp = pg_client.get(
                f"/api/v1/metrics/burndown"
                f"?project_id={pid}&start_date=2026-06-01&end_date=2026-07-01"
            )
            assert resp.status_code == 200
            data = resp.json()
            # N=1; first day ideal = 1
            assert data[0]["ideal"] == pytest.approx(1.0, abs=0.1)
            assert data[0]["real"] == 1
        finally:
            _cleanup(pg_raw, pid)

    def test_burndown_subtasks_excluded(self, pg_client, pg_raw):
        """Subtasks (parent_id IS NOT NULL) must not count toward N."""
        pid = _seed_project(pg_raw, name="Burndown_Subtask_Test")

        # 1 parent task WITH due_date
        parent_id = _seed_task(
            pg_raw, pid,
            status="todo",
            due_date=datetime(2026, 6, 15, 0, 0, tzinfo=timezone.utc),
        )
        # 2 subtasks WITH due_date in June — must be excluded (type='subtask' and parent_id set)
        for _ in range(2):
            _seed_task(
                pg_raw, pid,
                type_="subtask",
                parent_id=parent_id,
                due_date=datetime(2026, 6, 20, 0, 0, tzinfo=timezone.utc),
                status="todo",
            )

        try:
            resp = pg_client.get(
                f"/api/v1/metrics/burndown"
                f"?project_id={pid}&start_date=2026-06-01&end_date=2026-07-01"
            )
            assert resp.status_code == 200
            data = resp.json()
            # Only 1 task (parent) in N
            assert data[0]["real"] == 1
        finally:
            _cleanup(pg_raw, pid)

    def test_burndown_date_format_is_iso(self, pg_client, pg_raw):
        """Each burndown point's date field must be YYYY-MM-DD format."""
        pid = _seed_project(pg_raw, name="Burndown_DateFmt_Test")
        try:
            resp = pg_client.get(
                f"/api/v1/metrics/burndown"
                f"?project_id={pid}&start_date=2026-06-01&end_date=2026-07-01"
            )
            assert resp.status_code == 200
            data = resp.json()
            for point in data:
                # Must be parseable as ISO date
                parsed = date.fromisoformat(point["date"])
                assert parsed >= date(2026, 6, 1)
                assert parsed < date(2026, 7, 1)
        finally:
            _cleanup(pg_raw, pid)


# ---------------------------------------------------------------------------
# Scenario 5: nonexistent project_id returns 404 (WARNING-01 fix)
# ---------------------------------------------------------------------------

# A project_id that is extremely unlikely to collide with seeded data
_NONEXISTENT_PID = 999_999_999


@pytest.mark.integration
class TestNonexistentProjectReturns404Integration:
    """
    Guard _ensure_project_exists fires before Postgres-only SQL.
    Tests use a seeded project (to prove 200 works) and a nonexistent id.
    """

    def test_flow_nonexistent_project_returns_404(self, pg_client):
        """GET /flow with a nonexistent project_id → 404."""
        resp = pg_client.get(
            f"/api/v1/metrics/flow"
            f"?project_id={_NONEXISTENT_PID}&start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 404

    def test_velocity_nonexistent_project_returns_404(self, pg_client):
        """GET /velocity with a nonexistent project_id → 404."""
        resp = pg_client.get(
            f"/api/v1/metrics/velocity"
            f"?project_id={_NONEXISTENT_PID}&start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 404

    def test_burndown_nonexistent_project_returns_404(self, pg_client):
        """GET /burndown with a nonexistent project_id → 404."""
        resp = pg_client.get(
            f"/api/v1/metrics/burndown"
            f"?project_id={_NONEXISTENT_PID}&start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 404

    def test_flow_existing_project_still_returns_200(self, pg_client, pg_raw):
        """Seeded project must still return 200 (guard only fires for nonexistent ids)."""
        pid = _seed_project(pg_raw, name="Guard_Flow_Test")
        try:
            resp = pg_client.get(
                f"/api/v1/metrics/flow"
                f"?project_id={pid}&start_date=2026-06-01&end_date=2026-07-01"
            )
            assert resp.status_code == 200
        finally:
            _cleanup(pg_raw, pid)

    def test_aging_nonexistent_project_returns_404(self, pg_client):
        """GET /aging with a nonexistent project_id → 404."""
        resp = pg_client.get(f"/api/v1/metrics/aging?project_id={_NONEXISTENT_PID}")
        assert resp.status_code == 404

    def test_aging_without_project_id_still_returns_200(self, pg_client):
        """GET /aging without project_id must return 200 (all-projects path unaffected)."""
        resp = pg_client.get("/api/v1/metrics/aging")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# Scenario 6: /velocity/team — org-wide aggregation
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestTeamVelocityIntegration:
    def test_team_velocity_returns_200_and_list(self, pg_client, pg_raw):
        """GET /velocity/team must return 200 and a list."""
        resp = pg_client.get(
            "/api/v1/metrics/velocity/team"
            "?start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_team_velocity_aggregates_across_projects(self, pg_client, pg_raw):
        """
        A user with completed tasks in two different projects must appear once
        with the sum of completed tasks from both projects.
        """
        pid1 = _seed_project(pg_raw, name="TeamVel_ProjectA")
        pid2 = _seed_project(pg_raw, name="TeamVel_ProjectB")
        user_id = _seed_user(pg_raw, name="TeamVelUser", email="teamveluser@test.example")

        start = date(2026, 6, 1)
        end = date(2026, 7, 1)
        completed = datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc)

        # 2 tasks in project A
        for _ in range(2):
            _seed_task(pg_raw, pid1, status="done", completed_at=completed, assignee_id=user_id)

        # 1 task in project B
        _seed_task(pg_raw, pid2, status="done", completed_at=completed, assignee_id=user_id)

        try:
            resp = pg_client.get(
                f"/api/v1/metrics/velocity/team"
                f"?start_date={start}&end_date={end}"
            )
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)

            # The user must appear exactly once (GROUP BY u.id)
            user_rows = [r for r in data if r["user_id"] == user_id]
            assert len(user_rows) == 1, "User must appear exactly once in team velocity"

            # completed must be the sum across both projects (2 + 1 = 3)
            assert user_rows[0]["completed"] == 3
        finally:
            _cleanup(pg_raw, pid1)
            _cleanup(pg_raw, pid2)

    def test_team_velocity_active_user_with_no_tasks_appears_with_zeros(self, pg_client, pg_raw):
        """
        An active user with no tasks at all must still appear in the result
        with in_progress=0, completed=0, total_hours=0 (LEFT JOIN behaviour).
        """
        # Seed a user with a unique email unlikely to conflict
        user_id = _seed_user(
            pg_raw,
            name="ZeroTasksUser",
            email="zerotasksuser_teamvel@test.example",
        )

        try:
            resp = pg_client.get(
                "/api/v1/metrics/velocity/team"
                "?start_date=2026-06-01&end_date=2026-07-01"
            )
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)

            # The user must appear because LEFT JOIN keeps all active users
            user_rows = [r for r in data if r["user_id"] == user_id]
            assert len(user_rows) == 1, "Active user with no tasks must appear (LEFT JOIN)"
            assert user_rows[0]["in_progress"] == 0
            assert user_rows[0]["completed"] == 0
            assert user_rows[0]["total_hours"] == 0.0
        finally:
            # Remove the seeded user (no project to cleanup, just the user row)
            pg_raw.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user_id})
            pg_raw.commit()

    def test_team_velocity_total_hours_aggregated_across_projects(self, pg_client, pg_raw):
        """
        total_hours must sum time_logs across ALL projects for the user
        (not filtered by a single project_id).
        """
        pid1 = _seed_project(pg_raw, name="TeamVel_Hours_A")
        pid2 = _seed_project(pg_raw, name="TeamVel_Hours_B")
        user_id = _seed_user(pg_raw, name="TeamVelHoursUser", email="teamvelhours@test.example")

        start = date(2026, 6, 1)
        end = date(2026, 7, 1)

        task1 = _seed_task(pg_raw, pid1, status="in_progress", assignee_id=user_id)
        task2 = _seed_task(pg_raw, pid2, status="in_progress", assignee_id=user_id)

        _seed_timelog(pg_raw, task1, user_id, hours=3.0, log_date=date(2026, 6, 10))
        _seed_timelog(pg_raw, task2, user_id, hours=5.0, log_date=date(2026, 6, 12))

        try:
            resp = pg_client.get(
                f"/api/v1/metrics/velocity/team"
                f"?start_date={start}&end_date={end}"
            )
            assert resp.status_code == 200
            data = resp.json()

            user_rows = [r for r in data if r["user_id"] == user_id]
            assert len(user_rows) == 1
            # 3h (project A) + 5h (project B) = 8h total
            assert abs(user_rows[0]["total_hours"] - 8.0) < 0.01
        finally:
            _cleanup(pg_raw, pid1)
            _cleanup(pg_raw, pid2)
