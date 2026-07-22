from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.sigao_auth import AuthContext, check_project_access_or_sigao, require_jwt_or_sigao_key
from app.core.errors import api_error
from app.db.database import get_db
from app.models.models import Milestone, MilestoneStatus
from app.schemas.sigao_schemas import MilestoneCreate, MilestoneResponse, MilestoneUpdate
from app.services.project_events import record_project_event
from app.services.sigao_projects import get_project_or_404

router = APIRouter()


def _require_manager_if_jwt(auth: AuthContext) -> None:
    if auth.is_sigao_service:
        return
    if auth.user.role not in ("admin", "manager"):
        raise api_error(403, "PROJECT_MANAGER_REQUIRED", "Se requiere rol manager o superior")


@router.get("/{project_id}/milestones", response_model=list[MilestoneResponse])
def list_milestones(
    project_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_jwt_or_sigao_key),
):
    check_project_access_or_sigao(project_id, auth, db)
    get_project_or_404(db, project_id)
    milestones = (
        db.query(Milestone)
        .filter(Milestone.project_id == project_id)
        .order_by(Milestone.sort_order, Milestone.due_date)
        .all()
    )
    return milestones


@router.post(
    "/{project_id}/milestones",
    response_model=MilestoneResponse,
    status_code=201,
)
def create_milestone(
    project_id: int,
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_jwt_or_sigao_key),
):
    if not auth.is_sigao_service:
        _require_manager_if_jwt(auth)
    check_project_access_or_sigao(project_id, auth, db, require_ownership=True)
    get_project_or_404(db, project_id)

    milestone = Milestone(
        project_id=project_id,
        title=payload.title,
        due_date=payload.due_date,
        sort_order=payload.sort_order or 0,
        status=MilestoneStatus.pending,
    )
    db.add(milestone)
    db.flush()
    record_project_event(
        db,
        project_id=project_id,
        event_type="milestone_created",
        summary=f"Hito «{milestone.title}» creado",
        actor_name=payload.actor_name,
    )
    db.commit()
    db.refresh(milestone)
    return milestone


@router.patch("/{project_id}/milestones/{milestone_id}", response_model=MilestoneResponse)
def update_milestone(
    project_id: int,
    milestone_id: int,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_jwt_or_sigao_key),
):
    check_project_access_or_sigao(project_id, auth, db, require_ownership=True)
    get_project_or_404(db, project_id)

    milestone = (
        db.query(Milestone)
        .filter(Milestone.id == milestone_id, Milestone.project_id == project_id)
        .first()
    )
    if not milestone:
        raise api_error(404, "MILESTONE_NOT_FOUND", "Milestone not found")

    data = payload.model_dump(exclude_unset=True)
    actor_name = data.pop("actor_name", None)
    new_status = data.pop("status", None)

    for key, value in data.items():
        setattr(milestone, key, value)

    if new_status is not None:
        milestone.status = MilestoneStatus(new_status)
        if milestone.status == MilestoneStatus.completed:
            milestone.completed_at = datetime.now(timezone.utc)
            record_project_event(
                db,
                project_id=project_id,
                event_type="milestone_completed",
                summary=f"Hito «{milestone.title}» completado",
                actor_name=actor_name,
            )

    db.commit()
    db.refresh(milestone)
    return milestone


@router.delete("/{project_id}/milestones/{milestone_id}", status_code=204)
def delete_milestone(
    project_id: int,
    milestone_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_jwt_or_sigao_key),
):
    if not auth.is_sigao_service:
        _require_manager_if_jwt(auth)
    check_project_access_or_sigao(project_id, auth, db, require_ownership=True)

    milestone = (
        db.query(Milestone)
        .filter(Milestone.id == milestone_id, Milestone.project_id == project_id)
        .first()
    )
    if not milestone:
        raise api_error(404, "MILESTONE_NOT_FOUND", "Milestone not found")
    db.delete(milestone)
    db.commit()
    return None
