from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Project, ProjectMember, ProjectStatus
from app.schemas.schemas import ProjectResponse, ProjectCreate, ProjectUpdate
from sqlalchemy import text
from app.core.security import (
    require_authenticated,
    require_manager_or_above,
    check_project_access,
)

router = APIRouter()


@router.get("", response_model=list[ProjectResponse])
def read_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    q = db.query(Project)
    if current_user.role != "admin":
        q = q.join(ProjectMember).filter(ProjectMember.user_id == current_user.id)
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
        raise HTTPException(status_code=404, detail="Project not found")
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
        raise HTTPException(404, "Project not found")
    data = project_update.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k == "status" and v is not None:
            setattr(project, k, ProjectStatus(v))
        else:
            setattr(project, k, v)
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
        raise HTTPException(403, "Solo admins pueden eliminar proyectos")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
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
        raise HTTPException(400, "Role is required")

    member = (
        db.query(ProjectMember)
        .filter_by(project_id=project_id, user_id=user_id)
        .first()
    )
    if not member:
        raise HTTPException(404, "Miembro no encontrado en el proyecto")

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
        raise HTTPException(404, "Miembro no encontrado en el proyecto")

    db.delete(member)
    db.commit()

    return {"message": "Miembro removido correctamente"}
