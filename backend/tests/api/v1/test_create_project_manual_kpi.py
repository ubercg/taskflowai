"""
Tests for repointing the create-project `initial_kpi` path (POST /projects)
from `ProjectKpi` to `Objective(mode='manual')` — ADR-11/ADR-16.

Unit tier (SQLite): these checks don't touch `_PROGRESS_SELECT`, only ORM
row presence and the due_date default logic (task 1.6).
"""
import uuid
from datetime import datetime, timezone

import pytest

from app.core.config import settings
from app.models.models import Objective, ProjectKpi

SIGAO_KEY = "test-sigao-key-kpi-create"


@pytest.fixture(autouse=True)
def configure_sigao_key(monkeypatch):
    monkeypatch.setattr(settings, "SIGAO_API_KEY", SIGAO_KEY)


def _headers():
    return {"X-SIGAO-Key": SIGAO_KEY}


class TestCreateProjectManualKpi:
    def test_initial_kpi_provisions_objective_not_project_kpi(
        self, client, sqlite_session
    ):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json={
                "external_uuid": str(uuid.uuid4()),
                "name": "KPI Objective Project",
                "initial_kpi": {
                    "name": "Avance general",
                    "target_value": 100,
                    "current_value": 0,
                },
                "actor_name": "Ana",
            },
            headers=_headers(),
        )
        assert resp.status_code == 201
        project_id = resp.json()["id"]

        objectives = (
            sqlite_session.query(Objective)
            .filter(Objective.project_id == project_id)
            .all()
        )
        assert len(objectives) == 1
        assert objectives[0].mode == "manual"
        assert objectives[0].progress_pct == 0

        kpis = (
            sqlite_session.query(ProjectKpi)
            .filter(ProjectKpi.project_id == project_id)
            .all()
        )
        assert kpis == []

    def test_initial_kpi_due_date_defaults_to_project_end_date(
        self, client, sqlite_session
    ):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json={
                "external_uuid": str(uuid.uuid4()),
                "name": "KPI Due Date Project",
                "end_date": "2026-12-31",
                "initial_kpi": {"name": "Avance", "target_value": 100},
            },
            headers=_headers(),
        )
        assert resp.status_code == 201
        project_id = resp.json()["id"]
        obj = (
            sqlite_session.query(Objective)
            .filter(Objective.project_id == project_id)
            .first()
        )
        assert obj.due_date.date().isoformat() == "2026-12-31"

    def test_initial_kpi_due_date_falls_back_to_90_days(
        self, client, sqlite_session
    ):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json={
                "external_uuid": str(uuid.uuid4()),
                "name": "KPI No End Date Project",
                "initial_kpi": {"name": "Avance", "target_value": 100},
            },
            headers=_headers(),
        )
        assert resp.status_code == 201
        project_id = resp.json()["id"]
        obj = (
            sqlite_session.query(Objective)
            .filter(Objective.project_id == project_id)
            .first()
        )
        due_date = obj.due_date
        if due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)
        delta = due_date - datetime.now(timezone.utc)
        assert 85 <= delta.days <= 90
