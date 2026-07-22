from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import TimeLog, Task, UserRole
from app.schemas.schemas import TimeLogResponse, TimeLogCreate
from app.core.security import require_authenticated, check_project_access
from app.core.errors import api_error

router = APIRouter()


def _resolve_task_for_timelog(db: Session, task_id: int, current_user, *, for_update: bool = False):
    """
    Load a task and enforce project membership.

    Same existence/access rule as the metrics gate (TSK-002 / TSK-003):
    non-admins get identical 403 for "missing" and "not yours" so task ids
    are not enumerable. Admins see a real 404 when the row is absent.
    """
    query = db.query(Task).filter(Task.id == task_id)
    if for_update:
        query = query.with_for_update()
    task = query.first()
    if not task:
        if current_user.role == "admin":
            raise api_error(404, "TASK_NOT_FOUND", "Task no encontrada")
        raise api_error(403, "PROJECT_ACCESS_DENIED", "No tienes acceso a este proyecto")
    check_project_access(task.project_id, current_user, db)
    return task


@router.get("", response_model=list[TimeLogResponse])
def read_timelogs(
    task_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    _resolve_task_for_timelog(db, task_id, current_user)

    return (
        db.query(TimeLog)
        .filter(TimeLog.task_id == task_id)
        .order_by(TimeLog.created_at.desc())
        .all()
    )


@router.post("", response_model=TimeLogResponse)
def create_timelog(
    log: TimeLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    if current_user.role == UserRole.viewer:
        raise api_error(403, "TIMELOG_VIEWER_FORBIDDEN", "Viewers no pueden registrar tiempo")

    task = _resolve_task_for_timelog(db, log.task_id, current_user, for_update=True)

    if current_user.role == UserRole.developer and task.assignee_id != current_user.id:
        raise api_error(403, "TIMELOG_OWN_ONLY", "Developers solo pueden registrar horas en sus tareas")

    db_log = TimeLog(**log.model_dump())
    db_log.user_id = current_user.id  # Aseguramos user_id
    db.add(db_log)

    task.logged_hours = (task.logged_hours or Decimal("0.0")) + Decimal(str(log.hours))

    db.commit()
    db.refresh(db_log)
    return db_log
