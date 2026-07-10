from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.sigao_auth import AuthContext, check_project_access_or_sigao, require_jwt_or_sigao_key
from app.db.database import get_db
from app.models.models import ProjectKpi
from app.schemas.sigao_schemas import ProjectKpiCreate, ProjectKpiResponse, ProjectKpiUpdate
from app.services.project_events import record_project_event
from app.services.sigao_projects import get_project_or_404

router = APIRouter()


def _require_manager_if_jwt(auth: AuthContext) -> None:
    if auth.is_sigao_service:
        return
    if auth.user.role not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Se requiere rol manager o superior",
        )


@router.get("/{project_id}/kpis", response_model=list[ProjectKpiResponse])
def list_project_kpis(
    project_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_jwt_or_sigao_key),
):
    check_project_access_or_sigao(project_id, auth, db)
    get_project_or_404(db, project_id)
    kpis = (
        db.query(ProjectKpi)
        .filter(ProjectKpi.project_id == project_id)
        .order_by(ProjectKpi.sort_order, ProjectKpi.id)
        .all()
    )
    return kpis


@router.post(
    "/{project_id}/kpis",
    response_model=ProjectKpiResponse,
    status_code=201,
)
def create_project_kpi(
    project_id: int,
    payload: ProjectKpiCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_jwt_or_sigao_key),
):
    if not auth.is_sigao_service:
        _require_manager_if_jwt(auth)
    check_project_access_or_sigao(project_id, auth, db, require_ownership=True)
    get_project_or_404(db, project_id)

    kpi = ProjectKpi(
        project_id=project_id,
        name=payload.name,
        unit=payload.unit,
        target_value=payload.target_value,
        current_value=payload.current_value,
        sort_order=payload.sort_order or 0,
    )
    db.add(kpi)
    db.flush()
    record_project_event(
        db,
        project_id=project_id,
        event_type="kpi_created",
        summary=f"KPI «{kpi.name}» creado",
        actor_name=payload.actor_name,
    )
    db.commit()
    db.refresh(kpi)
    return kpi


@router.patch("/{project_id}/kpis/{kpi_id}", response_model=ProjectKpiResponse)
def update_project_kpi(
    project_id: int,
    kpi_id: int,
    payload: ProjectKpiUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_jwt_or_sigao_key),
):
    check_project_access_or_sigao(project_id, auth, db, require_ownership=True)
    get_project_or_404(db, project_id)

    kpi = (
        db.query(ProjectKpi)
        .filter(ProjectKpi.id == kpi_id, ProjectKpi.project_id == project_id)
        .first()
    )
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")

    data = payload.model_dump(exclude_unset=True)
    actor_name = data.pop("actor_name", None)
    for key, value in data.items():
        setattr(kpi, key, value)

    if "current_value" in data or "name" in data:
        record_project_event(
            db,
            project_id=project_id,
            event_type="kpi_updated",
            summary=f"KPI «{kpi.name}» actualizado a {kpi.current_value}",
            actor_name=actor_name,
            payload={"kpi_id": kpi_id, "current_value": str(kpi.current_value)},
        )

    db.commit()
    db.refresh(kpi)
    return kpi


@router.delete("/{project_id}/kpis/{kpi_id}", status_code=204)
def delete_project_kpi(
    project_id: int,
    kpi_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_jwt_or_sigao_key),
):
    if not auth.is_sigao_service:
        _require_manager_if_jwt(auth)
    check_project_access_or_sigao(project_id, auth, db, require_ownership=True)

    kpi = (
        db.query(ProjectKpi)
        .filter(ProjectKpi.id == kpi_id, ProjectKpi.project_id == project_id)
        .first()
    )
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    db.delete(kpi)
    db.commit()
    return None
