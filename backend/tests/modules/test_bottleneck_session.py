"""TSK-005 — background bottleneck must own its DB session."""
import inspect
from unittest.mock import MagicMock

import pytest

from app.modules.intelligence import bottleneck as bottleneck_mod
from app.modules.intelligence.bottleneck import (
    analyze_bottleneck,
    _run_bottleneck_analysis,
)


def test_analyze_bottleneck_signature_takes_only_project_id():
    """Callers must not be able to pass the request session (TSK-005)."""
    params = list(inspect.signature(analyze_bottleneck).parameters)
    assert params == ["project_id"]


def test_analyze_bottleneck_opens_and_closes_own_session(monkeypatch):
    """Even when analysis fails, the owned session is always closed."""
    created: list[MagicMock] = []

    def fake_session_local():
        session = MagicMock(name="owned_session")
        created.append(session)
        # Force the analysis path to error so we exercise except + finally.
        session.execute.side_effect = RuntimeError("forced analysis failure")
        return session

    monkeypatch.setattr(bottleneck_mod, "SessionLocal", fake_session_local)

    analyze_bottleneck(42)  # must not raise

    assert len(created) == 1
    created[0].close.assert_called_once()
    created[0].rollback.assert_called()


def test_closed_request_session_cannot_run_analysis():
    """Documents the pre-fix failure mode: a closed Session raises on use.

    FastAPI closes the request session in get_db's finally before BackgroundTasks
    run. Passing that session into analysis was the bug TSK-005 removes.
    """
    closed = MagicMock(name="closed_request_session")
    closed.execute.side_effect = Exception("Session is closed")

    with pytest.raises(Exception, match="Session is closed"):
        _run_bottleneck_analysis(1, closed)
