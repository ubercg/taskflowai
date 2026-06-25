# Exploración — objectives-edit-progress

> Fase: explore · Proyecto: taskflowai · Artefacto: OpenSpec
> Engram: `sdd/objectives-edit-progress/explore` (obs 378)

## Objetivo del cambio

Dos capacidades reportadas como faltantes:
1. **Editar Objetivos (OKRs)** existentes.
2. **Ver el porcentaje de avance** de un Objetivo.

## Hallazgo central

El problema es un **gap de backend**, no de frontend. La UI de edición ya existe
casi completa; el backend no implementa los endpoints y el progreso está
hardcodeado en 0.

### Estado del backend (`backend/app/api/v1/endpoints/objectives.py`)

| Endpoint | Estado |
|----------|--------|
| `GET /objectives` (lista por project_id) | ✅ existe |
| `POST /objectives` (requiere manager+) | ✅ existe |
| `GET /objectives/:id` | ❌ falta (404) |
| `PATCH /objectives/:id` | ❌ falta |
| `DELETE /objectives/:id` | ❌ falta |

- `ObjectiveResponse` (`schemas.py`) tiene `progress: int = 0` **hardcodeado** —
  nunca se calcula.
- No existe schema `ObjectiveUpdate`. `ObjectiveCreate` solo acepta
  `title, due_date, project_id`.
- El modelo `Objective` y la tabla en `docker/init.sql` **no tienen `description`
  ni `progress`**.

### Estado del frontend (ya implementado, sin cablear)

- `ObjectiveFormModal.jsx`: UI de edición completa (title, description, slider de
  progress, due_date). Detecta edit vs create. Llama `PATCH /objectives/:id`. El
  form funciona; el backend no responde.
- `ProjectDetailPage.jsx`: tiene estado `editingObjective` pero **falta el botón
  Editar por objetivo** (`setEditingObjective` solo se invoca con `null`).
- `OkrProgressChart.jsx`: ya existe, lee `obj.progress` (siempre 0 → barras vacías).
- `ObjectiveTasksPanel.jsx`: calcula `done/total` localmente pero no lo persiste.
- `okrStore.js`: `updateProgress(id, val)` es código muerto, nunca se llama.
- `frontend/src/test/setup.js`: **falta** (referenciado por vitest.config.js →
  bloquea todos los tests de frontend).

## Enfoques evaluados

### Edición

| Opción | Pros | Contras |
|--------|------|---------|
| A: PATCH mínimo (title + due_date) | Sin migración DB | El form envía `description` y se descarta en silencio → UX engañosa |
| **B: PATCH completo (+ description)** ✅ | El backend matchea el form; semánticamente completo | Requiere columna `description TEXT` → migración manual (no hay Alembic) |

### Progreso

| Opción | Pros | Contras |
|--------|------|---------|
| **C: Agregación SQL en GET /objectives** ✅ | Siempre exacto; alimenta a todos los consumidores; sin columna nueva | Un JOIN extra (despreciable a esta escala) |
| D: Endpoint dedicado por objetivo | — | N+1, más código, peor resultado |
| E: Cálculo client-side | Sin cambio backend | Solo visible al expandir tareas; OkrProgressChart queda en 0; dos fuentes de verdad |
| F: Columna `progress` almacenada | Lecturas rápidas | Migración + acoplar update al cambio de status de tareas |

Query recomendada (Opción C):
```sql
SELECT o.*,
  COALESCE(
    ROUND(100.0 * SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0)),
  0)::int AS progress
FROM objectives o
LEFT JOIN tasks t ON t.objective_id = o.id
WHERE o.project_id = :project_id
GROUP BY o.id
```

## Recomendación combinada

1. **Backend**: schema `ObjectiveUpdate(title, due_date, description)`;
   `PATCH /objectives/:id` con `require_manager_or_above` + `check_project_access`;
   `GET /objectives/:id`; `DELETE /objectives/:id` (manager+); calcular `progress`
   por JOIN SQL en `read_objectives`.
2. **DB**: agregar `description TEXT` a objectives en `init.sql` + documentar
   `ALTER TABLE objectives ADD COLUMN description TEXT;` para instalaciones existentes.
3. **Frontend**: cablear botón Editar por objetivo en `ProjectDetailPage`; quitar el
   slider manual de progreso del modal (progreso es derivado, no manual); crear
   `src/test/setup.js` para desbloquear vitest.

## Riesgos

- **Migración DB sin tooling**: agregar `description` exige editar `init.sql` y
  correr `ALTER TABLE` a mano o `docker compose down -v` (destruye datos). No hay Alembic.
- **Quitar el slider de progreso** es un cambio de UX (de manual a derivado).
- **`okrStore.updateProgress`** queda como código muerto → cablear o eliminar.
- **Tests de frontend bloqueados** hasta crear `src/test/setup.js`.
- **Backend sin infraestructura de test** → los cambios de backend van sin cobertura.

## Listo para propuesta
Sí — el alcance está bien definido y verificado contra el código real.
