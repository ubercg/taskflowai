"""
Unit/contract tests for monthly metrics endpoints.
Tier: SQLite in-memory (no Postgres-specific SQL).

These tests validate ONLY:
  - HTTP parameter validation (422 on missing required params)
  - Date range validation (422 when start_date >= end_date)
  - Endpoint routing (routes exist: 200 not 404/405)
  - Project existence guard (404 when project_id is not in the DB)

Tests that require actual SQL execution (flow matview, aging LATERAL,
burndown generate_series, velocity FILTER) live in test_metrics_integration.py.

The conftest `client` fixture wires SQLite in-memory + admin override so the
endpoints don't hit real Postgres.  Endpoints that execute Postgres-only SQL
against SQLite will raise 500 — those are explicitly NOT tested here.

NOTE on project_id=1 with empty SQLite:
  The _ensure_project_exists guard fires BEFORE any Postgres-only SQL, so
  requests with a nonexistent project_id return 404 even on SQLite.  Tests
  that previously asserted "reaches handler (not 404)" now need to assert
  specifically on the guard or use a seeded project.
"""
import pytest


# ---------------------------------------------------------------------------
# Task 2.1 — /velocity requires project_id
# ---------------------------------------------------------------------------

class TestVelocityRequiresProjectId:
    def test_velocity_missing_project_id_returns_422(self, client):
        """GET /velocity without project_id must return 422 (now required)."""
        resp = client.get("/api/v1/metrics/velocity")
        assert resp.status_code == 422

    def test_velocity_with_project_id_routes_to_handler(self, client):
        """
        GET /velocity?project_id=1 must reach the handler (not 405/422).
        With an empty SQLite DB, project 1 does not exist, so the
        _ensure_project_exists guard returns 404 before any Postgres SQL.
        404 is now the CORRECT response for a nonexistent project.
        """
        resp = client.get("/api/v1/metrics/velocity?project_id=1")
        assert resp.status_code != 405
        assert resp.status_code != 422  # param validation passes
        # 404 is expected (guard fires before Postgres SQL); 500 would mean guard is missing
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Task 2.1 — /burndown requires all three params
# ---------------------------------------------------------------------------

class TestBurndownRequiresAllParams:
    def test_burndown_missing_all_params_returns_422(self, client):
        """GET /burndown with no params must return 422."""
        resp = client.get("/api/v1/metrics/burndown")
        assert resp.status_code == 422

    def test_burndown_missing_start_date_returns_422(self, client):
        """GET /burndown without start_date must return 422."""
        resp = client.get("/api/v1/metrics/burndown?project_id=1&end_date=2026-07-01")
        assert resp.status_code == 422

    def test_burndown_missing_end_date_returns_422(self, client):
        """GET /burndown without end_date must return 422."""
        resp = client.get("/api/v1/metrics/burndown?project_id=1&start_date=2026-06-01")
        assert resp.status_code == 422

    def test_burndown_missing_project_id_returns_422(self, client):
        """GET /burndown without project_id must return 422."""
        resp = client.get(
            "/api/v1/metrics/burndown?start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Task 2.2 — backward-compat date validation (pure Python, no SQL needed)
# ---------------------------------------------------------------------------

class TestFlowRouteExists:
    def test_flow_missing_project_id_returns_422(self, client):
        """GET /flow without project_id must return 422 (it's required)."""
        resp = client.get("/api/v1/metrics/flow")
        assert resp.status_code == 422

    def test_flow_start_equal_end_returns_422(self, client):
        """start_date == end_date for /flow must return 422 (zero-length range)."""
        resp = client.get(
            "/api/v1/metrics/flow"
            "?project_id=1&start_date=2026-06-01&end_date=2026-06-01"
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Task 2.2 — date range validation (pure Python, no SQL execution)
# ---------------------------------------------------------------------------

class TestDateValidation:
    def test_burndown_start_after_end_returns_422(self, client):
        """start_date > end_date must return 422 — checked before any SQL."""
        resp = client.get(
            "/api/v1/metrics/burndown"
            "?project_id=1&start_date=2026-07-01&end_date=2026-06-01"
        )
        assert resp.status_code == 422

    def test_burndown_start_equal_end_returns_422(self, client):
        """start_date == end_date (zero-length range) must return 422."""
        resp = client.get(
            "/api/v1/metrics/burndown"
            "?project_id=1&start_date=2026-06-01&end_date=2026-06-01"
        )
        assert resp.status_code == 422

    def test_flow_start_after_end_returns_422(self, client):
        """start_date > end_date for /flow must return 422."""
        resp = client.get(
            "/api/v1/metrics/flow"
            "?project_id=1&start_date=2026-07-01&end_date=2026-06-01"
        )
        assert resp.status_code == 422

    def test_velocity_start_after_end_returns_422(self, client):
        """start_date > end_date for /velocity must return 422."""
        resp = client.get(
            "/api/v1/metrics/velocity"
            "?project_id=1&start_date=2026-07-01&end_date=2026-06-01"
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Task 2.5 — /aging param validation (pure Python)
# ---------------------------------------------------------------------------

class TestAgingParamValidation:
    def test_aging_invalid_project_id_type_returns_422(self, client):
        """GET /aging?project_id=notanumber must return 422."""
        resp = client.get("/api/v1/metrics/aging?project_id=notanumber")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Task 2.6 — /burndown param validation (pure Python, no SQL)
# ---------------------------------------------------------------------------

class TestBurndownParamValidation:
    def test_burndown_invalid_date_format_returns_422(self, client):
        """GET /burndown with non-ISO dates must return 422."""
        resp = client.get(
            "/api/v1/metrics/burndown"
            "?project_id=1&start_date=not-a-date&end_date=2026-07-01"
        )
        assert resp.status_code == 422

    def test_burndown_start_equal_end_returns_422(self, client):
        """start_date == end_date (zero-length range) must return 422 before any SQL."""
        resp = client.get(
            "/api/v1/metrics/burndown"
            "?project_id=1&start_date=2026-06-15&end_date=2026-06-15"
        )
        assert resp.status_code == 422

    def test_burndown_invalid_project_id_type_returns_422(self, client):
        """GET /burndown with non-integer project_id must return 422."""
        resp = client.get(
            "/api/v1/metrics/burndown"
            "?project_id=notanumber&start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Task 2.2 (WARNING-01 fix) — nonexistent project_id returns 404
# ---------------------------------------------------------------------------

class TestNonexistentProjectReturns404:
    """
    The _ensure_project_exists guard fires BEFORE any Postgres-specific SQL.
    With an empty SQLite DB, every integer project_id is nonexistent → 404.
    This works on SQLite because the guard only does a simple ORM .get() on
    the projects table, which SQLite supports.
    """

    def test_flow_nonexistent_project_returns_404(self, client):
        """GET /flow with a valid date range but nonexistent project_id → 404."""
        resp = client.get(
            "/api/v1/metrics/flow"
            "?project_id=99999&start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 404

    def test_velocity_nonexistent_project_returns_404(self, client):
        """GET /velocity with valid params but nonexistent project_id → 404."""
        resp = client.get(
            "/api/v1/metrics/velocity"
            "?project_id=99999&start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 404

    def test_burndown_nonexistent_project_returns_404(self, client):
        """GET /burndown with valid params but nonexistent project_id → 404."""
        resp = client.get(
            "/api/v1/metrics/burndown"
            "?project_id=99999&start_date=2026-06-01&end_date=2026-07-01"
        )
        assert resp.status_code == 404

    def test_date_validation_still_fires_before_project_guard(self, client):
        """
        A bad date range (start >= end) must 422 even when project_id is
        nonexistent — _validate_date_range runs first.
        """
        resp = client.get(
            "/api/v1/metrics/flow"
            "?project_id=99999&start_date=2026-07-01&end_date=2026-06-01"
        )
        assert resp.status_code == 422

    def test_aging_nonexistent_project_returns_404(self, client):
        """GET /aging with a nonexistent project_id → 404."""
        resp = client.get("/api/v1/metrics/aging?project_id=99999")
        assert resp.status_code == 404

    def test_aging_without_project_id_is_not_affected(self, app_client_no_raise):
        """
        GET /aging without project_id must NOT 404 — the guard only fires for
        explicit non-None project_ids.  With SQLite the LATERAL join will 500,
        but that is an acceptable non-404/non-422 outcome at this tier.
        We use raise_server_exceptions=False so the SQLite 500 doesn't blow up.
        """
        resp = app_client_no_raise.get("/api/v1/metrics/aging")
        assert resp.status_code != 404
        assert resp.status_code != 422
