import os
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.models.models import Task, Activity, TaskStatus, UserRole
from app.schemas.schemas import TaskMove, TaskResponse, TaskResponseFull
from app.modules.intelligence.bottleneck import analyze_bottleneck
from app.api.v1.endpoints.tasks_crud import router
from app.core.security import require_authenticated, check_project_access

WIP_LIMIT = int(os.getenv("WIP_LIMIT", "3"))


@router.patch("/{task_id}/move", response_model=TaskResponse)
def move_task(
    task_id: int,
    payload: TaskMove,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    task = db.query(Task).filter(Task.id == task_id).with_for_update().first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    check_project_access(task.project_id, current_user, db)

    if current_user.role == UserRole.viewer:
        raise HTTPException(403, "Viewers no pueden mover tareas")

    if current_user.role == UserRole.developer and task.assignee_id != current_user.id:
        raise HTTPException(403, "Solo puedes mover tus propias tareas")

    target_status = payload.status
    old_status = task.status

    # Si no hay cambio de status, solo actualizamos position y listo
    if target_status == old_status:
        if payload.position is not None:
            task.position = payload.position
            db.commit()
            db.refresh(task)
        return task

    # ==========================================
    # RN-01: Validar WIP Limit
    # ==========================================
    if target_status == TaskStatus.in_progress:
        # Si la tarea tiene assignee, usamos ese; si no, usamos el user_id del payload
        target_user_id = (
            task.assignee_id if task.assignee_id is not None else payload.user_id
        )

        if target_user_id is not None:
            # Contamos cuántas tareas en 'in_progress' tiene actualmente este usuario
            current_wip = (
                db.query(func.count(Task.id))
                .filter(
                    Task.assignee_id == target_user_id,
                    Task.status == TaskStatus.in_progress,
                    Task.id != task_id,  # Por si acaso
                )
                .scalar()
            )

            if current_wip >= WIP_LIMIT:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "detail": "WIP limit exceeded",
                        "code": "WIP_LIMIT_EXCEEDED",
                        "current_wip": current_wip,
                        "limit": WIP_LIMIT,
                    },
                )

    # ==========================================
    # RN-02: Validar Open Subtasks al mover a 'done'
    # ==========================================
    if target_status == TaskStatus.done:
        open_subtasks_count = (
            db.query(func.count(Task.id))
            .filter(Task.parent_id == task_id, Task.status != TaskStatus.done)
            .scalar()
        )

        if open_subtasks_count > 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "Existen subtareas abiertas",
                    "code": "OPEN_SUBTASKS",
                    "open_count": open_subtasks_count,
                },
            )

    # ==========================================
    # RN-04: Transacción atómica
    # Actualizar Tarea + Registrar Actividad
    # ==========================================
    try:
        # 1. Actualizamos la tarea
        task.status = target_status
        if payload.position is not None:
            task.position = payload.position

        # Actualizamos fechas según PRD
        if target_status == TaskStatus.in_progress and not task.start_date:
            task.start_date = func.now()
        elif target_status == TaskStatus.done:
            task.completed_at = func.now()

        # 2. Registramos la actividad (audit trail)
        new_activity = Activity(
            task_id=task.id,
            user_id=payload.user_id,  # El usuario que hizo la acción
            from_status=old_status,
            to_status=target_status,
        )
        db.add(new_activity)

        # 3. Commit transaccional (si falla, crashea y FastAPI hace rollback automático)
        db.commit()
        db.refresh(task)

        # 4. Phase 4: Disparar Bottleneck Detector de forma asíncrona (AI Layer)
        background_tasks.add_task(analyze_bottleneck, task.project_id, db)

        return task

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
