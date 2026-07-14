"""Tests SIGAO integration endpoints."""
import uuid

import pytest

from app.core.config import settings


SIGAO_KEY = "test-sigao-key-integration"
EXTERNAL_UUID = "550e8400-e29b-41d4-a716-446655440000"


@pytest.fixture(autouse=True)
def configure_sigao_key(monkeypatch):
    monkeypatch.setattr(settings, "SIGAO_API_KEY", SIGAO_KEY)


def _sigao_headers():
    return {"X-SIGAO-Key": SIGAO_KEY}


class TestSigaoIntegrationAuth:
    def test_missing_api_key_returns_401(self, client):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json={
                "external_uuid": EXTERNAL_UUID,
                "name": "Test Project",
            },
        )
        assert resp.status_code == 401

    def test_invalid_api_key_returns_401(self, client):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json={
                "external_uuid": EXTERNAL_UUID,
                "name": "Test Project",
            },
            headers={"X-SIGAO-Key": "wrong-key"},
        )
        assert resp.status_code == 401

    def test_valid_api_key_allows_create(self, client):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json={
                "external_uuid": str(uuid.uuid4()),
                "name": "Auth Test Project",
                "initial_kpis": [{"name": "Seed KPI", "mode": "manual"}],
            },
            headers=_sigao_headers(),
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Auth Test Project"


class TestSigaoCreateIdempotent:
    def test_duplicate_external_uuid_returns_existing(self, client):
        uid = str(uuid.uuid4())
        payload = {
            "external_uuid": uid,
            "name": "MXD Drones",
            "project_type": "innovacion_tecnologica",
            "responsible_name": "Ing. Martínez",
            "budget_total": 320000,
            "initial_kpis": [
                {
                    "name": "Demos realizados",
                    "target_value": 8,
                    "current_value": 2,
                }
            ],
            "actor_name": "Ana García",
        }
        first = client.post(
            "/api/v1/integrations/sigao/projects",
            json=payload,
            headers=_sigao_headers(),
        )
        assert first.status_code == 201
        first_id = first.json()["id"]

        second = client.post(
            "/api/v1/integrations/sigao/projects",
            json=payload,
            headers=_sigao_headers(),
        )
        assert second.status_code == 200
        assert second.json()["id"] == first_id
        # ADR-11/ADR-16: initial_kpis provisions Objectives, not ProjectKpi
        # rows — SigaoProjectResponse.kpis stays empty for SIGAO-seeded KPIs.
        assert second.json()["kpis"] == []

    def test_create_records_project_event(self, client):
        uid = str(uuid.uuid4())
        create = client.post(
            "/api/v1/integrations/sigao/projects",
            json={
                "external_uuid": uid,
                "name": "Event Test",
                "actor_name": "Admin",
                "initial_kpis": [{"name": "Seed KPI", "mode": "manual"}],
            },
            headers=_sigao_headers(),
        )
        project_id = create.json()["id"]
        activity = client.get(
            f"/api/v1/projects/{project_id}/activity",
            headers=_sigao_headers(),
        )
        assert activity.status_code == 200
        events = activity.json()
        assert any(e["event_type"] == "project_created" for e in events)
