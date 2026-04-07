from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Objective
from app.schemas.schemas import ObjectiveResponse, ObjectiveCreate
from app.core.security import (
    require_authenticated,
    require_manager_or_above,
    check_project_access,
)

router = APIRouter()


@router.get("", response_model=list[ObjectiveResponse])
def read_objectives(
    project_id: int = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    query = db.query(Objective)
    if project_id:
        check_project_access(project_id, current_user, db)
        query = query.filter(Objective.project_id == project_id)
    return query.all()


@router.post("", response_model=ObjectiveResponse)
def create_objective(
    objective: ObjectiveCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    check_project_access(objective.project_id, current_user, db)
    db_obj = Objective(**objective.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj
