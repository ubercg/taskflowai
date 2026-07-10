"""
Integration tests for the manual-mode Objective comment trail.

`objective_comments` is an append-only log (ADR-13): no per-progress-change
audit table, just a qualitative trail ordered by `created_at DESC`.

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
class TestObjectiveComments:
    def test_append_and_list_comments_ordered_desc(self, sigao_pg_client, pg_raw):
        pid = seed_project(pg_raw, "Comment_Trail_Test")
        try:
            oid = seed_objective(pg_raw, pid, mode="manual", progress_pct=0)

            first = sigao_pg_client.post(
                f"{BASE}/objectives/{oid}/comments",
                params={"project_id": pid},
                json={"body": "first update"},
                headers=sigao_headers(),
            )
            assert first.status_code == 201

            second = sigao_pg_client.post(
                f"{BASE}/objectives/{oid}/comments",
                params={"project_id": pid},
                json={"body": "second update", "actor_name": "Ana"},
                headers=sigao_headers(),
            )
            assert second.status_code == 201

            listing = sigao_pg_client.get(
                f"{BASE}/objectives/{oid}/comments",
                params={"project_id": pid},
                headers=sigao_headers(),
            )
            assert listing.status_code == 200
            bodies = [c["body"] for c in listing.json()]
            assert bodies == ["second update", "first update"]
        finally:
            cleanup(pg_raw, pid)

    def test_progress_update_with_comment_writes_exactly_one_row(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Comment_On_Progress_Test")
        try:
            oid = seed_objective(pg_raw, pid, mode="manual", progress_pct=10)

            resp = sigao_pg_client.patch(
                f"{BASE}/objectives/{oid}/progress",
                params={"project_id": pid},
                json={
                    "progress_pct": 50,
                    "comment": "moving along",
                    "actor_name": "Ana",
                },
                headers=sigao_headers(),
            )
            assert resp.status_code == 200

            listing = sigao_pg_client.get(
                f"{BASE}/objectives/{oid}/comments",
                params={"project_id": pid},
                headers=sigao_headers(),
            )
            data = listing.json()
            assert len(data) == 1
            assert data[0]["body"] == "moving along"
            assert data[0]["actor_name"] == "Ana"
        finally:
            cleanup(pg_raw, pid)

    def test_progress_update_without_comment_writes_no_row(
        self, sigao_pg_client, pg_raw
    ):
        pid = seed_project(pg_raw, "Comment_No_Comment_Test")
        try:
            oid = seed_objective(pg_raw, pid, mode="manual", progress_pct=10)

            resp = sigao_pg_client.patch(
                f"{BASE}/objectives/{oid}/progress",
                params={"project_id": pid},
                json={"progress_pct": 20},
                headers=sigao_headers(),
            )
            assert resp.status_code == 200

            listing = sigao_pg_client.get(
                f"{BASE}/objectives/{oid}/comments",
                params={"project_id": pid},
                headers=sigao_headers(),
            )
            assert listing.json() == []
        finally:
            cleanup(pg_raw, pid)
