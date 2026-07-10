"""
Integration tests for the manual-progress guard on KPI-objectives.

`PATCH /integrations/sigao/objectives/{id}/progress` is manual-mode only —
milestone-mode progress is always derived from Hitos del KPI (Task rows) and
must never be hand-set (design.md ADR-11/ADR-12).

Tier: PostgreSQL — see _sigao_kpi_fixtures.py.
"""
import pytest

from ._sigao_kpi_fixtures import (
    cleanup,
    pg_raw,
    seed_objective,
    seed_project,
    sigao_headers,
    sigao_pg_client,
)

BASE = "/api/v1/integrations/sigao"


@pytest.mark.integration
class TestKpiProgressGuard:
    def test_progress_update_on_milestone_objective_returns_409(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Milestone_Progress_Guard")
        try:
            oid = seed_objective(pg_raw, pid, mode="milestone")
            resp = sigao_pg_client.patch(
                f"{BASE}/objectives/{oid}/progress",
                params={"project_id": pid},
                json={"progress_pct": 60},
                headers=sigao_headers(),
            )
            assert resp.status_code == 409
        finally:
            cleanup(pg_raw, pid)

    def test_progress_update_on_manual_objective_succeeds(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Manual_Progress_Guard")
        try:
            oid = seed_objective(pg_raw, pid, mode="manual", progress_pct=10)
            resp = sigao_pg_client.patch(
                f"{BASE}/objectives/{oid}/progress",
                params={"project_id": pid},
                json={"progress_pct": 75},
                headers=sigao_headers(),
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["mode"] == "manual"
            assert data["progress"] == 75
        finally:
            cleanup(pg_raw, pid)

    def test_progress_update_scoped_to_wrong_project_returns_404_and_does_not_mutate(
        self, sigao_pg_client, pg_raw
    ):
        """Fix #3: objective↔project compound scoping — an objective that
        belongs to project B must 404 when the caller addresses it via
        project A's project_id, and must not be mutated."""
        pid_a = seed_project(pg_raw, "Scope_Guard_Project_A")
        pid_b = seed_project(pg_raw, "Scope_Guard_Project_B")
        try:
            oid_b = seed_objective(pg_raw, pid_b, mode="manual", progress_pct=10)

            resp = sigao_pg_client.patch(
                f"{BASE}/objectives/{oid_b}/progress",
                params={"project_id": pid_a},
                json={"progress_pct": 90},
                headers=sigao_headers(),
            )
            assert resp.status_code == 404

            unchanged = sigao_pg_client.get(
                f"{BASE}/objectives/{oid_b}",
                params={"project_id": pid_b},
                headers=sigao_headers(),
            )
            assert unchanged.json()["progress"] == 10
        finally:
            cleanup(pg_raw, pid_a)
            cleanup(pg_raw, pid_b)
