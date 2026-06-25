# Propuesta: objectives-edit-progress

> Fase: propose · Proyecto: taskflowai · Artefacto: OpenSpec
> Engram: `sdd/objectives-edit-progress/proposal`

## Intent

Editar Objetivos (OKRs) existentes y ver su porcentaje de avance no funcionan: es
un gap de backend. El frontend de edición ya existe pero llama endpoints que no
están implementados, y `ObjectiveResponse.progress` está hardcodeado en `0`, por
lo que `OkrProgressChart` siempre muestra barras vacías. Cerramos el gap para que
un manager pueda editar `title`, `due_date` y `description`, y para que el avance
refleje el estado real de las tareas.

## Scope

### In Scope
- Backend: `GET /objectives/:id`, `PATCH /objectives/:id` (manager+ + `check_project_access`), `DELETE /objectives/:id` (manager+).
- Schema `ObjectiveUpdate(title?, due_date?, description?)`; `description` en base/response; `progress` derivado en la respuesta.
- DB: columna `description TEXT` (nullable) en modelo `Objective` y `docker/init.sql`; `ALTER TABLE` aplicado al contenedor `db` en ejecución.
- Progreso derivado server-side: `done/total*100` por JOIN SQL en el listado.
- Frontend: botón Editar por objetivo; quitar slider manual, mostrar progreso derivado read-only; cablear progreso real en chart y lista.
- Crear `frontend/src/test/setup.js` para desbloquear vitest.

### Out of Scope
- Scaffolding de tests de backend (pytest) — no existe infra; se documenta como riesgo.
- Tooling de migraciones (Alembic).
- Persistir `progress` como columna o recalcularlo en cambios de status de tareas.

## Capabilities

### New Capabilities
- `objective-management`: lectura individual, edición, borrado y reglas de autorización de objetivos.
- `objective-progress`: avance derivado de tareas (`done/total`), expuesto read-only en el listado.

### Modified Capabilities
- None

## Approach

Enfoque B (edición completa) + Enfoque C (progreso por agregación SQL) de la
exploración. El `PATCH` matchea el form existente (incluye `description`). El
`GET /objectives` calcula `progress` con `LEFT JOIN tasks` + `ROUND(100.0 * SUM(done) / NULLIF(COUNT,0))`,
alimentando a todos los consumidores con una única fuente de verdad. Reutilizar
`require_manager_or_above` y `check_project_access` de `core/security.py`.

## Affected Areas

| Area | Impacto | Descripción |
|------|---------|-------------|
| `backend/app/api/v1/endpoints/objectives.py` | Modified | +3 endpoints; progreso por JOIN en listado |
| `backend/app/schemas.py` | Modified | `ObjectiveUpdate`; `description`; `progress` derivado |
| `backend/app/models.py` | Modified | `description` en `Objective` |
| `docker/init.sql` | Modified | columna `description` |
| `frontend/.../ProjectDetailPage.jsx` | Modified | botón Editar por objetivo |
| `frontend/.../ObjectiveFormModal.jsx` | Modified | quitar slider; progreso read-only |
| `frontend/src/okrStore.js` | Modified | quitar/cablear `updateProgress` muerto |
| `frontend/src/test/setup.js` | New | desbloquea vitest |

## Risks

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Migración sin Alembic | Med | `ALTER TABLE ... ADD COLUMN description TEXT` (nullable, no destructivo) + `init.sql` para instalaciones nuevas |
| Backend sin tests | Alta | Out of scope explícito; cubrir frontend con vitest; validación manual del PATCH/GET |
| Cambio de UX (slider → derivado) | Baja | Display read-only claro del % derivado |

## Rollback Plan

Revertir el commit. La columna `description` (nullable) queda inerte sin tooling
de migración; opcional `ALTER TABLE objectives DROP COLUMN description;` en el
contenedor `db`. Sin pérdida de datos.

## Dependencies

- Contenedor `db` en ejecución (override compose) para aplicar el `ALTER TABLE`.

## Success Criteria

- [ ] Manager edita `title`/`due_date`/`description` y persiste vía `PATCH`.
- [ ] `progress` refleja `done/total` real en lista y `OkrProgressChart`.
- [ ] `DELETE` y `GET /:id` operativos con autorización correcta.
- [ ] `npx vitest run` corre tras crear `src/test/setup.js`.
