from typing import Optional

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime

from app.db.database import get_db
from app.core.security import require_manager_or_above, require_authenticated
from app.modules.intelligence.bottleneck import analyze_bottleneck

router = APIRouter()


@router.get("/flow")
def get_flow_metrics(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    query = text("""
        SELECT project_id, lead_time_avg_h, cycle_time_avg_h, throughput_week, efficiency_ratio, total_completed
        FROM flow_metrics
        WHERE project_id = :project_id
    """)
    result = db.execute(query, {"project_id": project_id}).fetchone()

    if result:
        return dict(result._mapping)

    # Si no hay datos (proyecto nuevo o sin finalizar), retorna zeros
    return {
        "project_id": project_id,
        "lead_time_avg_h": 0.0,
        "cycle_time_avg_h": 0.0,
        "throughput_week": 0,
        "efficiency_ratio": 0.0,
        "total_completed": 0,
    }


@router.get("/aging")
def get_aging(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    """Tiempo promedio en cada columna desde la última vez que la tarea entró a ese estado (activities), o created_at si no hay historial."""
    filters = "AND t.project_id = :project_id" if project_id is not None else ""
    params = {"project_id": project_id} if project_id is not None else {}
    result = db.execute(
        text(f"""
      SELECT
        t.status::text AS status,
        COUNT(t.id) AS task_count,
        ROUND(AVG(
          EXTRACT(EPOCH FROM (
            NOW() - COALESCE(lm.last_to_status_at, t.created_at)
          )) / 3600
        )::numeric, 1) AS avg_hours
      FROM tasks t
      LEFT JOIN LATERAL (
        SELECT MAX(a.created_at) AS last_to_status_at
        FROM activities a
        WHERE a.task_id = t.id AND a.to_status = t.status
      ) lm ON true
      WHERE t.status != 'done'
        AND t.parent_id IS NULL
        {filters}
      GROUP BY t.status
      ORDER BY avg_hours DESC
    """),
        params,
    )
    rows = [dict(r) for r in result.mappings().all()]
    # Recharts espera avg_hours numérico
    for r in rows:
        if r.get("avg_hours") is not None:
            r["avg_hours"] = float(r["avg_hours"])
    return rows


@router.get("/projects")
def get_projects_metrics(
    db: Session = Depends(get_db), current_user=Depends(require_authenticated)
):
    query = text("""
        SELECT project_id, total_tasks, completed_tasks, in_progress_tasks, blocked_tasks
        FROM project_metrics
    """)
    results = db.execute(query).fetchall()

    return [
        {
            "project_id": r.project_id,
            "total_tasks": int(r.total_tasks) if r.total_tasks else 0,
            "completed_tasks": int(r.completed_tasks) if r.completed_tasks else 0,
            "in_progress_tasks": int(r.in_progress_tasks) if r.in_progress_tasks else 0,
            "blocked_tasks": int(r.blocked_tasks) if r.blocked_tasks else 0,
            "completion_percentage": round((r.completed_tasks / r.total_tasks * 100), 0)
            if r.total_tasks and r.total_tasks > 0
            else 0,
        }
        for r in results
    ]


@router.get("/velocity")
def get_velocity_metrics(
    db: Session = Depends(get_db), current_user=Depends(require_authenticated)
):
    query = text("""
        SELECT 
            u.id as user_id, 
            u.name,
            u.color,
            COUNT(t.id) FILTER (WHERE t.status = 'in_progress') as in_progress,
            COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.completed_at >= CURRENT_DATE) as completed,
            COALESCE((
                SELECT SUM(tl.hours)
                FROM time_logs tl
                WHERE tl.user_id = u.id AND tl.log_date >= date_trunc('week', CURRENT_DATE)
            ), 0) as total_hours
        FROM users u
        LEFT JOIN tasks t ON t.assignee_id = u.id
        WHERE u.is_active = true
        GROUP BY u.id, u.name, u.color
    """)
    results = db.execute(query).fetchall()

    return [
        {
            "user_id": r.user_id,
            "name": r.name,
            "color": r.color,
            "in_progress": int(r.in_progress) if r.in_progress else 0,
            "completed": int(r.completed) if r.completed else 0,
            "total_hours": float(r.total_hours) if r.total_hours else 0.0,
        }
        for r in results
    ]


@router.get("/bottlenecks")
def get_bottlenecks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    result = db.execute(
        text("""
      SELECT status, avg_hours, task_count, is_bottleneck, threshold_h, detected_at
      FROM kanban_bottlenecks
      WHERE project_id = :project_id
      ORDER BY avg_hours DESC
    """),
        {"project_id": project_id},
    )
    rows = result.mappings().all()

    # Si no hay datos aún, retornar estructura vacía (no 404)
    if not rows:
        return [
            {
                "status": s,
                "avg_hours": 0,
                "task_count": 0,
                "is_bottleneck": False,
                "threshold_h": 0,
                "detected_at": None,
            }
            for s in ["backlog", "todo", "in_progress", "review", "blocked"]
        ]
    return [dict(r) for r in rows]


@router.post("/trigger-analysis")
def trigger_bottleneck_analysis(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    background_tasks.add_task(analyze_bottleneck, project_id, db)
    return {"message": "Análisis iniciado en background", "project_id": project_id}


@router.post("/refresh")
def refresh_metrics(
    db: Session = Depends(get_db), current_user=Depends(require_manager_or_above)
):
    try:
        db.execute(text("SELECT refresh_flow_metrics()"))
        db.commit()
        return {"refreshed": True, "at": datetime.utcnow().isoformat()}
    except Exception as e:
        db.rollback()
        return {"refreshed": False, "error": str(e)}
