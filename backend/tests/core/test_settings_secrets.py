"""Unit tests for production fail-fast on secrets (TSK-014)."""
import pytest

from app.core.config import Settings


def test_development_generates_ephemeral_secret_key_when_empty():
    s = Settings(ENVIRONMENT="development", SECRET_KEY="", SIGAO_API_KEY="", _env_file=None)
    assert s.SECRET_KEY  # non-empty ephemeral
    assert len(s.SECRET_KEY) >= 32


def test_production_requires_secret_key():
    with pytest.raises(ValueError, match="SECRET_KEY is required"):
        Settings(ENVIRONMENT="production", SECRET_KEY="", SIGAO_API_KEY="x", _env_file=None)


def test_production_requires_sigao_api_key():
    with pytest.raises(ValueError, match="SIGAO_API_KEY is required"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="prod-secret-key-value",
            SIGAO_API_KEY="",
            _env_file=None,
        )


def test_production_accepts_both_secrets():
    s = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="prod-secret-key-value",
        SIGAO_API_KEY="prod-sigao-key",
        _env_file=None,
    )
    assert s.SECRET_KEY == "prod-secret-key-value"
    assert s.SIGAO_API_KEY == "prod-sigao-key"
    assert s.is_production is True


def test_password_hash_column_has_no_shared_default():
    from app.models.models import User

    col = User.__table__.c.password_hash
    assert col.nullable is False
    # SQLAlchemy Column.default is None when no Python-side default is set
    assert col.default is None
    assert col.server_default is None
