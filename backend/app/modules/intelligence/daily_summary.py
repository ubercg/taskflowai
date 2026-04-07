from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
import os, logging, json

logger = logging.getLogger(__name__)

# Cache simple en memoria: { project_id: { "data": {...}, "expires_at": datetime } }
_summary_cache: dict = {}
CACHE_TTL_MINUTES = 60


def _is_cache_valid(project_id: int) -> bool:
    entry = _summary_cache.get(project_id)
    if not entry:
        return False
    return datetime.utcnow() < entry["expires_at"]


def _get_from_cache(project_id: int) -> dict:
    return _summary_cache[project_id]["data"]


def _set_cache(project_id: int, data: dict) -> None:
    _summary_cache[project_id] = {
        "data": data,
        "expires_at": datetime.utcnow() + timedelta(minutes=CACHE_TTL_MINUTES),
    }


def generate_daily_summary(
    project_id: int, db: Session, force_refresh: bool = False
) -> dict:
    """
    Genera el resumen del día para un proyecto.
    Usa cache de 60 minutos. Con force_refresh=True regenera.
    """
    if not force_refresh and _is_cache_valid(project_id):
        logger.info(f"Daily summary served from cache for project {project_id}")
        return _get_from_cache(project_id)

    try:
        # 1. TAREAS QUE AVANZARON HOY (activities de las últimas 24h)
        advanced_result = db.execute(
            text("""
            SELECT DISTINCT ON (a.task_id)
                a.task_id,
                t.title,
                a.from_status,
                a.to_status,
                a.created_at AS moved_at
            FROM activities a
            JOIN tasks t ON t.id = a.task_id
            WHERE t.project_id = :project_id
                AND a.created_at >= NOW() - INTERVAL '24 hours'
                AND a.to_status != 'blocked'
            ORDER BY a.task_id, a.created_at DESC
        """),
            {"project_id": project_id},
        )

        advanced = [
            {
                "task_id": r["task_id"],
                "title": r["title"],
                "from_status": r["from_status"],
                "to_status": r["to_status"],
                "moved_at": r["moved_at"].isoformat() if r["moved_at"] else None,
            }
            for r in advanced_result.mappings().all()
        ]

        # 2. TAREAS BLOQUEADAS ACTUALMENTE
        blocked_result = db.execute(
            text("""
            SELECT
                t.id AS task_id,
                t.title,
                ROUND(
                    EXTRACT(EPOCH FROM (
                        NOW() - COALESCE(lm.last_blocked_at, t.created_at)
                    )) / 3600
                )::int AS hours_blocked,
                u.name AS assignee_name
            FROM tasks t
            LEFT JOIN users u ON u.id = t.assignee_id
            LEFT JOIN LATERAL (
                SELECT MAX(a.created_at) AS last_blocked_at
                FROM activities a
                WHERE a.task_id = t.id AND a.to_status = 'blocked'
            ) lm ON true
            WHERE t.project_id = :project_id
                AND t.status = 'blocked'
                AND t.parent_id IS NULL
            ORDER BY COALESCE(lm.last_blocked_at, t.created_at) ASC
        """),
            {"project_id": project_id},
        )

        blocked = [
            {
                "task_id": r["task_id"],
                "title": r["title"],
                "blocked_since": f"{r['hours_blocked']}h"
                if r["hours_blocked"]
                else "reciente",
                "assignee": r["assignee_name"] or "Sin asignar",
            }
            for r in blocked_result.mappings().all()
        ]

        # 3. TAREAS EN RIESGO (logged_hours > estimated o vencidas)
        risks_result = db.execute(
            text("""
            SELECT
                t.id AS task_id,
                t.title,
                t.estimated_hours,
                t.logged_hours,
                t.due_date,
                t.status,
                u.name AS assignee_name,
                CASE
                    WHEN t.logged_hours > t.estimated_hours AND t.estimated_hours IS NOT NULL
                        THEN 'Horas registradas superan lo estimado'
                    WHEN t.due_date < CURRENT_DATE AND t.status != 'done'
                        THEN 'Fecha límite vencida'
                    WHEN t.due_date = CURRENT_DATE AND t.status != 'done'
                        THEN 'Vence hoy'
                END AS reason
            FROM tasks t
            LEFT JOIN users u ON u.id = t.assignee_id
            WHERE t.project_id = :project_id
                AND t.status != 'done'
                AND t.parent_id IS NULL
                AND (
                    (t.logged_hours > t.estimated_hours AND t.estimated_hours IS NOT NULL)
                    OR (t.due_date <= CURRENT_DATE)
                )
            ORDER BY t.due_date ASC NULLS LAST
            LIMIT 10
        """),
            {"project_id": project_id},
        )

        risks = [
            {
                "task_id": r["task_id"],
                "title": r["title"],
                "reason": r["reason"],
                "assignee": r["assignee_name"] or "Sin asignar",
            }
            for r in risks_result.mappings().all()
        ]

        # 4. STATS DEL DÍA
        stats_result = db.execute(
            text("""
            SELECT
                COUNT(DISTINCT a.task_id) AS total_moves,
                COUNT(DISTINCT a.task_id) FILTER (WHERE a.to_status = 'done') AS completed_today
            FROM activities a
            JOIN tasks t ON t.id = a.task_id
            WHERE t.project_id = :project_id
                AND a.created_at >= NOW() - INTERVAL '24 hours'
        """),
            {"project_id": project_id},
        )

        stats_row = stats_result.mappings().first()
        stats = {
            "total_moves": int(stats_row["total_moves"] or 0),
            "completed_today": int(stats_row["completed_today"] or 0),
            "blocked_count": len(blocked),
            "at_risk_count": len(risks),
        }

        # 5. GENERAR summary_text
        summary_text = _generate_summary_text(advanced, blocked, risks, stats)

        # 6. Intentar mejorar con LLM si hay API key (Gemini / Google AI)
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            try:
                summary_text = _enhance_with_llm(
                    advanced, blocked, risks, stats, summary_text, api_key
                )
            except Exception as llm_err:
                logger.warning(f"LLM enhancement failed, using rule-based: {llm_err}")

        result = {
            "project_id": project_id,
            "generated_at": datetime.utcnow().isoformat(),
            "advanced": advanced,
            "blocked": blocked,
            "risks": risks,
            "summary_text": summary_text,
            "stats": stats,
        }

        _set_cache(project_id, result)
        return result

    except Exception as e:
        logger.error(f"Error generating daily summary for project {project_id}: {e}")
        return {
            "project_id": project_id,
            "generated_at": datetime.utcnow().isoformat(),
            "advanced": [],
            "blocked": [],
            "risks": [],
            "summary_text": "No se pudo generar el resumen. Intenta nuevamente.",
            "stats": {
                "total_moves": 0,
                "completed_today": 0,
                "blocked_count": 0,
                "at_risk_count": 0,
            },
        }


def _generate_summary_text(advanced, blocked, risks, stats) -> str:
    """Genera resumen en lenguaje natural en español sin LLM."""
    parts = []

    if stats["completed_today"] > 0:
        parts.append(f"Hoy se completaron {stats['completed_today']} tarea(s).")
    if stats["total_moves"] > 0:
        parts.append(
            f"Se registraron {stats['total_moves']} movimiento(s) en el tablero."
        )
    if blocked:
        nombres = [b["title"][:30] for b in blocked[:2]]
        sufijo = f" y {len(blocked) - 2} más" if len(blocked) > 2 else ""
        parts.append(
            f"{len(blocked)} tarea(s) bloqueada(s): {', '.join(nombres)}{sufijo}."
        )
    if risks:
        parts.append(
            f"{len(risks)} tarea(s) en riesgo por fechas vencidas o horas superadas."
        )
    if not parts:
        parts.append("Sin actividad registrada en las últimas 24 horas.")

    return " ".join(parts)


def _enhance_with_llm(advanced, blocked, risks, stats, fallback_text, api_key) -> str:
    """Llama a Gemini para generar un resumen más natural."""
    from google import genai

    client = genai.Client(api_key=api_key)

    prompt = f"""Eres un asistente de gestión de proyectos. Genera un resumen ejecutivo 
en español (máximo 3 oraciones) sobre la actividad del proyecto hoy.

Datos:
- Tareas completadas hoy: {stats["completed_today"]}
- Movimientos en tablero: {stats["total_moves"]}  
- Tareas bloqueadas: {stats["blocked_count"]}
- Tareas en riesgo: {stats["at_risk_count"]}
- Avances principales: {[a["title"] for a in advanced[:3]]}
- Bloqueadas: {[b["title"] for b in blocked[:2]]}

Responde SOLO el resumen, sin saludos ni explicaciones."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error en Gemini API: {e}")
        return fallback_text
