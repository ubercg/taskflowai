from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import TimeLog, Task, UserRole
from app.schemas.schemas import TimeLogResponse, TimeLogCreate
from app.core.security import require_authenticated

router = APIRouter()


@router.get("", response_model=list[TimeLogResponse])
def read_timelogs(
    task_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
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
        raise HTTPException(403, "Viewers no pueden registrar tiempo")

    task = db.query(Task).filter(Task.id == log.task_id).with_for_update().first()
    if not task:
        raise HTTPException(404, "Task no encontrada")

    if current_user.role == UserRole.developer and task.assignee_id != current_user.id:
        raise HTTPException(403, "Developers solo pueden registrar horas en sus tareas")

    db_log = TimeLog(**log.model_dump())
    db_log.user_id = current_user.id  # Aseguramos user_id
    db.add(db_log)

    # Actualizar las horas logeadas totales en el Task
    from decimal import Decimal

    task.logged_hours = (task.logged_hours or Decimal("0.0")) + Decimal(str(log.hours))

    db.commit()
    db.refresh(db_log)
    return db_log
