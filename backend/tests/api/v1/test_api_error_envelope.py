"""TSK-017: structured API error envelope."""
from fastapi import HTTPException

from app.core.errors import api_error


class TestApiErrorHelper:
    def test_envelope_shape(self):
        exc = api_error(422, "WIP_LIMIT_EXCEEDED", "WIP limit exceeded", current_wip=3, limit=3)
        assert isinstance(exc, HTTPException)
        assert exc.status_code == 422
        assert exc.detail == {
            "code": "WIP_LIMIT_EXCEEDED",
            "detail": "WIP limit exceeded",
            "current_wip": 3,
            "limit": 3,
        }

    def test_headers_passthrough(self):
        exc = api_error(
            403,
            "AUTH_ROLE_FORBIDDEN",
            "Acceso denegado",
            headers={"X-Required-Role": "admin"},
        )
        assert exc.headers == {"X-Required-Role": "admin"}


class TestMigratedEndpointEnvelope:
    def test_project_not_found_returns_code(self, client):
        resp = client.get("/api/v1/projects/999999")
        assert resp.status_code == 404
        body = resp.json()
        assert body["detail"]["code"] == "PROJECT_NOT_FOUND"
        assert body["detail"]["detail"] == "Project not found"

    def test_sigao_missing_config_returns_code(self, client, monkeypatch):
        from app.core import config

        monkeypatch.setattr(config.settings, "SIGAO_API_KEY", "")
        resp = client.get(
            "/api/v1/integrations/sigao/projects",
            headers={"X-SIGAO-Key": "anything"},
        )
        assert resp.status_code == 503
        body = resp.json()
        assert body["detail"]["code"] == "SIGAO_NOT_CONFIGURED"
