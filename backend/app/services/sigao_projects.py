from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.models import Milestone, Project, ProjectKpi, ProjectStatus
from app.schemas.sigao_schemas import (
    MilestoneResponse,
    ProjectKpiResponse,
    SigaoProjectResponse,
)


def get_project_by_external_uuid(db: Session, external_uuid: UUID) -> Project | None:
    return db.query(Project).filter(Project.external_uuid == external_uuid).first()


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")
    return project


def build_sigao_project_response(db: Session, project: Project) -> SigaoProjectResponse:
    kpis = (
        db.query(ProjectKpi)
        .filter(ProjectKpi.project_id == project.id)
        .order_by(ProjectKpi.sort_order, ProjectKpi.id)
        .all()
    )
    milestones = (
        db.query(Milestone)
        .filter(Milestone.project_id == project.id)
        .order_by(Milestone.sort_order, Milestone.due_date)
        .all()
    )
    status_value = (
        project.status.value
        if isinstance(project.status, ProjectStatus)
        else str(project.status)
    )
    return SigaoProjectResponse(
        id=project.id,
        external_uuid=project.external_uuid,
        name=project.name,
        description=project.description,
        project_type=project.project_type,
        responsible_name=project.responsible_name,
        status=status_value,
        start_date=project.start_date,
        end_date=project.end_date,
        budget_total=project.budget_total or 0,
        budget_spent=project.budget_spent or 0,
        color=project.color,
        icon=project.icon,
        created_at=project.created_at,
        kpis=[ProjectKpiResponse.model_validate(k) for k in kpis],
        milestones=[MilestoneResponse.model_validate(m) for m in milestones],
    )
