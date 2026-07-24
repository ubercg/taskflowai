from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import (
    Project,
    ProjectMember,
    ProjectStatus,
    Task,
    TaskStatus,
)
from app.schemas.schemas import ProjectResponse, ProjectCreate, ProjectUpdate
from app.core.errors import api_error
from app.core.security import (
    require_authenticated,
    require_manager_or_above,
    check_project_access,
)
from app.api.v1.endpoints.objectives import count_incomplete_objectives

router = APIRouter()


def _archive_eligibility(db: Session, project_id: int) -> tuple[int, int]:
    """Return (open_tasks, incomplete_objectives). Both must be 0 to archive.

    Objective progress comes from objectives.count_incomplete_objectives (the
    canonical _PROGRESS_SELECT) so there is a single source of truth.
    """
    open_tasks = (
        db.query(func.count(Task.id))
        .filter(
            Task.project_id == project_id,
            Task.status != TaskStatus.done,
        )
        .scalar()
        or 0
    )
    incomplete = count_incomplete_objectives(db, project_id)
    return open_tasks, incomplete


@router.get("", response_model=list[ProjectResponse])
def read_projects(
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = Query(
        False,
        description="If false (default), exclude status=archived from the list.",
    ),
    status: str | None = Query(
        None,
        description="Optional exact status filter (overrides include_archived when set).",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    q = db.query(Project)
    if current_user.role != "admin":
        q = q.join(ProjectMember).filter(ProjectMember.user_id == current_user.id)
    if status is not None:
        try:
            q = q.filter(Project.status == ProjectStatus(status))
        except ValueError:
            raise api_error(
                422,
                "PROJECT_STATUS_INVALID",
                f"Invalid project status: {status}",
            )
    elif not include_archived:
        q = q.filter(Project.status != ProjectStatus.archived)
    return q.offset(skip).limit(limit).all()


@router.get("/{project_id}", response_model=ProjectResponse)
def read_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    check_project_access(project_id, current_user, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")
    return project


@router.post("", response_model=ProjectResponse)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    db_project = Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Auto-add creator as member
    member = ProjectMember(
        project_id=db_project.id, user_id=current_user.id, role=current_user.role
    )
    db.add(member)
    db.commit()

    return db_project


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    check_project_access(project_id, current_user, db, require_ownership=True)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")
    data = project_update.model_dump(exclude_unset=True)
    # TSK-027 / REQ-010 RN-003: archived only via POST .../archive.
    if data.get("status") in ("archived", ProjectStatus.archived):
        raise api_error(
            422,
            "PROJECT_ARCHIVE_USE_DEDICATED_PATH",
            "Archiving requires POST /projects/{id}/archive",
        )
    for k, v in data.items():
        if k == "status" and v is not None:
            setattr(project, k, ProjectStatus(v))
        else:
            setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/archive", response_model=ProjectResponse)
def archive_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    """Archive a project when all tasks are done and all objectives are at 100%.

    Authorization: global admin, or project membership with manager/admin role.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")

    if current_user.role != "admin":
        member = (
            db.query(ProjectMember)
            .filter_by(project_id=project_id, user_id=current_user.id)
            .first()
        )
        if not member or member.role not in ("admin", "manager"):
            raise api_error(
                403,
                "PROJECT_ARCHIVE_FORBIDDEN",
                "Solo admin global o manager del proyecto pueden archivar",
            )

    if project.status == ProjectStatus.archived:
        return project

    open_tasks, incomplete_objectives = _archive_eligibility(db, project_id)
    if open_tasks > 0 or incomplete_objectives > 0:
        raise api_error(
            422,
            "PROJECT_NOT_READY_TO_ARCHIVE",
            "Project has open tasks or incomplete objectives",
            open_tasks=open_tasks,
            incomplete_objectives=incomplete_objectives,
        )

    project.status = ProjectStatus.archived
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    if current_user.role != "admin":
        raise api_error(403, "PROJECT_DELETE_FORBIDDEN", "Solo admins pueden eliminar proyectos")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")
    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}


@router.get("/{project_id}/members")
def get_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    check_project_access(project_id, current_user, db)

    query = text("""
        SELECT u.id as user_id, u.name, u.email, u.color, pm.role
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = :project_id
    """)
    results = db.execute(query, {"project_id": project_id}).fetchall()

    return [
        {
            "id": r.user_id,
            "name": r.name,
            "email": r.email,
            "color": r.color,
            "role": r.role,
        }
        for r in results
    ]


@router.post("/{project_id}/members/{user_id}")
def add_project_member(
    project_id: int,
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    check_project_access(project_id, current_user, db, require_ownership=True)

    role = payload.get("role", "developer")

    member = ProjectMember(project_id=project_id, user_id=user_id, role=role)
    db.add(member)
    db.commit()

    return {"message": "Miembro añadido correctamente"}


@router.patch("/{project_id}/members/{user_id}")
def update_project_member_role(
    project_id: int,
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    check_project_access(project_id, current_user, db, require_ownership=True)

    role = payload.get("role")
    if not role:
        raise api_error(400, "PROJECT_ROLE_REQUIRED", "Role is required")

    member = (
        db.query(ProjectMember)
        .filter_by(project_id=project_id, user_id=user_id)
        .first()
    )
    if not member:
        raise api_error(404, "PROJECT_MEMBER_NOT_FOUND", "Miembro no encontrado en el proyecto")

    member.role = role
    db.commit()

    return {"message": "Rol actualizado correctamente"}


@router.delete("/{project_id}/members/{user_id}")
def remove_project_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    check_project_access(project_id, current_user, db, require_ownership=True)

    project = db.query(Project).filter(Project.id == project_id).first()
    # Check if user is the owner (if project owner logic exists)
    # Assuming owner is not removable, but the prompt says: "Regla UI: no mostrar botón ✕ si el miembro es el owner del proyecto". Here we can do a basic check if owner_id exists
    # If the schema had an owner_id, we'd check `if project.owner_id == user_id: raise 400`
    # As it's mostly UI, we trust the UI but it's better to add backend validation later if owner_id exists.

    member = (
        db.query(ProjectMember)
        .filter_by(project_id=project_id, user_id=user_id)
        .first()
    )
    if not member:
        raise api_error(404, "PROJECT_MEMBER_NOT_FOUND", "Miembro no encontrado en el proyecto")

    db.delete(member)
    db.commit()

    return {"message": "Miembro removido correctamente"}
