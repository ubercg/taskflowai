from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Objective
from app.schemas.schemas import ObjectiveResponse, ObjectiveCreate, ObjectiveUpdate
from app.core.errors import api_error
from app.core.security import (
    require_authenticated,
    require_manager_or_above,
    check_project_access,
    accessible_project_ids,
)

router = APIRouter()

# Shared aggregation query; {where} is always an internal constant (never user input)
_PROGRESS_SELECT = """
    SELECT
        o.id,
        o.project_id,
        o.title,
        o.description,
        o.due_date,
        o.created_at,
        o.mode,
        CASE
            WHEN o.mode = 'manual' THEN COALESCE(o.progress_pct, 0)
            ELSE COALESCE(
                CAST(
                    ROUND(
                        100.0 * SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(t.id), 0)
                    ) AS INTEGER
                ),
                0
            )
        END AS progress
    FROM objectives o
    LEFT JOIN tasks t ON t.objective_id = o.id
    WHERE {where}
    GROUP BY o.id
"""


@router.get("", response_model=list[ObjectiveResponse])
def read_objectives(
    project_id: int = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    if project_id:
        check_project_access(project_id, current_user, db)
        where = "o.project_id = :project_id"
        params = {"project_id": project_id}
    else:
        accessible = accessible_project_ids(db, current_user)
        if accessible is not None:
            if not accessible:
                return []
            where = "o.project_id = ANY(:project_ids)"
            params = {"project_ids": accessible}
        else:
            where = "TRUE"
            params = {}

    rows = db.execute(
        text(
            _PROGRESS_SELECT.format(where=where)
            + " ORDER BY o.created_at DESC"
        ),
        params,
    ).mappings().all()
    return [ObjectiveResponse(**r) for r in rows]


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


@router.get("/{objective_id}", response_model=ObjectiveResponse)
def read_objective(
    objective_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    # 404 before access check — need project_id first
    obj = db.query(Objective).filter(Objective.id == objective_id).first()
    if not obj:
        raise api_error(404, "OBJECTIVE_NOT_FOUND", "Objective not found")
    check_project_access(obj.project_id, current_user, db)
    row = db.execute(
        text(_PROGRESS_SELECT.format(where="o.id = :objective_id")),
        {"objective_id": objective_id},
    ).mappings().first()
    return ObjectiveResponse(**row)


@router.patch("/{objective_id}", response_model=ObjectiveResponse)
def update_objective(
    objective_id: int,
    payload: ObjectiveUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    # 404 before 403 — fetch to get project_id for access check
    obj = db.query(Objective).filter(Objective.id == objective_id).first()
    if not obj:
        raise api_error(404, "OBJECTIVE_NOT_FOUND", "Objective not found")
    # Project manager membership (even with global developer) may edit — same
    # bar as archive / board manage.
    check_project_access(obj.project_id, current_user, db, require_ownership=True)
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and not data["title"].strip():
        raise api_error(422, "OBJECTIVE_TITLE_EMPTY", "El título no puede estar vacío")
    if "progress_pct" in data:
        if obj.mode != "manual":
            raise api_error(
                409,
                "OBJECTIVE_PROGRESS_IMMUTABLE",
                "El progreso de un KPI por hitos se deriva de las tareas, no se edita manualmente",
            )
    for k, v in data.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    row = db.execute(
        text(_PROGRESS_SELECT.format(where="o.id = :objective_id")),
        {"objective_id": objective_id},
    ).mappings().first()
    return ObjectiveResponse(**row)


@router.delete("/{objective_id}")
def delete_objective(
    objective_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    # 404 before 403
    obj = db.query(Objective).filter(Objective.id == objective_id).first()
    if not obj:
        raise api_error(404, "OBJECTIVE_NOT_FOUND", "Objective not found")
    check_project_access(obj.project_id, current_user, db, require_ownership=True)
    db.delete(obj)
    db.commit()
    return {"message": "Objective deleted"}
