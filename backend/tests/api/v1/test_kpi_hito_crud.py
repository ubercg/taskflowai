"""
Integration tests for Hitos del KPI (Task rows scoped to a milestone-mode
Objective).

Naming firewall (ADR-15): these live at `/objectives/{id}/hitos`, never
`/milestones` — that route stays reserved for native project milestones.

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
class TestKpiHitoCrud:
    def test_create_complete_delete_hito_re_derives_progress(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Hito_Crud_Test")
        try:
            oid = seed_objective(pg_raw, pid, mode="milestone")

            create = sigao_pg_client.post(
                f"{BASE}/objectives/{oid}/hitos",
                params={"project_id": pid},
                json={"title": "Hito 1"},
                headers=sigao_headers(),
            )
            assert create.status_code == 201
            hito = create.json()
            assert hito["completed"] is False
            hito_id = hito["id"]

            before = sigao_pg_client.get(
                f"{BASE}/objectives/{oid}",
                params={"project_id": pid},
                headers=sigao_headers(),
            )
            assert before.json()["progress"] == 0

            complete = sigao_pg_client.patch(
                f"{BASE}/objectives/{oid}/hitos/{hito_id}",
                params={"project_id": pid},
                json={"completed": True},
                headers=sigao_headers(),
            )
            assert complete.status_code == 200
            assert complete.json()["completed"] is True

            after = sigao_pg_client.get(
                f"{BASE}/objectives/{oid}",
                params={"project_id": pid},
                headers=sigao_headers(),
            )
            assert after.json()["progress"] == 100

            delete = sigao_pg_client.delete(
                f"{BASE}/objectives/{oid}/hitos/{hito_id}",
                params={"project_id": pid},
                headers=sigao_headers(),
            )
            assert delete.status_code == 204

            final = sigao_pg_client.get(
                f"{BASE}/objectives/{oid}",
                params={"project_id": pid},
                headers=sigao_headers(),
            )
            assert final.json()["hitos"] == []
        finally:
            cleanup(pg_raw, pid)

    def test_create_kpi_objective_with_initial_hitos_seeds_atomically(
        self, sigao_pg_client, pg_raw
    ):
        """Fix #1: POST /objectives with a `hitos` list seeds the objective
        and all its hitos in the same atomic transaction."""
        import uuid

        external_uuid = str(uuid.uuid4())
        create_project = sigao_pg_client.post(
            f"{BASE}/projects",
            json={
                "external_uuid": external_uuid,
                "name": "Objective_Create_With_Hitos",
                "initial_kpis": [{"name": "Seed KPI", "mode": "manual"}],
            },
            headers=sigao_headers(),
        )
        assert create_project.status_code == 201
        pid = create_project.json()["id"]
        try:
            resp = sigao_pg_client.post(
                f"{BASE}/projects/{external_uuid}/objectives",
                json={
                    "title": "KPI por hitos",
                    "mode": "milestone",
                    "hitos": ["Hito 1", "Hito 2", "Hito 3"],
                },
                headers=sigao_headers(),
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["mode"] == "milestone"
            assert [h["title"] for h in data["hitos"]] == ["Hito 1", "Hito 2", "Hito 3"]
        finally:
            cleanup(pg_raw, pid)

    def test_hito_create_on_manual_objective_returns_400(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Hito_Manual_Guard")
        try:
            oid = seed_objective(pg_raw, pid, mode="manual")
            resp = sigao_pg_client.post(
                f"{BASE}/objectives/{oid}/hitos",
                params={"project_id": pid},
                json={"title": "Should not be allowed"},
                headers=sigao_headers(),
            )
            assert resp.status_code == 400
        finally:
            cleanup(pg_raw, pid)
