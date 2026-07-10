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
                json={"progress_pct": 75},
                headers=sigao_headers(),
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["mode"] == "manual"
            assert data["progress"] == 75
        finally:
            cleanup(pg_raw, pid)
