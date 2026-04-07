from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.security import require_authenticated, require_manager_or_above
from app.modules.intelligence.daily_summary import generate_daily_summary

router = APIRouter()


@router.get("/daily-summary")
def daily_summary(
    project_id: int = Query(..., description="ID del proyecto"),
    refresh: bool = Query(False, description="Forzar regeneración ignorando cache"),
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    """
    Genera o retorna del cache el resumen del día del proyecto.
    Solo accesible para admin y manager.
    """
    return generate_daily_summary(project_id, db, force_refresh=refresh)


@router.get("/bottleneck-status")
def bottleneck_status(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    """Retorna estado actual de cuellos de botella (proxy a metrics)."""
    from sqlalchemy import text

    result = db.execute(
        text("""
        SELECT status, avg_hours, task_count, is_bottleneck, threshold_h, detected_at
        FROM kanban_bottlenecks
        WHERE project_id = :pid
        ORDER BY avg_hours DESC
    """),
        {"pid": project_id},
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows] if rows else []
