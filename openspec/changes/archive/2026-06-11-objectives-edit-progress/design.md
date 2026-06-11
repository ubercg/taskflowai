# Diseño técnico: objectives-edit-progress

> Fase: design · Proyecto: taskflowai · Artefacto: OpenSpec
> Engram: `sdd/objectives-edit-progress/design`
> Depende de: `proposal.md`, `exploration.md`

## Stack confirmado (mirror, NO modernizar)

- Backend: FastAPI + SQLAlchemy 2.0 **ORM clásico** (`db.query(...)`, modelos `Column`), Pydantic V2 (`ConfigDict`, `model_dump`). Sin Alembic, sin DRF.
- Endpoints existentes (`projects.py`) son la **referencia canónica** para PATCH/DELETE: orden auth → fetch → 404 → mutar con `exclude_unset`.
- SQL crudo cuando hay agregación: patrón `text("""...""")` + `db.execute(q, params).fetchall()` (ver `get_project_members`, vistas en `init.sql`).
- Frontend: React 18 (sin React Compiler; `useMemo`/`useCallback` siguen siendo necesarios donde aplique), Zustand **4.5** (`create((set) => ...)`), SWR, Recharts.

## Arquitectura del cambio

Patrón en capas ya presente, sin nuevas abstracciones:

```
modelo (ORM) ──> schema (Pydantic) ──> endpoint (router) ──> api client ──> SWR/store ──> componente
   description       ObjectiveUpdate      PATCH/GET/:id/DELETE   ya existe       obj.progress     modal/lista/chart
                     progress (derivado)  progress por JOIN SQL
```

`progress` es un **valor derivado de solo lectura**, calculado server-side por agregación SQL. No se persiste, no se acepta como input. Una única fuente de verdad (`GET /objectives`) alimenta lista, chart y modal.

Restricción de secuencia (CRÍTICA): **la migración `ADD COLUMN description` debe correr ANTES** de desplegar el backend que lee/escribe `description`. Si el código corre primero contra una tabla sin la columna, `PATCH` con `description` y la respuesta que serializa `description` fallan. Orden de apply: (1) ALTER TABLE en `db`, (2) editar `init.sql`, (3) modelo, (4) schema, (5) endpoints, (6) frontend.

---

## 1. Migración DB (sin Alembic)

### Comando contra el contenedor `db` en ejecución

```bash
docker compose exec -T db psql -U taskflow -d taskflow_db -c \
  "ALTER TABLE objectives ADD COLUMN IF NOT EXISTS description TEXT;"
```

- `IF NOT EXISTS` → **idempotente**: re-ejecutar no falla ni duplica.
- `TEXT` nullable, sin default → **no destructivo**, filas existentes quedan con `NULL`.
- Coherente con `tasks.description TEXT` y `projects.description TEXT` (ya `TEXT` en `init.sql`).

### Verificación

```bash
docker compose exec -T db psql -U taskflow -d taskflow_db -c "\d objectives"
# debe listar:  description | text |
```

### Edit en `docker/init.sql` (para instalaciones nuevas / `down -v`)

Tabla `objectives` (líneas 42-48), agregar `description TEXT` tras `title`:

```sql
CREATE TABLE objectives (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`init.sql` solo corre en primer arranque del volumen; el ALTER cubre los volúmenes ya inicializados.

### Modelo ORM (`backend/app/models/models.py`)

En `class Objective` (línea 78), tras `title`:

```python
description = Column(String, nullable=True)
```

`String` sin longitud mapea a `TEXT` en Postgres — mismo patrón que `Project.description` (línea 63) y `Task.description` (línea 114). No agregar columna `progress` al modelo (es derivado).

---

## 2. Schemas (`backend/app/schemas/schemas.py`)

`ObjectiveBase` mantiene `title`, `due_date`, `project_id`; se le suma `description` opcional (visible en create y response):

```python
class ObjectiveBase(BaseModel):
    title: str
    due_date: datetime
    project_id: int
    description: Optional[str] = None


class ObjectiveCreate(ObjectiveBase):
    pass


class ObjectiveUpdate(BaseModel):
    """Campos opcionales para PATCH (mismo patrón que ProjectUpdate)."""
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    due_date: Optional[datetime] = None
    description: Optional[str] = None


class ObjectiveResponse(ObjectiveBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    progress: int = 0  # derivado server-side; default 0 si no hay tareas
```

Decisiones:
- `ObjectiveUpdate` NO incluye `project_id` (no se mueve un objetivo de proyecto) ni `progress` (derivado, nunca input). `extra="ignore"` descarta el `progress`/`project_id` que el form aún envía sin error 422 → migración de UX sin romper el contrato.
- `progress` permanece SOLO en `ObjectiveResponse`. Se rellena manualmente por endpoint (ver §3), no por `from_attributes` (el modelo no lo tiene).
- `ObjectiveResponse` hereda `description` de la base → se serializa automáticamente.

---

## 3. Query de progreso (agregación SQL)

Patrón `text()` (como `get_project_members`). Postgres: `SUM(CASE...)` + `NULLIF` evita div-by-zero; `COALESCE` da 0 cuando no hay tareas; `::int` castea el `ROUND` numérico.

### Lista — `GET /objectives`

```sql
SELECT
    o.id, o.project_id, o.title, o.description, o.due_date, o.created_at,
    COALESCE(
        ROUND(
            100.0 * SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(t.id), 0)
        ), 0
    )::int AS progress
FROM objectives o
LEFT JOIN tasks t ON t.objective_id = o.id
WHERE (:project_id IS NULL OR o.project_id = :project_id)
GROUP BY o.id
ORDER BY o.created_at DESC
```

- `LEFT JOIN` → objetivos sin tareas aparecen con `progress = 0`.
- `WHERE (:project_id IS NULL OR ...)` cubre el caso `project_id` opcional del endpoint actual sin ramificar SQL.
- El acceso (`check_project_access`) se valida ANTES de ejecutar la query cuando viene `project_id`, igual que hoy.

### Detalle — `GET /objectives/:id`

Recomendación: **sí** devolver `progress` también en el detalle, por consistencia (el modal en edición muestra el % derivado). Misma agregación filtrando por `o.id`:

```sql
SELECT
    o.id, o.project_id, o.title, o.description, o.due_date, o.created_at,
    COALESCE(
        ROUND(
            100.0 * SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(t.id), 0)
        ), 0
    )::int AS progress
FROM objectives o
LEFT JOIN tasks t ON t.objective_id = o.id
WHERE o.id = :objective_id
GROUP BY o.id
```

### Compartir la query (DRY)

Helper de módulo en `objectives.py` que construye el SELECT con un fragmento de filtro intercambiable, evitando duplicar la agregación:

```python
_PROGRESS_SELECT = """
    SELECT o.id, o.project_id, o.title, o.description, o.due_date, o.created_at,
           COALESCE(ROUND(100.0 * SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END)
                    / NULLIF(COUNT(t.id),0)), 0)::int AS progress
    FROM objectives o
    LEFT JOIN tasks t ON t.objective_id = o.id
    WHERE {where}
    GROUP BY o.id
"""
```

- Lista: `where="(:project_id IS NULL OR o.project_id = :project_id)"` + `ORDER BY o.created_at DESC`.
- Detalle: `where="o.id = :objective_id"`.

El `{where}` se interpola desde constantes internas controladas (no input de usuario) → sin riesgo de inyección; los valores siempre van como parámetros bindeados (`:project_id`, `:objective_id`).

### Mapeo a `ObjectiveResponse`

`db.execute(...).mappings()` devuelve filas tipo dict; `ObjectiveResponse(**row)` las valida directamente (las claves del SELECT coinciden 1:1 con los campos del schema, incluido `progress`). El POST puede seguir devolviendo el objeto ORM con `progress=0` por default (objetivo recién creado, sin tareas) sin tocar la query.

---

## 4. Endpoints (`backend/app/api/v1/endpoints/objectives.py`)

Imports a sumar: `from sqlalchemy import text`, `from app.schemas.schemas import ObjectiveUpdate`.

### `GET /objectives` (reescritura del listado con la query agregada)

```python
@router.get("", response_model=list[ObjectiveResponse])
def read_objectives(project_id: int = Query(None), db=Depends(get_db),
                    current_user=Depends(require_authenticated)):
    if project_id:
        check_project_access(project_id, current_user, db)
    rows = db.execute(
        text(_PROGRESS_SELECT.format(
            where="(:project_id IS NULL OR o.project_id = :project_id)")
            + " ORDER BY o.created_at DESC"),
        {"project_id": project_id},
    ).mappings().all()
    return [ObjectiveResponse(**r) for r in rows]
```

### `GET /objectives/{objective_id}`

```python
@router.get("/{objective_id}", response_model=ObjectiveResponse)
def read_objective(objective_id: int, db=Depends(get_db),
                   current_user=Depends(require_authenticated)):
    obj = db.query(Objective).filter(Objective.id == objective_id).first()
    if not obj:
        raise HTTPException(404, "Objective not found")          # 404 ANTES de 403
    check_project_access(obj.project_id, current_user, db)       # 403 si sin acceso
    row = db.execute(
        text(_PROGRESS_SELECT.format(where="o.id = :objective_id")),
        {"objective_id": objective_id},
    ).mappings().first()
    return ObjectiveResponse(**row)
```

### `PATCH /objectives/{objective_id}`

```python
@router.patch("/{objective_id}", response_model=ObjectiveResponse)
def update_objective(objective_id: int, payload: ObjectiveUpdate, db=Depends(get_db),
                     current_user=Depends(require_manager_or_above)):
    obj = db.query(Objective).filter(Objective.id == objective_id).first()
    if not obj:
        raise HTTPException(404, "Objective not found")              # 404 primero
    check_project_access(obj.project_id, current_user, db, require_ownership=True)
    data = payload.model_dump(exclude_unset=True)                    # partial update
    for k, v in data.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    row = db.execute(
        text(_PROGRESS_SELECT.format(where="o.id = :objective_id")),
        {"objective_id": objective_id},
    ).mappings().first()
    return ObjectiveResponse(**row)
```

### `DELETE /objectives/{objective_id}`

```python
@router.delete("/{objective_id}")
def delete_objective(objective_id: int, db=Depends(get_db),
                     current_user=Depends(require_manager_or_above)):
    obj = db.query(Objective).filter(Objective.id == objective_id).first()
    if not obj:
        raise HTTPException(404, "Objective not found")
    check_project_access(obj.project_id, current_user, db, require_ownership=True)
    db.delete(obj)
    db.commit()
    return {"message": "Objective deleted"}
```

### Decisiones de autorización (orden 404 → 403)

- `require_manager_or_above` (dependencia global del endpoint) corre primero: garantiza rol manager/admin a nivel sistema → 403 si no.
- Luego se hace **fetch del objetivo** para obtener su `project_id` (el path solo trae `objective_id`). Si no existe → **404 antes** de cualquier chequeo de proyecto.
- `check_project_access(..., require_ownership=True)` exige manager/admin **dentro del proyecto** (espejo de `update_project`). Admin global hace bypass dentro de `check_project_access`.
- Este orden (rol → 404 → acceso proyecto) es deliberado: no filtra existencia de objetivos de proyectos ajenos a usuarios sin rol, y devuelve 404 limpio para IDs inexistentes.

---

## 5. Frontend

### `ProjectDetailPage.jsx` — botón Editar por objetivo

`editingObjective`/`setEditingObjective` ya existen (línea 28); el modal ya consume `editingObjective` (línea 270). Falta el disparador por fila. En el header de cada objetivo (zona de acciones, junto a "Vence", líneas 158-174), agregar un botón Editar que setea el objetivo y abre el modal, deteniendo la propagación para no togglear el expand:

```jsx
<button
  onClick={(e) => { e.stopPropagation(); setEditingObjective(obj); setShowObjectiveForm(true); }}
  title="Editar objetivo"
  style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}
>
  {/* ícono lápiz SVG inline, mismo estilo que el resto */}
</button>
```

`onSaved` (línea 272) ya llama `mutateObjectives()` → SWR revalida y trae el `progress` recalculado. Sin cambios en el flujo de guardado.

### `ObjectiveFormModal.jsx` — quitar slider manual, progreso read-only

- **Eliminar** el bloque `range` + barra editable (líneas 95-111) y `getProgressColor` queda solo para el display read-only (o se mantiene).
- En `formData` quitar `progress` del input que se envía. Como `ObjectiveUpdate` usa `extra="ignore"`, aunque quedara, el backend lo descarta; pero conviene limpiarlo para claridad.
- En **modo edición**, mostrar el progreso DERIVADO como solo lectura (no editable), leyendo `objective.progress`:

```jsx
{isEdit && (
  <div>
    <label style={{ ... }}>
      <span>Progreso (derivado de tareas)</span>
      <span style={{ color: getProgressColor(objective.progress || 0), fontWeight: 600 }}>
        {objective.progress || 0}%
      </span>
    </label>
    <div style={{ /* barra estática */ }}>
      <div style={{ width: `${objective.progress || 0}%`, ... }} />
    </div>
  </div>
)}
```

- En **modo creación**, omitir el progreso por completo (un objetivo nuevo no tiene tareas → 0; mostrarlo confunde).
- El submit sigue usando `api.patch('/api/v1/objectives/${id}', formData)` / `api.post(...)`; el backend ahora responde correctamente.

### `okrStore.js` — neutralizar `updateProgress` muerto

`updateProgress` (líneas 9-13) es código muerto: `progress` ahora es derivado read-only, nunca se setea desde el cliente. **Eliminar** el método. Mantener `objectives`, `loading`, `setObjectives`. El store no es la fuente de verdad del progreso (lo es SWR/`GET /objectives`); si nadie consume `setObjectives`, el store podría quedar marginal, pero su limpieza total queda fuera de este cambio — solo se quita el método muerto para no dejar API engañosa.

```js
import { create } from 'zustand';

export const useOkrStore = create((set) => ({
  objectives: [],
  loading: false,
  setObjectives: (data) => set({ objectives: data }),
}));
```

(Patrón Zustand 4.5 intacto: `create((set) => ({...}))`. No introducir idioms de Zustand 5.)

### Display de progreso — consumo directo de `obj.progress`

- `OkrProgressChart.jsx`: ya mapea `obj.progress || 0` (línea 19). Sin cambios de código: una vez la API devuelve el progreso real, las barras radiales se llenan. El `|| 0` queda como fallback defensivo.
- Lista en `ProjectDetailPage.jsx` (líneas 151, 154): ya consume `obj.progress || 0`. Sin cambios.
- `ObjectiveTasksPanel.jsx`: ya calcula `done/total` localmente para su vista expandida; queda como está (coherente con el server). Fuera de scope tocarlo.

### `frontend/src/test/setup.js` — desbloquear vitest

`vitest.config.js` referencia `./src/test/setup.js` (setupFiles). El archivo no existe → todos los tests fallan al arrancar. Crear con contenido mínimo:

```js
import '@testing-library/jest-dom';
```

---

## 6. Estrategia de tests

### Frontend (vitest) — única capa automatizable

Comando: `docker compose exec -T frontend npx vitest run`

Unidades a cubrir:
1. **`ObjectiveFormModal` en modo edición**: renderiza con un `objective` que trae `description` y `progress`; verifica que (a) el campo descripción se prellena, (b) el progreso se muestra read-only (NO existe un `input[type=range]`), (c) al guardar se invoca `api.patch` con el payload esperado (mock de `api`).
2. **`ObjectiveFormModal` en modo creación**: NO renderiza bloque de progreso; submit llama `api.post`.
3. **Render de progreso**: que la barra/etiqueta refleje `objective.progress` provisto (smoke del color por umbral si aporta).

Prerrequisito: crear `src/test/setup.js` (§5) antes de correr vitest.

### Backend — verificación manual por curl (sin pytest)

No existe infraestructura de tests de backend (out of scope montarla). Verificación manual contra `:8000` tras aplicar migración + código:

```bash
# token de manager
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -d 'username=admin@taskflow.com&password=...' | jq -r .access_token)

# GET lista con progreso derivado
curl -s localhost:8000/api/v1/objectives?project_id=1 -H "Authorization: Bearer $TOKEN" | jq

# GET detalle
curl -s localhost:8000/api/v1/objectives/1 -H "Authorization: Bearer $TOKEN" | jq

# PATCH parcial (title/description/due_date)
curl -s -X PATCH localhost:8000/api/v1/objectives/1 -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"description":"nueva desc","title":"nuevo title"}' | jq

# DELETE
curl -s -X DELETE localhost:8000/api/v1/objectives/1 -H "Authorization: Bearer $TOKEN" | jq
```

Casos a validar manualmente: progreso = `done/total` correcto; objetivo sin tareas → 0; ID inexistente → 404; usuario sin acceso al proyecto → 403; usuario sin rol manager → 403. Documentar resultados en la fase verify.

---

## Mapa de cambios archivo por archivo

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `db` (contenedor) | Migración | `ALTER TABLE objectives ADD COLUMN IF NOT EXISTS description TEXT;` |
| `docker/init.sql` | Modified | `description TEXT` en `CREATE TABLE objectives` |
| `backend/app/models/models.py` | Modified | `description = Column(String, nullable=True)` en `Objective` |
| `backend/app/schemas/schemas.py` | Modified | `description` en `ObjectiveBase`; nuevo `ObjectiveUpdate`; `progress` solo en response |
| `backend/app/api/v1/endpoints/objectives.py` | Modified | helper `_PROGRESS_SELECT`; reescribir `GET ""`; +`GET/{id}`, `PATCH/{id}`, `DELETE/{id}`; imports `text`, `ObjectiveUpdate` |
| `frontend/src/pages/ProjectDetailPage.jsx` | Modified | botón Editar por objetivo (`stopPropagation` + `setEditingObjective(obj)`) |
| `frontend/src/components/projects/ObjectiveFormModal.jsx` | Modified | quitar slider; progreso derivado read-only (edit) / omitido (create) |
| `frontend/src/store/okrStore.js` | Modified | eliminar `updateProgress` muerto |
| `frontend/src/test/setup.js` | New | `import '@testing-library/jest-dom';` |

API client (`frontend/src/services/api/index.js`): `getObjective`, `updateObjective`, `deleteObjective` **ya existen** → sin cambios.

## Secuenciación (orden obligatorio en apply)

1. `ALTER TABLE` en contenedor `db` (idempotente).
2. `init.sql` + modelo + schema.
3. Endpoints backend (dependen de la columna y el schema).
4. Frontend (botón, modal, store, setup de tests).
5. Frontend tests vitest → verificación manual curl del backend.

Razón: cualquier código backend que serialice o escriba `description` falla si la columna no existe todavía.

## ADRs

### ADR-1: progreso derivado por agregación SQL, no columna persistida
- **Decisión**: calcular `progress` en `GET` con `LEFT JOIN tasks` + `ROUND/NULLIF`.
- **Por qué**: una sola fuente de verdad alimenta lista, chart y modal; siempre exacto; sin acoplar el update al cambio de status de tareas.
- **Rechazadas**: columna `progress` almacenada (F: requiere sincronizar en cada cambio de status, riesgo de desfase); cálculo client-side (E: deja `OkrProgressChart` en 0, dos fuentes de verdad); endpoint dedicado por objetivo (D: N+1).

### ADR-2: PATCH completo con `description` (migración manual), no PATCH mínimo
- **Decisión**: incluir `description` → exige columna nueva vía `ALTER TABLE` manual.
- **Por qué**: el form ya envía `description`; descartarla en silencio (opción A) es UX engañosa. El ALTER nullable es no destructivo e idempotente.
- **Rechazada**: PATCH mínimo title+due_date (A: sin migración pero rompe la promesa del form).

### ADR-3: `ObjectiveUpdate` con `extra="ignore"`
- **Decisión**: descartar campos no contemplados (`progress`, `project_id`) sin 422.
- **Por qué**: el form aún puede enviar `progress` durante la transición de UX; espejo de `ProjectUpdate`. Migración sin romper el contrato de request.

### ADR-4: orden 404 → 403 en PATCH/DELETE/GET-detalle
- **Decisión**: rol global (dependencia) → fetch objetivo → 404 si no existe → `check_project_access`.
- **Por qué**: el path solo trae `objective_id`; el `project_id` para autorizar exige fetch previo. 404 limpio para IDs inexistentes; sin filtrar existencia a usuarios sin rol (la dependencia de rol corre antes del fetch).

### ADR-5: helper `_PROGRESS_SELECT` con `{where}` interpolado
- **Decisión**: compartir la agregación entre lista y detalle interpolando solo un fragmento `WHERE` de constantes internas.
- **Por qué**: DRY sin duplicar la fórmula de progreso. Los valores siempre van bindeados (`:project_id`, `:objective_id`); el `{where}` nunca recibe input de usuario → sin riesgo de inyección.
