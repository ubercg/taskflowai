from typing import Optional, List

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, date

from app.db.database import get_db
from app.core.security import (
    require_manager_or_above,
    require_authenticated,
    check_project_access,
)
from app.core.errors import api_error
from app.models.models import Project, ProjectMember
from app.modules.intelligence.bottleneck import analyze_bottleneck

router = APIRouter()


def _validate_date_range(start_date: Optional[date], end_date: Optional[date]) -> None:
    """Raise HTTP 422 if start_date >= end_date."""
    if start_date is not None and end_date is not None:
        if start_date >= end_date:
            raise api_error(422, "METRICS_INVALID_DATE_RANGE", "start_date must be strictly before end_date")


def _ensure_project_exists(db: Session, project_id: Optional[int]) -> None:
    """Raise HTTP 404 if project_id is not None and no matching Project row exists."""
    if project_id is None:
        return
    project = db.get(Project, project_id)
    if project is None:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")


def _authorize_project_metrics(db: Session, project_id: int, current_user) -> None:
    """
    Gate for metrics scoped to a single project.

    Order matches projects.py: membership/admin first (403), then existence (404).
    Admins skip the membership check and still get 404 for unknown ids.
    Non-members get 403 even if the project does not exist (no existence leak).
    """
    check_project_access(project_id, current_user, db)
    _ensure_project_exists(db, project_id)


def _accessible_project_ids(db: Session, current_user) -> Optional[List[int]]:
    """
    Project ids the caller may see in org-wide metrics lists.

    Returns None for global admins (unrestricted). Returns [] when the user
    has no memberships.
    """
    if current_user.role == "admin":
        return None
    rows = (
        db.query(ProjectMember.project_id)
        .filter(ProjectMember.user_id == current_user.id)
        .all()
    )
    return [r[0] for r in rows]


@router.get("/flow")
def get_flow_metrics(
    project_id: int = Query(...),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    """
    Flow metrics (Lead Time, Cycle Time, Throughput, Efficiency Ratio).

    - Without start_date/end_date: reads all-time aggregates from the
      `flow_metrics` materialized view (backward-compatible).
    - With both dates: computes metrics on-the-fly using [start_date, end_date)
      half-open range.  Cycle time is derived from the FIRST activity with
      to_status='in_progress', NOT tasks.start_date.
    """
    _validate_date_range(start_date, end_date)
    _authorize_project_metrics(db, project_id, current_user)

    if start_date is None or end_date is None:
        # Legacy path: read from matview
        query = text("""
            SELECT project_id, lead_time_avg_h, cycle_time_avg_h,
                   throughput_week, efficiency_ratio, total_completed
            FROM flow_metrics
            WHERE project_id = :project_id
        """)
        result = db.execute(query, {"project_id": project_id}).fetchone()
        if result:
            return dict(result._mapping)
        return {
            "project_id": project_id,
            "lead_time_avg_h": 0.0,
            "cycle_time_avg_h": 0.0,
            "throughput_week": 0,
            "efficiency_ratio": 0.0,
            "total_completed": 0,
        }

    # Monthly path: on-the-fly queries against tasks + activities
    params = {
        "project_id": project_id,
        "start": start_date,
        "end": end_date,
    }

    flow_query = text("""
        SELECT
            AVG(
                EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 3600
            ) FILTER (WHERE t.completed_at IS NOT NULL) AS lead_time_avg_h,

            AVG(
                EXTRACT(EPOCH FROM (
                    t.completed_at - (
                        SELECT MIN(a.created_at)
                        FROM activities a
                        WHERE a.task_id = t.id AND a.to_status = 'in_progress'
                    )
                )) / 3600
            ) FILTER (WHERE t.completed_at IS NOT NULL) AS cycle_time_avg_h,

            COUNT(*) FILTER (
                WHERE t.status = 'done'
                  AND t.completed_at >= :start
                  AND t.completed_at < :end
            ) AS throughput,

            COALESCE(
                SUM(t.logged_hours) FILTER (
                    WHERE t.completed_at >= :start AND t.completed_at < :end
                ) / NULLIF(
                    SUM(t.estimated_hours) FILTER (
                        WHERE t.completed_at >= :start AND t.completed_at < :end
                    ),
                    0
                ) * 100,
                0
            ) AS efficiency_ratio
        FROM tasks t
        WHERE t.project_id = :project_id
          AND t.type = 'task'
          AND t.parent_id IS NULL
          AND t.completed_at >= :start
          AND t.completed_at < :end
    """)

    result = db.execute(flow_query, params).fetchone()

    if result is None:
        lead = None
        cycle = None
        throughput = 0
        efficiency = 0.0
    else:
        row = result._mapping
        lead = float(row["lead_time_avg_h"]) if row["lead_time_avg_h"] is not None else None
        cycle = float(row["cycle_time_avg_h"]) if row["cycle_time_avg_h"] is not None else None
        throughput = int(row["throughput"]) if row["throughput"] is not None else 0
        efficiency = float(row["efficiency_ratio"]) if row["efficiency_ratio"] is not None else 0.0

    return {
        "project_id": project_id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "lead_time_avg_h": lead,
        "cycle_time_avg_h": cycle,
        "throughput": throughput,
        "efficiency_ratio": efficiency,
    }


@router.get("/aging")
def get_aging(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    """
    Average time tasks have spent in each column (point-in-time, NOW).
    Derived from the last activity that moved the task into its current status,
    or created_at if no such activity exists.

    project_id is optional — without it, returns data for accessible projects
    (all projects for global admin; membership-scoped otherwise).
    Date params are accepted for API symmetry but ignored (aging is point-in-time).
    """
    if project_id is not None:
        _authorize_project_metrics(db, project_id, current_user)
        filters = "AND t.project_id = :project_id"
        params = {"project_id": project_id}
    else:
        accessible = _accessible_project_ids(db, current_user)
        if accessible is not None:
            if not accessible:
                return []
            filters = "AND t.project_id = ANY(:project_ids)"
            params = {"project_ids": accessible}
        else:
            filters = ""
            params = {}
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
    for r in rows:
        if r.get("avg_hours") is not None:
            r["avg_hours"] = float(r["avg_hours"])
    return rows


@router.get("/projects")
def get_projects_metrics(
    db: Session = Depends(get_db), current_user=Depends(require_authenticated)
):
    accessible = _accessible_project_ids(db, current_user)
    if accessible is not None and not accessible:
        return []

    if accessible is None:
        query = text("""
            SELECT project_id, total_tasks, completed_tasks, in_progress_tasks, blocked_tasks
            FROM project_metrics
        """)
        results = db.execute(query).fetchall()
    else:
        query = text("""
            SELECT project_id, total_tasks, completed_tasks, in_progress_tasks, blocked_tasks
            FROM project_metrics
            WHERE project_id = ANY(:project_ids)
        """)
        results = db.execute(query, {"project_ids": accessible}).fetchall()

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


@router.get("/velocity/team")
def get_team_velocity(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    """
    Org-wide team capacity velocity: per-user velocity aggregated across ALL projects.

    Restricted to global manager+ (matches UsersPage FE gate). Exposes individual
    performance across every project — too sensitive for developer/viewer.

    No project_id — covers every active user regardless of project.
    Without dates, defaults to current calendar month.
    With both dates, filters using [start_date, end_date) half-open range.

    Uses LEFT JOIN from users to tasks so every active user appears even with
    zero tasks (team-capacity view), unlike /velocity which uses INNER JOIN.
    """
    _validate_date_range(start_date, end_date)

    # Default to current calendar month if no date range provided
    if start_date is None or end_date is None:
        today = date.today()
        start_date = today.replace(day=1)
        if today.month == 12:
            end_date = today.replace(year=today.year + 1, month=1, day=1)
        else:
            end_date = today.replace(month=today.month + 1, day=1)

    params = {
        "start": start_date,
        "end": end_date,
    }

    result = db.execute(
        text("""
            SELECT
                u.id AS user_id,
                u.name,
                u.color,
                COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS in_progress,
                COUNT(t.id) FILTER (
                    WHERE t.status = 'done'
                      AND t.completed_at >= :start
                      AND t.completed_at < :end
                ) AS completed,
                COALESCE((
                    SELECT SUM(tl.hours)
                    FROM time_logs tl
                    WHERE tl.user_id = u.id
                      AND tl.log_date >= :start
                      AND tl.log_date < :end
                ), 0) AS total_hours
            FROM users u
            LEFT JOIN tasks t ON t.assignee_id = u.id
            WHERE u.is_active = true
            GROUP BY u.id, u.name, u.color
        """),
        params,
    )
    results = result.fetchall()

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


@router.get("/velocity")
def get_velocity_metrics(
    project_id: int = Query(...),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    """
    Velocity per user for the given project.

    project_id is now REQUIRED (breaking-minor, intentional: fixes scope).
    Without dates, defaults to current calendar month.
    With both dates, filters using [start_date, end_date) half-open range.

    Only users with tasks assigned to the project appear (INNER JOIN).
    Users not assigned to any task in the project are excluded.
    """
    _validate_date_range(start_date, end_date)
    _authorize_project_metrics(db, project_id, current_user)

    # Default to current calendar month if no date range provided
    if start_date is None or end_date is None:
        today = date.today()
        # First day of current month
        start_date = today.replace(day=1)
        # First day of next month (exclusive upper bound)
        if today.month == 12:
            end_date = today.replace(year=today.year + 1, month=1, day=1)
        else:
            end_date = today.replace(month=today.month + 1, day=1)

    params = {
        "project_id": project_id,
        "start": start_date,
        "end": end_date,
    }

    result = db.execute(
        text("""
            SELECT
                u.id AS user_id,
                u.name,
                u.color,
                COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS in_progress,
                COUNT(t.id) FILTER (
                    WHERE t.status = 'done'
                      AND t.completed_at >= :start
                      AND t.completed_at < :end
                ) AS completed,
                COALESCE((
                    SELECT SUM(tl.hours)
                    FROM time_logs tl
                    JOIN tasks t2 ON t2.id = tl.task_id
                    WHERE tl.user_id = u.id
                      AND t2.project_id = :project_id
                      AND tl.log_date >= :start
                      AND tl.log_date < :end
                ), 0) AS total_hours
            FROM users u
            JOIN tasks t ON t.assignee_id = u.id AND t.project_id = :project_id
            WHERE u.is_active = true
            GROUP BY u.id, u.name, u.color
        """),
        params,
    )
    results = result.fetchall()

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


@router.get("/burndown")
def get_burndown(
    project_id: int = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    """
    Daily burndown series for the given project and date range.

    Returns [{date, ideal, real}] with one point per calendar day in [start_date, end_date).
    Scope: tasks where due_date falls within [start_date, end_date), type='task',
    parent_id IS NULL. Tasks without due_date are excluded.

    ideal: linear descent from N to 0 across the period.
    real: N minus cumulative completed tasks (completed_at < end of day d).

    Empty scope (no tasks with due_date in range) returns a valid series of zeros.
    """
    _validate_date_range(start_date, end_date)
    _authorize_project_metrics(db, project_id, current_user)

    params = {
        "project_id": project_id,
        "start": start_date,
        "end": end_date,
    }

    query = text("""
        WITH params AS (
            SELECT
                CAST(:start AS date) AS s,
                CAST(:end AS date) AS e
        ),
        days AS (
            SELECT
                generate_series(p.s, p.e - INTERVAL '1 day', INTERVAL '1 day')::date AS d,
                (p.e - p.s) AS total_days,
                p.s AS s,
                p.e AS e
            FROM params p
        ),
        scope AS (
            SELECT t.id, t.completed_at
            FROM tasks t, params p
            WHERE t.project_id = :project_id
              AND t.type = 'task'
              AND t.parent_id IS NULL
              AND t.due_date >= p.s
              AND t.due_date < p.e
        ),
        total AS (SELECT COUNT(*)::int AS n FROM scope)
        SELECT
            to_char(days.d, 'YYYY-MM-DD') AS date,
            ROUND(
                (SELECT n FROM total)
                * (1 - (days.d - days.s)::numeric / NULLIF(days.total_days, 0)),
                2
            ) AS ideal,
            (
                (SELECT n FROM total) - (
                    SELECT COUNT(*) FROM scope sc
                    WHERE sc.completed_at IS NOT NULL
                      AND sc.completed_at < (days.d + INTERVAL '1 day')
                )
            )::int AS real
        FROM days
        ORDER BY days.d
    """)

    result = db.execute(query, params)
    rows = result.mappings().all()

    return [
        {
            "date": r["date"],
            "ideal": float(r["ideal"]) if r["ideal"] is not None else 0.0,
            "real": int(r["real"]) if r["real"] is not None else 0,
        }
        for r in rows
    ]


@router.get("/bottlenecks")
def get_bottlenecks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    _authorize_project_metrics(db, project_id, current_user)
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
    _authorize_project_metrics(db, project_id, current_user)
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
