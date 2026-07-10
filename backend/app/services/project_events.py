from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.models import ProjectEvent


def record_project_event(
    db: Session,
    *,
    project_id: int,
    event_type: str,
    summary: str,
    actor_name: str | None = None,
    payload: dict[str, Any] | None = None,
) -> ProjectEvent:
    event = ProjectEvent(
        project_id=project_id,
        event_type=event_type,
        actor_name=actor_name,
        summary=summary,
        payload=payload,
    )
    db.add(event)
    return event


def decimal_to_float(value: Decimal | None) -> float:
    if value is None:
        return 0.0
    return float(value)
