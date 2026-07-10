"""Tests KPI and milestone CRUD with SIGAO service key."""
import uuid

import pytest

from app.core.config import settings


SIGAO_KEY = "test-sigao-key-crud"


@pytest.fixture(autouse=True)
def configure_sigao_key(monkeypatch):
    monkeypatch.setattr(settings, "SIGAO_API_KEY", SIGAO_KEY)


@pytest.fixture
def sigao_project(client):
    # NOTE (ADR-11/ADR-16): `initial_kpi` on project-create now provisions a
    # TaskFlow `Objective(mode='manual')`, not a `ProjectKpi` row — the SIGAO
    # KPI feature no longer writes `project_kpis`. This fixture stays plain
    # (no `initial_kpi`) so the native `/kpis` CRUD tests below still exercise
    # `project_kpis.py`, which remains TaskFlow-native and untouched.
    uid = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/integrations/sigao/projects",
        json={
            "external_uuid": uid,
            "name": "Showroom Tecnológico",
            "budget_total": 750000,
        },
        headers={"X-SIGAO-Key": SIGAO_KEY},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def native_kpi(client, sigao_project):
    """A `project_kpis` row created via the native `/kpis` CRUD surface."""
    resp = client.post(
        f"/api/v1/projects/{sigao_project['id']}/kpis",
        json={
            "name": "Visitantes / Mes",
            "target_value": 500,
            "current_value": 380,
        },
        headers={"X-SIGAO-Key": SIGAO_KEY},
    )
    assert resp.status_code == 201
    return resp.json()


class TestKpiMilestoneCrud:
    def test_update_kpi_creates_event(self, client, sigao_project, native_kpi):
        project_id = sigao_project["id"]
        kpi_id = native_kpi["id"]

        patch = client.patch(
            f"/api/v1/projects/{project_id}/kpis/{kpi_id}",
            json={"current_value": 400, "actor_name": "Dir. General"},
            headers={"X-SIGAO-Key": SIGAO_KEY},
        )
        assert patch.status_code == 200
        assert float(patch.json()["current_value"]) == 400

        activity = client.get(
            f"/api/v1/projects/{project_id}/activity",
            headers={"X-SIGAO-Key": SIGAO_KEY},
        )
        assert any(e["event_type"] == "kpi_updated" for e in activity.json())

    def test_create_and_complete_milestone(self, client, sigao_project):
        project_id = sigao_project["id"]

        create = client.post(
            f"/api/v1/projects/{project_id}/milestones",
            json={
                "title": "Inauguración",
                "due_date": "2026-06-20",
                "actor_name": "Admin",
            },
            headers={"X-SIGAO-Key": SIGAO_KEY},
        )
        assert create.status_code == 201
        ms_id = create.json()["id"]

        complete = client.patch(
            f"/api/v1/projects/{project_id}/milestones/{ms_id}",
            json={"status": "completed", "actor_name": "Admin"},
            headers={"X-SIGAO-Key": SIGAO_KEY},
        )
        assert complete.status_code == 200
        assert complete.json()["status"] == "completed"
        assert complete.json()["completed_at"] is not None

        activity = client.get(
            f"/api/v1/projects/{project_id}/activity",
            headers={"X-SIGAO-Key": SIGAO_KEY},
        )
        types = {e["event_type"] for e in activity.json()}
        assert "milestone_created" in types
        assert "milestone_completed" in types

    def test_add_second_kpi(self, client, sigao_project, native_kpi):
        project_id = sigao_project["id"]
        resp = client.post(
            f"/api/v1/projects/{project_id}/kpis",
            json={
                "name": "Empresas Exhibidas",
                "target_value": 20,
                "current_value": 14,
            },
            headers={"X-SIGAO-Key": SIGAO_KEY},
        )
        assert resp.status_code == 201

        listed = client.get(
            f"/api/v1/projects/{project_id}/kpis",
            headers={"X-SIGAO-Key": SIGAO_KEY},
        )
        assert len(listed.json()) == 2

    def test_get_by_external_uuid(self, client, sigao_project, native_kpi):
        external_uuid = sigao_project["external_uuid"]
        resp = client.get(
            f"/api/v1/integrations/sigao/projects/{external_uuid}",
            headers={"X-SIGAO-Key": SIGAO_KEY},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Showroom Tecnológico"
        assert len(resp.json()["kpis"]) == 1
