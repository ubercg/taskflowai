"""
Shared pytest fixtures for the TaskFlow backend test suite.

Two tiers:
  - SQLite in-memory (unit): lightweight, no Postgres-specific SQL.
    Used by default for all tests unless marked `integration`.
  - PostgreSQL (integration): real DB with init.sql schema.
    Requires docker-compose.test.yml. Skip gracefully when unavailable.
    Run via: make test-backend-integration  (adds -m integration)
"""
import os
import pytest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.models.models import Base, UserRole
from app.db.database import get_db
from app.core.security import require_authenticated


# ---------------------------------------------------------------------------
# SQLite in-memory tier (unit tests)
# ---------------------------------------------------------------------------

_sqlite_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_SqliteSession = sessionmaker(autocommit=False, autoflush=False, bind=_sqlite_engine)


@pytest.fixture(scope="function")
def sqlite_session():
    """
    Fresh SQLite in-memory session per test function.
    All tables are dropped and recreated to guarantee isolation.
    """
    Base.metadata.drop_all(bind=_sqlite_engine)
    Base.metadata.create_all(bind=_sqlite_engine)
    session = _SqliteSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=_sqlite_engine)


class _MockUser:
    """Minimal user stub that satisfies all role checks."""
    id = 1
    role = UserRole.admin


@pytest.fixture(scope="function")
def client(sqlite_session):
    """
    TestClient wired to:
      - SQLite in-memory DB (via get_db override)
      - Admin MockUser (via require_authenticated override)

    Dependency overrides are reset after each test to avoid bleed-through.
    """
    def _override_get_db():
        try:
            yield sqlite_session
        finally:
            pass  # session lifecycle managed by sqlite_session fixture

    def _override_require_authenticated():
        return _MockUser()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[require_authenticated] = _override_require_authenticated

    with TestClient(app) as tc:
        yield tc

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def app_client_no_raise(sqlite_session):
    """
    Same as `client` but with raise_server_exceptions=False.
    Use this when SQLite raises server-side exceptions that would propagate
    as Python exceptions rather than HTTP 500 responses.
    """
    def _override_get_db():
        try:
            yield sqlite_session
        finally:
            pass

    def _override_require_authenticated():
        return _MockUser()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[require_authenticated] = _override_require_authenticated

    with TestClient(app, raise_server_exceptions=False) as tc:
        yield tc

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# PostgreSQL integration tier
# ---------------------------------------------------------------------------

def _pg_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql://taskflow:taskflow_secret@db_test:5432/taskflow_db",
    )


def _postgres_available() -> bool:
    try:
        from sqlalchemy import text
        eng = create_engine(_pg_url(), connect_args={"connect_timeout": 3})
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def pg_session():
    """
    Session-scoped PostgreSQL fixture for integration tests.

    Skips automatically when Postgres is not reachable (e.g. running locally
    without docker-compose.test.yml).  Run the full integration suite with:
        docker compose -f docker-compose.test.yml run --rm backend_test_integration

    Each test that uses pg_session is responsible for seeding and cleaning up
    its own data to avoid ordering dependencies.
    """
    if not _postgres_available():
        pytest.skip("PostgreSQL not available — skipping integration tier")

    engine = create_engine(_pg_url())
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
