from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Task, UserRole, Activity, User
from app.schemas.schemas import TaskResponseFull, TaskCreate, TaskUpdate
from app.core.security import (
    require_authenticated,
    require_manager_or_above,
    check_project_access,
)

router = APIRouter()


@router.get("", response_model=list[TaskResponseFull])
def read_tasks(
    project_id: int = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    query = db.query(Task)

    if project_id:
        check_project_access(project_id, current_user, db)
        query = query.filter(Task.project_id == project_id)

    if current_user.role == UserRole.developer:
        query = query.filter(Task.assignee_id == current_user.id)

    return query.order_by(Task.position).all()


@router.get("/{task_id}", response_model=TaskResponseFull)
def read_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    check_project_access(task.project_id, current_user, db)

    if current_user.role == UserRole.developer and task.assignee_id != current_user.id:
        raise HTTPException(403, "No puedes ver esta tarea")

    return task


@router.post("", response_model=TaskResponseFull)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    check_project_access(task.project_id, current_user, db)

    db_task = Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.patch("/{task_id}", response_model=TaskResponseFull)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    check_project_access(task.project_id, current_user, db)

    if current_user.role == UserRole.developer:
        if task.assignee_id != current_user.id:
            raise HTTPException(403, "No puedes editar esta tarea")
        # Restrict fields
        update_data = payload.model_dump(exclude_unset=True)
        allowed_fields = {"status", "logged_hours", "description"}
        for key in update_data.keys():
            if key not in allowed_fields:
                raise HTTPException(403, f"Developer no puede editar el campo {key}")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}/activities")
def read_task_activities(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    check_project_access(task.project_id, current_user, db)

    activities = (
        db.query(Activity, User.name.label("user_name"))
        .outerjoin(User, User.id == Activity.user_id)
        .filter(Activity.task_id == task_id)
        .order_by(Activity.created_at.desc())
        .all()
    )

    return [
        {
            "id": act.Activity.id,
            "task_id": act.Activity.task_id,
            "user_id": act.Activity.user_id,
            "user_name": act.user_name,
            "from_status": act.Activity.from_status,
            "to_status": act.Activity.to_status,
            "comment": act.Activity.comment,
            "created_at": act.Activity.created_at,
        }
        for act in activities
    ]


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    check_project_access(task.project_id, current_user, db)

    db.delete(task)
    db.commit()
    return {"ok": True}
