from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.sigao_auth import AuthContext, check_project_access_or_sigao, require_jwt_or_sigao_key
from app.db.database import get_db
from app.models.models import ProjectEvent
from app.schemas.sigao_schemas import ProjectEventResponse
from app.services.sigao_projects import get_project_or_404

router = APIRouter()


@router.get("/{project_id}/activity", response_model=list[ProjectEventResponse])
def list_project_activity(
    project_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_jwt_or_sigao_key),
):
    check_project_access_or_sigao(project_id, auth, db)
    get_project_or_404(db, project_id)
    events = (
        db.query(ProjectEvent)
        .filter(ProjectEvent.project_id == project_id)
        .order_by(ProjectEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return events
