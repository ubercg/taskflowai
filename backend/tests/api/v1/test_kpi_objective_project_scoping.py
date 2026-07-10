"""
Integration tests for MANDATORY objective<->project compound scoping
(judgment-day round 2 residual hardening).

Before this fix, `project_id` was an OPTIONAL query param on the
objective_id-keyed routes, so a caller could omit it entirely and bypass
compound scoping — `get_kpi_objective` and `update_kpi_objective` didn't
even accept the param. Now `project_id` is REQUIRED on every
objective_id-keyed route, so the compound check always runs.

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
class TestKpiObjectiveProjectScopingRequired:
    def test_get_objective_without_project_id_returns_422(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Scoping_Get_Missing_Param")
        try:
            oid = seed_objective(pg_raw, pid, mode="manual", progress_pct=0)
            resp = sigao_pg_client.get(
                f"{BASE}/objectives/{oid}", headers=sigao_headers()
            )
            assert resp.status_code == 422
        finally:
            cleanup(pg_raw, pid)

    def test_get_objective_with_mismatched_project_id_returns_404(
        self, sigao_pg_client, pg_raw
    ):
        pid_a = seed_project(pg_raw, "Scoping_Get_Project_A")
        pid_b = seed_project(pg_raw, "Scoping_Get_Project_B")
        try:
            oid_b = seed_objective(pg_raw, pid_b, mode="manual", progress_pct=0)
            resp = sigao_pg_client.get(
                f"{BASE}/objectives/{oid_b}",
                params={"project_id": pid_a},
                headers=sigao_headers(),
            )
            assert resp.status_code == 404
        finally:
            cleanup(pg_raw, pid_a)
            cleanup(pg_raw, pid_b)

    def test_get_objective_with_correct_project_id_succeeds(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Scoping_Get_Happy_Path")
        try:
            oid = seed_objective(pg_raw, pid, mode="manual", progress_pct=42)
            resp = sigao_pg_client.get(
                f"{BASE}/objectives/{oid}",
                params={"project_id": pid},
                headers=sigao_headers(),
            )
            assert resp.status_code == 200
            assert resp.json()["progress"] == 42
        finally:
            cleanup(pg_raw, pid)

    def test_update_objective_without_project_id_returns_422(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Scoping_Update_Missing_Param")
        try:
            oid = seed_objective(pg_raw, pid, mode="manual", progress_pct=0)
            resp = sigao_pg_client.patch(
                f"{BASE}/objectives/{oid}",
                json={"title": "Renamed"},
                headers=sigao_headers(),
            )
            assert resp.status_code == 422
        finally:
            cleanup(pg_raw, pid)

    def test_update_objective_with_mismatched_project_id_returns_404_and_does_not_mutate(
        self, sigao_pg_client, pg_raw
    ):
        pid_a = seed_project(pg_raw, "Scoping_Update_Project_A")
        pid_b = seed_project(pg_raw, "Scoping_Update_Project_B")
        try:
            oid_b = seed_objective(pg_raw, pid_b, mode="manual", progress_pct=0)
            resp = sigao_pg_client.patch(
                f"{BASE}/objectives/{oid_b}",
                params={"project_id": pid_a},
                json={"title": "Should not apply"},
                headers=sigao_headers(),
            )
            assert resp.status_code == 404

            unchanged = sigao_pg_client.get(
                f"{BASE}/objectives/{oid_b}",
                params={"project_id": pid_b},
                headers=sigao_headers(),
            )
            assert unchanged.json()["title"] == "KPI objective"
        finally:
            cleanup(pg_raw, pid_a)
            cleanup(pg_raw, pid_b)

    def test_update_objective_with_correct_project_id_succeeds(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Scoping_Update_Happy_Path")
        try:
            oid = seed_objective(pg_raw, pid, mode="manual", progress_pct=0)
            resp = sigao_pg_client.patch(
                f"{BASE}/objectives/{oid}",
                params={"project_id": pid},
                json={"title": "Renamed OK"},
                headers=sigao_headers(),
            )
            assert resp.status_code == 200
            assert resp.json()["title"] == "Renamed OK"
        finally:
            cleanup(pg_raw, pid)

    def test_list_hitos_without_project_id_returns_422(self, sigao_pg_client, pg_raw):
        pid = seed_project(pg_raw, "Scoping_Hitos_Missing_Param")
        try:
            oid = seed_objective(pg_raw, pid, mode="milestone")
            resp = sigao_pg_client.get(
                f"{BASE}/objectives/{oid}/hitos", headers=sigao_headers()
            )
            assert resp.status_code == 422
        finally:
            cleanup(pg_raw, pid)

    def test_create_hito_with_mismatched_project_id_returns_404(
        self, sigao_pg_client, pg_raw
    ):
        pid_a = seed_project(pg_raw, "Scoping_Hito_Create_Project_A")
        pid_b = seed_project(pg_raw, "Scoping_Hito_Create_Project_B")
        try:
            oid_b = seed_objective(pg_raw, pid_b, mode="milestone")
            resp = sigao_pg_client.post(
                f"{BASE}/objectives/{oid_b}/hitos",
                params={"project_id": pid_a},
                json={"title": "Should not be created"},
                headers=sigao_headers(),
            )
            assert resp.status_code == 404
        finally:
            cleanup(pg_raw, pid_a)
            cleanup(pg_raw, pid_b)
