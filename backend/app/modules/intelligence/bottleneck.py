from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = ["backlog", "todo", "in_progress", "review", "blocked"]
BOTTLENECK_MULTIPLIER = 2.0  # si avg_hours > cycle_time * 2 → cuello
MIN_TASKS_FOR_ANALYSIS = 1  # mínimo de tareas para calcular


def analyze_bottleneck(project_id: int, db: Session) -> None:
    """
    Analiza el aging de tareas por columna en un proyecto.
    Compara contra el cycle_time histórico del proyecto.
    Persiste resultado en kanban_bottlenecks con UPSERT.

    Esta función corre en background — NUNCA lanzar excepciones
    que puedan romper el thread principal.
    """
    try:
        # 1. Obtener cycle_time promedio histórico del proyecto
        #    Calculado desde activities: tiempo promedio entre primer in_progress y done
        cycle_result = db.execute(
            text("""
            SELECT
                COALESCE(
                    AVG(
                        EXTRACT(EPOCH FROM (
                            done_time.created_at - start_time.created_at
                        )) / 3600
                    ), 24
                ) AS cycle_time_avg_h
            FROM (
                SELECT task_id, MIN(created_at) AS created_at
                FROM activities
                WHERE to_status = 'in_progress'
                GROUP BY task_id
            ) AS start_time
            JOIN (
                SELECT task_id, MIN(created_at) AS created_at
                FROM activities
                WHERE to_status = 'done'
                GROUP BY task_id
            ) AS done_time ON done_time.task_id = start_time.task_id
            JOIN tasks t ON t.id = start_time.task_id
            WHERE t.project_id = :project_id
        """),
            {"project_id": project_id},
        )

        row = cycle_result.mappings().first()
        cycle_time_avg_h = float(row["cycle_time_avg_h"]) if row else 24.0
        # Si no hay historial suficiente, usar 24h como baseline
        if cycle_time_avg_h < 1:
            cycle_time_avg_h = 24.0

        threshold = cycle_time_avg_h * BOTTLENECK_MULTIPLIER

        # 2. Calcular aging actual por columna
        #    Tiempo promedio desde created_at hasta ahora para tareas activas
        aging_result = db.execute(
            text("""
            SELECT
                t.status,
                COUNT(t.id) AS task_count,
                ROUND(
                    AVG(
                        EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600
                    )::numeric, 2
                ) AS avg_hours
            FROM tasks t
            WHERE t.project_id = :project_id
                AND t.status IN ('backlog','todo','in_progress','review','blocked')
                AND t.parent_id IS NULL
            GROUP BY t.status
        """),
            {"project_id": project_id},
        )

        aging_rows = aging_result.mappings().all()

        # 3. UPSERT en kanban_bottlenecks por cada status encontrado
        for row in aging_rows:
            status = row["status"]
            avg_hours = float(row["avg_hours"] or 0)
            task_count = int(row["task_count"])
            is_bottleneck = (
                task_count >= MIN_TASKS_FOR_ANALYSIS and avg_hours > threshold
            )

            db.execute(
                text("""
                INSERT INTO kanban_bottlenecks
                    (project_id, status, avg_hours, task_count, is_bottleneck, threshold_h, detected_at)
                VALUES
                    (:project_id, :status, :avg_hours, :task_count, :is_bottleneck, :threshold_h, NOW())
                ON CONFLICT (project_id, status) DO UPDATE SET
                    avg_hours     = EXCLUDED.avg_hours,
                    task_count    = EXCLUDED.task_count,
                    is_bottleneck = EXCLUDED.is_bottleneck,
                    threshold_h   = EXCLUDED.threshold_h,
                    detected_at   = NOW()
            """),
                {
                    "project_id": project_id,
                    "status": status,
                    "avg_hours": avg_hours,
                    "task_count": task_count,
                    "is_bottleneck": is_bottleneck,
                    "threshold_h": threshold,
                },
            )

        db.commit()
        logger.info(
            f"Bottleneck analysis done for project {project_id}. "
            f"Cycle time avg: {cycle_time_avg_h:.1f}h, threshold: {threshold:.1f}h"
        )

    except Exception as e:
        logger.error(f"BottleneckDetector error for project {project_id}: {e}")
        # NO re-lanzar — es background task
