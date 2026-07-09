from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core.sigao_auth import verify_sigao_api_key
from app.db.database import get_db
from app.models.models import Milestone, Project, ProjectKpi, ProjectStatus
from app.schemas.sigao_schemas import (
    SigaoProjectCreate,
    SigaoProjectResponse,
    SigaoProjectUpdate,
)
from app.services.project_events import record_project_event
from app.services.sigao_projects import (
    build_sigao_project_response,
    get_project_by_external_uuid,
)

router = APIRouter(dependencies=[Depends(verify_sigao_api_key)])


def _apply_status(project: Project, status: str | None) -> None:
    if status is not None:
        project.status = ProjectStatus(status)


@router.post("/projects", response_model=SigaoProjectResponse)
def create_sigao_project(
    payload: SigaoProjectCreate,
    response: Response,
    db: Session = Depends(get_db),
):
    existing = get_project_by_external_uuid(db, payload.external_uuid)
    if existing:
        response.status_code = 200
        return build_sigao_project_response(db, existing)

    response.status_code = 201

    project = Project(
        external_uuid=payload.external_uuid,
        name=payload.name,
        description=payload.description,
        project_type=payload.project_type,
        responsible_name=payload.responsible_name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        budget_total=payload.budget_total,
        budget_spent=payload.budget_spent,
        status=ProjectStatus(payload.status or "active"),
    )
    db.add(project)
    db.flush()

    if payload.initial_kpi:
        kpi = ProjectKpi(
            project_id=project.id,
            name=payload.initial_kpi.name,
            unit=payload.initial_kpi.unit,
            target_value=payload.initial_kpi.target_value,
            current_value=payload.initial_kpi.current_value,
            sort_order=0,
        )
        db.add(kpi)

    record_project_event(
        db,
        project_id=project.id,
        event_type="project_created",
        summary=f"Proyecto «{project.name}» creado desde SIGAO",
        actor_name=payload.actor_name,
    )
    db.commit()
    db.refresh(project)
    return build_sigao_project_response(db, project)


@router.get("/projects", response_model=list[SigaoProjectResponse])
def list_sigao_projects(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Project).filter(Project.external_uuid.isnot(None))
    if status:
        q = q.filter(Project.status == ProjectStatus(status))
    projects = q.order_by(Project.created_at.desc()).all()
    return [build_sigao_project_response(db, p) for p in projects]


@router.get("/projects/{external_uuid}", response_model=SigaoProjectResponse)
def get_sigao_project(external_uuid: UUID, db: Session = Depends(get_db)):
    project = get_project_by_external_uuid(db, external_uuid)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return build_sigao_project_response(db, project)


@router.patch("/projects/{external_uuid}", response_model=SigaoProjectResponse)
def update_sigao_project(
    external_uuid: UUID,
    payload: SigaoProjectUpdate,
    db: Session = Depends(get_db),
):
    project = get_project_by_external_uuid(db, external_uuid)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    data = payload.model_dump(exclude_unset=True)
    actor_name = data.pop("actor_name", None)
    status = data.pop("status", None)
    for key, value in data.items():
        setattr(project, key, value)
    _apply_status(project, status)

    record_project_event(
        db,
        project_id=project.id,
        event_type="project_updated",
        summary=f"Proyecto «{project.name}» actualizado desde SIGAO",
        actor_name=actor_name,
        payload={"fields": list(data.keys())},
    )
    db.commit()
    db.refresh(project)
    return build_sigao_project_response(db, project)


@router.delete("/projects/{external_uuid}", status_code=204)
def delete_sigao_project(external_uuid: UUID, db: Session = Depends(get_db)):
    project = get_project_by_external_uuid(db, external_uuid)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return None
