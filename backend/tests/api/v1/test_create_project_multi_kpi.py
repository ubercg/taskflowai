"""
Multi-KPI create for SIGAO projects — `initial_kpis[]` (strict TDD Phase 1).

Covers: ≥1 required array, N Objectives in one TX, milestone ≥1 hito,
manual defaults, rollback, idempotency, reject singular `initial_kpi`.
"""
import uuid

import pytest

from app.core.config import settings
from app.models.models import Objective, Project, ProjectKpi, Task

SIGAO_KEY = "test-sigao-key-multi-kpi"


@pytest.fixture(autouse=True)
def configure_sigao_key(monkeypatch):
    monkeypatch.setattr(settings, "SIGAO_API_KEY", SIGAO_KEY)


def _headers():
    return {"X-SIGAO-Key": SIGAO_KEY}


def _base_payload(**overrides):
    payload = {
        "external_uuid": str(uuid.uuid4()),
        "name": "Multi KPI Project",
        "actor_name": "Ana",
    }
    payload.update(overrides)
    return payload


class TestCreateProjectMultiKpis:
    """1.1 — two+ initial_kpis seeds N Objectives in one TX."""

    def test_two_initial_kpis_seed_n_objectives_in_one_tx(
        self, client, sqlite_session
    ):
        uid = str(uuid.uuid4())
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(
                external_uuid=uid,
                initial_kpis=[
                    {"name": "KPI Manual A", "mode": "manual", "progress_pct": 10},
                    {
                        "name": "KPI Milestone B",
                        "mode": "milestone",
                        "hitos": ["Hito 1", "Hito 2"],
                    },
                ],
            ),
            headers=_headers(),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["id"] is not None
        assert body["external_uuid"] == uid

        project_id = body["id"]
        objectives = (
            sqlite_session.query(Objective)
            .filter(Objective.project_id == project_id)
            .order_by(Objective.id)
            .all()
        )
        assert len(objectives) == 2
        assert objectives[0].title == "KPI Manual A"
        assert objectives[0].mode == "manual"
        assert objectives[0].progress_pct == 10
        assert objectives[1].title == "KPI Milestone B"
        assert objectives[1].mode == "milestone"

        tasks = (
            sqlite_session.query(Task)
            .filter(Task.objective_id == objectives[1].id)
            .order_by(Task.position)
            .all()
        )
        assert [t.title for t in tasks] == ["Hito 1", "Hito 2"]

        # Objective-backed KPIs (nested under project) — not ProjectKpi rows.
        assert (
            sqlite_session.query(ProjectKpi)
            .filter(ProjectKpi.project_id == project_id)
            .count()
            == 0
        )
        assert body["external_uuid"] == uid
        assert {o.title for o in objectives} == {
            "KPI Manual A",
            "KPI Milestone B",
        }

    def test_three_manual_kpis_all_seeded(self, client, sqlite_session):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(
                initial_kpis=[
                    {"name": "One", "mode": "manual"},
                    {"name": "Two", "mode": "manual"},
                    {"name": "Three", "mode": "manual"},
                ],
            ),
            headers=_headers(),
        )
        assert resp.status_code == 201
        project_id = resp.json()["id"]
        titles = [
            o.title
            for o in sqlite_session.query(Objective)
            .filter(Objective.project_id == project_id)
            .order_by(Objective.id)
            .all()
        ]
        assert titles == ["One", "Two", "Three"]


class TestRejectEmptyOrAbsentInitialKpis:
    """1.2 — absent/empty initial_kpis → 422; no project row."""

    def test_absent_initial_kpis_returns_422(self, client, sqlite_session):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(),
            headers=_headers(),
        )
        assert resp.status_code == 422
        assert sqlite_session.query(Project).count() == 0

    def test_empty_initial_kpis_returns_422(self, client, sqlite_session):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(initial_kpis=[]),
            headers=_headers(),
        )
        assert resp.status_code == 422
        assert sqlite_session.query(Project).count() == 0


class TestRejectSingularInitialKpi:
    """1.3 — singular initial_kpi → 422; no project row."""

    def test_singular_initial_kpi_returns_422(self, client, sqlite_session):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(
                initial_kpi={
                    "name": "Legacy principal",
                    "mode": "manual",
                },
            ),
            headers=_headers(),
        )
        assert resp.status_code == 422
        assert sqlite_session.query(Project).count() == 0
        assert sqlite_session.query(Objective).count() == 0


class TestRejectMilestoneZeroHitos:
    """1.4 — milestone with 0/blank-only hitos → 422; TX aborts."""

    def test_milestone_zero_hitos_returns_422(self, client, sqlite_session):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(
                initial_kpis=[
                    {"name": "Sin hitos", "mode": "milestone", "hitos": []},
                ],
            ),
            headers=_headers(),
        )
        assert resp.status_code == 422
        assert sqlite_session.query(Project).count() == 0
        assert sqlite_session.query(Objective).count() == 0
        assert sqlite_session.query(Task).count() == 0

    def test_milestone_blank_only_hitos_returns_422(self, client, sqlite_session):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(
                initial_kpis=[
                    {
                        "name": "Blank hitos",
                        "mode": "milestone",
                        "hitos": ["  ", "", "\t"],
                    },
                ],
            ),
            headers=_headers(),
        )
        assert resp.status_code == 422
        assert sqlite_session.query(Project).count() == 0
        assert sqlite_session.query(Objective).count() == 0
        assert sqlite_session.query(Task).count() == 0

    def test_milestone_missing_hitos_returns_422(self, client, sqlite_session):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(
                initial_kpis=[{"name": "No hitos key", "mode": "milestone"}],
            ),
            headers=_headers(),
        )
        assert resp.status_code == 422
        assert sqlite_session.query(Project).count() == 0


class TestRejectManualWithHitos:
    """1.5 — manual with non-empty hitos → 422."""

    def test_manual_with_non_empty_hitos_returns_422(self, client, sqlite_session):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(
                initial_kpis=[
                    {
                        "name": "Manual bad",
                        "mode": "manual",
                        "hitos": ["Should not be here"],
                    },
                ],
            ),
            headers=_headers(),
        )
        assert resp.status_code == 422
        assert sqlite_session.query(Project).count() == 0


class TestManualProgressDefault:
    """1.6 — manual without progress_pct → 0; no hito Tasks."""

    def test_manual_without_progress_pct_defaults_to_zero(
        self, client, sqlite_session
    ):
        resp = client.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(
                initial_kpis=[{"name": "Manual default", "mode": "manual"}],
            ),
            headers=_headers(),
        )
        assert resp.status_code == 201
        project_id = resp.json()["id"]
        obj = (
            sqlite_session.query(Objective)
            .filter(Objective.project_id == project_id)
            .one()
        )
        assert obj.mode == "manual"
        assert obj.progress_pct == 0
        assert (
            sqlite_session.query(Task)
            .filter(Task.objective_id == obj.id)
            .count()
            == 0
        )


class TestAtomicMultiKpiRollback:
    """1.7 — mid-seed failure rolls back entire TX (no partial Objectives)."""

    def test_mid_seed_failure_rolls_back_project_and_objectives(
        self, app_client_no_raise, sqlite_session, monkeypatch
    ):
        from app.api.v1.endpoints.integrations import sigao as sigao_module

        real_objective = sigao_module.Objective
        call_count = {"n": 0}

        def _counting_objective(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] >= 2:
                raise RuntimeError("simulated second Objective insert failure")
            return real_objective(*args, **kwargs)

        monkeypatch.setattr(sigao_module, "Objective", _counting_objective)

        resp = app_client_no_raise.post(
            "/api/v1/integrations/sigao/projects",
            json=_base_payload(
                initial_kpis=[
                    {"name": "First OK", "mode": "manual"},
                    {"name": "Second BOOM", "mode": "manual"},
                ],
            ),
            headers=_headers(),
        )
        assert resp.status_code == 500

        sqlite_session.rollback()

        assert sqlite_session.query(Project).count() == 0
        assert sqlite_session.query(Objective).count() == 0
        assert sqlite_session.query(Task).count() == 0


class TestIdempotentExternalUuid:
    """1.8 — idempotent create by external_uuid unchanged."""

    def test_duplicate_external_uuid_returns_existing_without_duplicates(
        self, client, sqlite_session
    ):
        uid = str(uuid.uuid4())
        payload = _base_payload(
            external_uuid=uid,
            name="Idempotent Multi",
            initial_kpis=[
                {"name": "KPI A", "mode": "manual", "progress_pct": 5},
                {
                    "name": "KPI B",
                    "mode": "milestone",
                    "hitos": ["H1"],
                },
            ],
        )
        first = client.post(
            "/api/v1/integrations/sigao/projects",
            json=payload,
            headers=_headers(),
        )
        assert first.status_code == 201
        first_id = first.json()["id"]

        second = client.post(
            "/api/v1/integrations/sigao/projects",
            json=payload,
            headers=_headers(),
        )
        assert second.status_code == 200
        assert second.json()["id"] == first_id

        assert (
            sqlite_session.query(Project)
            .filter(Project.external_uuid == uuid.UUID(uid))
            .count()
            == 1
        )
        assert (
            sqlite_session.query(Objective)
            .filter(Objective.project_id == first_id)
            .count()
            == 2
        )


class TestPostCreateObjectiveUnchanged:
    """1.12 support — ≥1-hito rule is create-only on InitialKpiCreate."""

    def test_kpi_objective_create_schema_still_allows_empty_milestone_hitos(self):
        from app.schemas.sigao_schemas import InitialKpiCreate, KpiObjectiveCreate
        from pydantic import ValidationError

        post_create = KpiObjectiveCreate(
            title="Post-create milestone", mode="milestone", hitos=[]
        )
        assert post_create.hitos == []

        with pytest.raises(ValidationError):
            InitialKpiCreate(name="Create-only rule", mode="milestone", hitos=[])
