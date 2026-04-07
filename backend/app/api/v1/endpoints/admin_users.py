from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, text, func
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.models.models import User, UserRole, Task, TaskStatus, TimeLog
from app.core.security import require_admin, hash_password
from app.core.config import settings

router = APIRouter()

# --- Schemas específicos para Admin Users ---


class UserAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: str
    color: str
    is_active: bool
    created_at: datetime
    assigned_tasks_count: Optional[int] = 0
    total_logged_hours: Optional[float] = 0.0


class UserListResponse(BaseModel):
    items: List[UserAdminOut]
    total: int
    active: int
    inactive: int


class UserAdminCreate(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    color: str


class UserAdminUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class TaskAssignedOut(BaseModel):
    id: int
    title: str
    status: str
    priority: str
    project_id: int
    project_name: str


# --- Endpoints ---


@router.get("", response_model=UserListResponse)
def list_users(
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(User)

    if search:
        query = query.filter(
            or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"))
        )
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    users = query.all()

    # Calcular contadores
    total = db.query(User).count()
    active_count = db.query(User).filter(User.is_active == True).count()
    inactive_count = total - active_count

    # Calcular tareas asignadas y horas (de forma más óptima en DB con subqueries o joins,
    # pero para simplicidad del MVP podemos consultar o iterar, usamos query directa para la respuesta)
    items = []
    for u in users:
        tasks_cnt = db.query(Task).filter(Task.assignee_id == u.id).count()
        hours = (
            db.query(func.sum(TimeLog.hours)).filter(TimeLog.user_id == u.id).scalar()
            or 0.0
        )
        items.append(
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "color": u.color,
                "is_active": bool(u.is_active),
                "created_at": u.created_at,
                "assigned_tasks_count": tasks_cnt,
                "total_logged_hours": float(hours),
            }
        )

    return {
        "items": items,
        "total": total,
        "active": active_count,
        "inactive": inactive_count,
    }


@router.get("/{user_id}", response_model=UserAdminOut)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    tasks_cnt = db.query(Task).filter(Task.assignee_id == u.id).count()
    hours = (
        db.query(func.sum(TimeLog.hours)).filter(TimeLog.user_id == u.id).scalar()
        or 0.0
    )

    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "color": u.color,
        "is_active": bool(u.is_active),
        "created_at": u.created_at,
        "assigned_tasks_count": tasks_cnt,
        "total_logged_hours": float(hours),
    }


@router.post("", response_model=UserAdminOut)
def create_admin_user(
    payload: UserAdminCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")

    db_user = User(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        color=payload.color,
        is_active=True,
        password_hash=hash_password(settings.DEFAULT_NEW_USER_PASSWORD),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return {
        "id": db_user.id,
        "name": db_user.name,
        "email": db_user.email,
        "role": db_user.role,
        "color": db_user.color,
        "is_active": bool(db_user.is_active),
        "created_at": db_user.created_at,
        "assigned_tasks_count": 0,
        "total_logged_hours": 0.0,
    }


@router.patch("/{user_id}", response_model=UserAdminOut)
def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # No permitir que un admin se quite a sí mismo el rol admin
    if u.id == current_user.id and payload.role and payload.role != UserRole.admin:
        raise HTTPException(
            status_code=403, detail="No puedes quitarte el rol de admin a ti mismo"
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "email" in update_data:
        existing = (
            db.query(User)
            .filter(User.email == update_data["email"], User.id != user_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400, detail="Email ya en uso por otro usuario"
            )

    for key, value in update_data.items():
        setattr(u, key, value)

    db.commit()
    db.refresh(u)

    tasks_cnt = db.query(Task).filter(Task.assignee_id == u.id).count()
    hours = (
        db.query(func.sum(TimeLog.hours)).filter(TimeLog.user_id == u.id).scalar()
        or 0.0
    )

    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "color": u.color,
        "is_active": bool(u.is_active),
        "created_at": u.created_at,
        "assigned_tasks_count": tasks_cnt,
        "total_logged_hours": float(hours),
    }


@router.delete("/{user_id}")
def delete_admin_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=403, detail="No puedes eliminar tu propio usuario"
        )

    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if u.role == UserRole.admin:
        admin_count = db.query(User).filter(User.role == UserRole.admin).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="No se puede eliminar el único administrador del sistema",
            )

    try:
        db.delete(u)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar el usuario por restricciones en la base de datos",
        )

    return {"message": "Usuario eliminado", "id": user_id}


@router.patch("/{user_id}/toggle")
def toggle_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if u.id == current_user.id:
        raise HTTPException(
            status_code=403, detail="No puedes desactivar tu propio usuario"
        )

    new_state = not u.is_active

    # Si vamos a desactivar, validar in_progress tasks
    if not new_state:
        in_progress_count = (
            db.query(Task)
            .filter(
                Task.assignee_id == u.id,
                Task.status.in_([TaskStatus.in_progress, TaskStatus.review]),
            )
            .count()
        )
        if in_progress_count > 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "El usuario tiene tareas activas",
                    "code": "HAS_ACTIVE_TASKS",
                    "active_tasks": in_progress_count,
                    "suggestion": "Reasigna las tareas antes de desactivar",
                },
            )

    u.is_active = new_state
    db.commit()

    return {
        "id": u.id,
        "name": u.name,
        "is_active": bool(u.is_active),
        "message": "Usuario activado" if new_state else "Usuario desactivado",
    }


@router.get("/{user_id}/tasks", response_model=List[TaskAssignedOut])
def get_user_tasks(
    user_id: int,
    status: Optional[TaskStatus] = None,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = text(
        """
        SELECT t.id, t.title, t.status, t.priority, t.project_id, p.name as project_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.assignee_id = :user_id
        """
        + (" AND t.status = :status" if status else "")
        + (" AND t.project_id = :project_id" if project_id else "")
        + " ORDER BY t.created_at DESC"
    )

    params = {"user_id": user_id}
    if status:
        params["status"] = status
    if project_id:
        params["project_id"] = project_id

    results = db.execute(query, params).fetchall()

    return [
        {
            "id": r.id,
            "title": r.title,
            "status": r.status,
            "priority": r.priority,
            "project_id": r.project_id,
            "project_name": r.project_name,
        }
        for r in results
    ]


@router.get("/{user_id}/stats")
def get_user_stats(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Tasks stats using efficient single query
    stats_query = text("""
        SELECT
            COUNT(t.id)                                          AS total_tasks,
            COUNT(t.id) FILTER (WHERE t.status='done')           AS completed_tasks,
            COUNT(t.id) FILTER (WHERE t.status='in_progress')    AS in_progress_tasks,
            COUNT(t.id) FILTER (WHERE t.status='blocked')        AS blocked_tasks,
            COALESCE(SUM(t.logged_hours), 0)                     AS total_logged_hours,
            COALESCE(SUM(t.estimated_hours), 0)                  AS total_estimated_hours,
            ROUND(
                COUNT(t.id) FILTER (WHERE t.status='done')::numeric /
                NULLIF(COUNT(t.id), 0) * 100, 1
            )                                                    AS completion_rate
        FROM tasks t
        WHERE t.assignee_id = :user_id
    """)
    stats = db.execute(stats_query, {"user_id": user_id}).fetchone()

    # Projects info
    projects_query = text("""
        SELECT p.id, p.name, p.color, p.icon, pm.role
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = :user_id
    """)
    projects_results = db.execute(projects_query, {"user_id": user_id}).fetchall()

    projects_list = [
        {"id": r.id, "name": r.name, "color": r.color, "icon": r.icon, "role": r.role}
        for r in projects_results
    ]

    return {
        "total_tasks": int(stats.total_tasks) if stats.total_tasks else 0,
        "completed_tasks": int(stats.completed_tasks) if stats.completed_tasks else 0,
        "in_progress_tasks": int(stats.in_progress_tasks)
        if stats.in_progress_tasks
        else 0,
        "blocked_tasks": int(stats.blocked_tasks) if stats.blocked_tasks else 0,
        "total_logged_hours": float(stats.total_logged_hours),
        "total_estimated_hours": float(stats.total_estimated_hours),
        "completion_rate": float(stats.completion_rate)
        if stats.completion_rate
        else 0.0,
        "wip_current": int(stats.in_progress_tasks) if stats.in_progress_tasks else 0,
        "projects": projects_list,
    }
