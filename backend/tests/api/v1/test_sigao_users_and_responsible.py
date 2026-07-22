"""Tests for REQ-024 SIGAO integration endpoints:

- POST /integrations/sigao/users/ensure
- PUT  /integrations/sigao/projects/{external_uuid}/responsible
"""
import uuid

import pytest

from app.core.config import settings
from app.core.security import verify_password
from app.models.models import Project, ProjectMember, User, UserRole

SIGAO_KEY = "test-sigao-key-req024"
# Hardcoded shared default from models.py / docker/init.sql — must NEVER
# be inherited by SIGAO-provisioned users (auth bypass if cracked once).
_SHARED_DEFAULT_PASSWORD_HASH = (
    "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniJ7HQxQZFx3g8K5vP.8X/5oq"
)


@pytest.fixture(autouse=True)
def configure_sigao_key(monkeypatch):
    monkeypatch.setattr(settings, "SIGAO_API_KEY", SIGAO_KEY)


def _headers():
    return {"X-SIGAO-Key": SIGAO_KEY}


def _create_project(client, external_uuid: str, **overrides):
    payload = {
        "external_uuid": external_uuid,
        "name": "Proyecto REQ-024",
        "initial_kpis": [{"name": "Seed KPI", "mode": "manual"}],
        **overrides,
    }
    resp = client.post(
        "/api/v1/integrations/sigao/projects", json=payload, headers=_headers()
    )
    assert resp.status_code == 201
    return resp.json()


class TestEnsureSigaoUser:
    def test_missing_api_key_returns_401(self, client):
        resp = client.post(
            "/api/v1/integrations/sigao/users/ensure",
            json={"email": "new@example.com", "name": "Nuevo Usuario"},
        )
        assert resp.status_code == 401

    def test_creates_user_when_not_found(self, client, sqlite_session):
        resp = client.post(
            "/api/v1/integrations/sigao/users/ensure",
            json={"email": "new.user@example.com", "name": "Nuevo Usuario"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["created"] is True
        assert body["email"] == "new.user@example.com"
        assert body["name"] == "Nuevo Usuario"
        assert isinstance(body["id"], int)

        user = sqlite_session.query(User).filter(User.id == body["id"]).first()
        assert user is not None
        assert user.role == UserRole.developer
        assert user.is_active is True
        # Random unrecoverable hash — must not inherit the shared model default.
        assert user.password_hash
        assert user.password_hash != _SHARED_DEFAULT_PASSWORD_HASH
        assert not verify_password(
            settings.DEFAULT_NEW_USER_PASSWORD, user.password_hash
        )

    def test_two_provisioned_users_do_not_share_password_hash(
        self, client, sqlite_session
    ):
        first = client.post(
            "/api/v1/integrations/sigao/users/ensure",
            json={"email": "a@example.com", "name": "Usuario A"},
            headers=_headers(),
        )
        second = client.post(
            "/api/v1/integrations/sigao/users/ensure",
            json={"email": "b@example.com", "name": "Usuario B"},
            headers=_headers(),
        )
        assert first.status_code == 200 and second.status_code == 200
        user_a = sqlite_session.query(User).filter(User.id == first.json()["id"]).one()
        user_b = sqlite_session.query(User).filter(User.id == second.json()["id"]).one()
        assert user_a.password_hash != user_b.password_hash
        assert user_a.password_hash != _SHARED_DEFAULT_PASSWORD_HASH
        assert user_b.password_hash != _SHARED_DEFAULT_PASSWORD_HASH

    def test_returns_existing_user_without_duplicating(self, client, sqlite_session):
        first = client.post(
            "/api/v1/integrations/sigao/users/ensure",
            json={"email": "dup@example.com", "name": "Primera Vez"},
            headers=_headers(),
        )
        assert first.status_code == 200
        assert first.json()["created"] is True
        first_id = first.json()["id"]

        second = client.post(
            "/api/v1/integrations/sigao/users/ensure",
            json={"email": "dup@example.com", "name": "Segunda Vez"},
            headers=_headers(),
        )
        assert second.status_code == 200
        assert second.json()["created"] is False
        assert second.json()["id"] == first_id

        assert sqlite_session.query(User).filter(
            User.email == "dup@example.com"
        ).count() == 1

    def test_email_lookup_is_case_insensitive(self, client, sqlite_session):
        first = client.post(
            "/api/v1/integrations/sigao/users/ensure",
            json={"email": "MixedCase@Example.com", "name": "Alguien"},
            headers=_headers(),
        )
        assert first.status_code == 200
        assert first.json()["created"] is True
        first_id = first.json()["id"]

        second = client.post(
            "/api/v1/integrations/sigao/users/ensure",
            json={"email": "mixedcase@example.com", "name": "Alguien"},
            headers=_headers(),
        )
        assert second.status_code == 200
        assert second.json()["created"] is False
        assert second.json()["id"] == first_id

    def test_invalid_email_returns_422(self, client):
        resp = client.post(
            "/api/v1/integrations/sigao/users/ensure",
            json={"email": "not-an-email", "name": "Alguien"},
            headers=_headers(),
        )
        assert resp.status_code == 422


class TestSetSigaoProjectResponsible:
    def test_missing_project_returns_404(self, client):
        resp = client.put(
            f"/api/v1/integrations/sigao/projects/{uuid.uuid4()}/responsible",
            json={"email": "resp@example.com", "name": "Resp Persona"},
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_sets_responsible_creates_user_and_manager_membership(
        self, client, sqlite_session
    ):
        external_uuid = str(uuid.uuid4())
        project = _create_project(client, external_uuid)

        resp = client.put(
            f"/api/v1/integrations/sigao/projects/{external_uuid}/responsible",
            json={"email": "manager@example.com", "name": "Manager Uno"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["role"] == "manager"
        assert body["project_id"] == project["id"]
        assert body["email"] == "manager@example.com"

        db_project = (
            sqlite_session.query(Project).filter(Project.id == project["id"]).first()
        )
        assert db_project.responsible_name == "Manager Uno"

        user = (
            sqlite_session.query(User)
            .filter(User.email == "manager@example.com")
            .first()
        )
        assert user is not None

        member = (
            sqlite_session.query(ProjectMember)
            .filter(
                ProjectMember.project_id == project["id"],
                ProjectMember.user_id == user.id,
            )
            .first()
        )
        assert member is not None
        assert member.role == UserRole.manager

    def test_reassigning_responsible_demotes_previous_manager(
        self, client, sqlite_session
    ):
        external_uuid = str(uuid.uuid4())
        project = _create_project(client, external_uuid)

        first = client.put(
            f"/api/v1/integrations/sigao/projects/{external_uuid}/responsible",
            json={"email": "old-manager@example.com", "name": "Manager Viejo"},
            headers=_headers(),
        )
        assert first.status_code == 200

        second = client.put(
            f"/api/v1/integrations/sigao/projects/{external_uuid}/responsible",
            json={
                "email": "new-manager@example.com",
                "name": "Manager Nuevo",
                "previous_email": "old-manager@example.com",
            },
            headers=_headers(),
        )
        assert second.status_code == 200
        assert second.json()["email"] == "new-manager@example.com"

        old_user = (
            sqlite_session.query(User)
            .filter(User.email == "old-manager@example.com")
            .first()
        )
        new_user = (
            sqlite_session.query(User)
            .filter(User.email == "new-manager@example.com")
            .first()
        )

        old_member = (
            sqlite_session.query(ProjectMember)
            .filter(
                ProjectMember.project_id == project["id"],
                ProjectMember.user_id == old_user.id,
            )
            .first()
        )
        assert old_member is not None
        assert old_member.role == UserRole.developer

        new_member = (
            sqlite_session.query(ProjectMember)
            .filter(
                ProjectMember.project_id == project["id"],
                ProjectMember.user_id == new_user.id,
            )
            .first()
        )
        assert new_member is not None
        assert new_member.role == UserRole.manager

        db_project = (
            sqlite_session.query(Project).filter(Project.id == project["id"]).first()
        )
        assert db_project.responsible_name == "Manager Nuevo"

    def test_setting_same_responsible_again_is_idempotent(
        self, client, sqlite_session
    ):
        external_uuid = str(uuid.uuid4())
        project = _create_project(client, external_uuid)

        for _ in range(2):
            resp = client.put(
                f"/api/v1/integrations/sigao/projects/{external_uuid}/responsible",
                json={"email": "same@example.com", "name": "Mismo Manager"},
                headers=_headers(),
            )
            assert resp.status_code == 200

        assert sqlite_session.query(User).filter(
            User.email == "same@example.com"
        ).count() == 1
        member_count = (
            sqlite_session.query(ProjectMember)
            .filter(ProjectMember.project_id == project["id"])
            .count()
        )
        assert member_count == 1

    def test_records_project_event(self, client):
        external_uuid = str(uuid.uuid4())
        project = _create_project(client, external_uuid)

        resp = client.put(
            f"/api/v1/integrations/sigao/projects/{external_uuid}/responsible",
            json={"email": "event@example.com", "name": "Evento Manager"},
            headers=_headers(),
        )
        assert resp.status_code == 200

        activity = client.get(
            f"/api/v1/projects/{project['id']}/activity", headers=_headers()
        )
        assert activity.status_code == 200
        events = activity.json()
        assert any(
            e["event_type"] == "project_responsible_updated" for e in events
        )
