"""Structured API error envelope for TaskFlow.

FastAPI wraps HTTPException.detail as ``{"detail": <payload>}``.
Callers MUST raise via ``api_error`` so the client always receives:

    {"detail": {"code": "SOME_CODE", "detail": "human message", ...extras}}

Existing codes ``WIP_LIMIT_EXCEEDED``, ``OPEN_SUBTASKS``, and
``HAS_ACTIVE_TASKS`` are frozen — do not rename them.
"""
from __future__ import annotations

from typing import Any, Mapping, Optional

from fastapi import HTTPException


def api_error(
    status_code: int,
    code: str,
    detail: str,
    *,
    headers: Optional[Mapping[str, str]] = None,
    **extra: Any,
) -> HTTPException:
    """Build an HTTPException with a stable machine-readable envelope."""
    payload: dict[str, Any] = {"code": code, "detail": detail}
    if extra:
        payload.update(extra)
    return HTTPException(status_code=status_code, detail=payload, headers=headers)
