# Tasks — objectives-edit-progress

> Generated: 2026-06-10
> Spec: `openspec/changes/objectives-edit-progress/specs/`
> Design: `openspec/changes/objectives-edit-progress/design.md`
> Delivery strategy: ask-on-risk
> TDD mode: frontend vitest ACTIVE (`docker compose exec -T frontend npx vitest run`); backend MANUAL only.

---

## Dependency Order

```
WU-1 (DB migration) → WU-2 (backend: model + schemas) → WU-3 (backend: endpoints)
                                                        ↓
                                WU-4 (frontend: test infra + unit tests)
                                WU-5 (frontend: ObjectiveFormModal)
                                WU-6 (frontend: ProjectDetailPage edit button)
                                WU-7 (frontend: okrStore dead code)

WU-4 through WU-7 can run in parallel with each other ONLY AFTER WU-3 is done
(they depend on the API contract being finalized, but not on each other).
```

---

## Work Unit 1 — DB: add description column

> Layer: DB | Automatable: yes (CLI) | Sequential: must run first

- [x] **WU-1.1** Run the `ALTER TABLE` migration against the running container:
  ```
  docker compose exec -T db psql -U taskflow -d taskflow_db -c \
    "ALTER TABLE objectives ADD COLUMN IF NOT EXISTS description TEXT;"
  ```
  Verify: `docker compose exec -T db psql -U taskflow -d taskflow_db -c "\d objectives"` shows `description` column.

- [x] **WU-1.2** Add `description TEXT` column to the `objectives` table definition in `docker/init.sql` (after `due_date TIMESTAMPTZ NOT NULL`, before `created_at`).
  Verify: `grep -n "description" docker/init.sql` returns the new line.

**Commit message**: `feat(db): add description column to objectives table`

---

## Work Unit 2 — Backend: model + schemas

> Layer: backend | Automatable: yes | Sequential: after WU-1, before WU-3

- [x] **WU-2.1** `backend/app/models/models.py` — add `description` column to the `Objective` ORM model:
  ```python
  description = Column(String, nullable=True)
  ```
  Place it after `due_date`. Do NOT add `progress` to the model (it is derived-only).

- [x] **WU-2.2** `backend/app/schemas/schemas.py` — update `ObjectiveBase`:
  - Add `description: Optional[str] = None`.

- [x] **WU-2.3** `backend/app/schemas/schemas.py` — update `ObjectiveResponse`:
  - Keep `progress: int = 0` as the hardcoded fallback (WU-3 will make it live).
  - Add `description: Optional[str] = None` (inherited from `ObjectiveBase` after WU-2.2, confirm it appears in response).

- [x] **WU-2.4** `backend/app/schemas/schemas.py` — add `ObjectiveUpdate` schema:
  ```python
  class ObjectiveUpdate(BaseModel):
      model_config = ConfigDict(extra="ignore")
      title: Optional[str] = None
      due_date: Optional[datetime] = None
      description: Optional[str] = None
  ```
  Place it after `ObjectiveCreate`. `extra="ignore"` silently drops `progress` and any other unknown field.

- [x] **WU-2.5 (manual verify)** `POST /api/v1/objectives` still works and `ObjectiveResponse` now includes `description: null`.
  ```
  curl -s -X POST http://localhost:8000/api/v1/objectives \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test","due_date":"2026-12-31T00:00:00Z","project_id":1}' | python3 -m json.tool
  ```
  Expected: response includes `"description": null` and `"progress": 0`.

**Commit message**: `feat(backend): add description to Objective model and schemas; add ObjectiveUpdate`

---

## Work Unit 3 — Backend: endpoints (GET/:id, PATCH/:id, DELETE/:id + derived progress)

> Layer: backend | Automatable: partial (manual curl verification) | Sequential: after WU-2

- [x] **WU-3.1** `backend/app/api/v1/endpoints/objectives.py` — add import for `ObjectiveUpdate` from schemas and `text` from `sqlalchemy`.

- [x] **WU-3.2** `backend/app/api/v1/endpoints/objectives.py` — define the `_PROGRESS_SELECT` helper constant:
  ```python
  _PROGRESS_SELECT = """
      SELECT
          o.id,
          o.project_id,
          o.title,
          o.description,
          o.due_date,
          o.created_at,
          COALESCE(
              ROUND(
                  100.0 * SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END)
                  / NULLIF(COUNT(t.id), 0)
              )::int,
              0
          ) AS progress
      FROM objectives o
      LEFT JOIN tasks t ON t.objective_id = o.id
      WHERE {where}
      GROUP BY o.id
  """
  ```
  Place it at module level, before the router routes.

- [x] **WU-3.3** `backend/app/api/v1/endpoints/objectives.py` — rewrite `GET ""` (list endpoint) to use `_PROGRESS_SELECT`:
  - Replace current `db.query(Objective)` block with a `db.execute(text(_PROGRESS_SELECT.format(where="o.project_id = :project_id")))` call when `project_id` is provided, or `WHERE 1=1` for all.
  - Map each `row` to `ObjectiveResponse(**row._mapping)`.
  - Keep the existing `check_project_access` call when `project_id` is provided.

- [x] **WU-3.4** `backend/app/api/v1/endpoints/objectives.py` — add `GET /{objective_id}` endpoint:
  ```python
  @router.get("/{objective_id}", response_model=ObjectiveResponse)
  def read_objective(
      objective_id: int,
      db: Session = Depends(get_db),
      current_user=Depends(require_authenticated),
  ):
      row = db.execute(
          text(_PROGRESS_SELECT.format(where="o.id = :oid")),
          {"oid": objective_id}
      ).fetchone()
      if not row:
          raise HTTPException(status_code=404, detail="Objective not found")
      return ObjectiveResponse(**row._mapping)
  ```

- [x] **WU-3.5** `backend/app/api/v1/endpoints/objectives.py` — add `PATCH /{objective_id}` endpoint:
  - Depends: `require_manager_or_above`.
  - Fetch objective ORM object first (`db.query(Objective).filter(Objective.id == objective_id).first()`).
  - If not found → `HTTPException(404, "Objective not found")`.
  - `check_project_access(obj.project_id, current_user, db, require_ownership=True)` → raises 403 if fails.
  - Apply `data = update.model_dump(exclude_unset=True)` and `setattr` each key.
  - After `db.commit()`, re-fetch with `_PROGRESS_SELECT` to return derived progress in response.
  - Validate: non-empty title (if `title` is in `data`, ensure `data["title"].strip() != ""`; otherwise raise 422).

- [x] **WU-3.6** `backend/app/api/v1/endpoints/objectives.py` — add `DELETE /{objective_id}` endpoint:
  - Depends: `require_manager_or_above`.
  - Fetch objective ORM object first.
  - If not found → `HTTPException(404, "Objective not found")`.
  - `check_project_access(obj.project_id, current_user, db, require_ownership=True)` → 403 if fails.
  - `db.delete(obj)`, `db.commit()`.
  - Return `{"message": "Objective deleted"}`.

- [x] **WU-3.7 (manual verify — GET /:id)** Authenticated GET returns objective with derived `progress`:
  HTTP 200 ✓ — fields id, title, description, due_date, created_at, project_id, progress all present.

- [x] **WU-3.8 (manual verify — PATCH 200)** Manager-level token patches title + description:
  HTTP 200 ✓ — updated title+description reflected in response.

- [x] **WU-3.9 (manual verify — PATCH rejects empty title)** Empty title returns 422:
  HTTP 422 ✓ — {"detail":"El título no puede estar vacío"}

- [x] **WU-3.10 (manual verify — PATCH ignores progress)** Progress in payload is silently ignored:
  HTTP 200 ✓ — progress in response = 0 (derived), not 99.

- [x] **WU-3.11 (manual verify — 404 before 403)** Nonexistent objective returns 404 regardless of role:
  HTTP 404 ✓ — {"detail":"Objective not found"}

- [x] **WU-3.12 (manual verify — DELETE 200)** Manager deletes objective:
  HTTP 200 ✓ — {"message":"Objective deleted"}; subsequent GET → 404 ✓

- [x] **WU-3.13 (manual verify — derived progress on list)** `GET /api/v1/objectives?project_id=X` returns `progress` as SQL-derived int:
  HTTP 200 ✓ — SQL aggregation verified, progress=0 for objectives without done tasks (expected).

**Commit message**: `feat(backend): objectives CRUD endpoints with derived progress (GET/:id, PATCH/:id, DELETE/:id)`

---

## Work Unit 4 — Frontend: test infrastructure

> Layer: frontend/test | Automatable: yes (vitest) | Can run parallel with WU-5, WU-6, WU-7 after WU-3

- [x] **WU-4.1** Create `frontend/src/test/setup.js`:
  ```js
  import '@testing-library/jest-dom';
  ```

- [x] **WU-4.2** `frontend/vite.config.js` — add `test` block pointing to the setup file:
  ```js
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  }
  ```
  Verify existing tests still pass: `docker compose exec -T frontend npx vitest run`.

**Commit message**: `test(frontend): add vitest + jest-dom test setup`

---

## Work Unit 5 — Frontend: ObjectiveFormModal — remove manual slider, show derived progress read-only

> Layer: frontend | TDD: write test first | Can run parallel with WU-6, WU-7 after WU-4

- [x] **WU-5.1 (test first)** Create `frontend/src/components/projects/__tests__/ObjectiveFormModal.test.jsx`:
  - Test: edit mode with `objective={{ id:1, title:'T', description:'D', progress:50, due_date:'...', project_id:1 }}` renders:
    - Title field with value `'T'`.
    - Textarea for description with value `'D'`.
    - A read-only progress element showing `50%` (no `<input type="range">`).
    - No element with `type="range"`.
  - Test: create mode renders no progress display at all (or a static `0%` badge without slider).
  - Test: submit in edit mode calls `api.patch` with payload that does NOT include `progress` key.
  - Mock: `vi.mock('../../../services/api/client', ...)` mirroring existing test patterns.
  - Run tests → expect FAIL (red) at this point.

- [x] **WU-5.2** `frontend/src/components/projects/ObjectiveFormModal.jsx`:
  - Remove `progress` from `formData` state.
  - Remove the entire progress slider `<div>` block (lines ~96–111: label, `<input type="range">`, live progress bar).
  - In edit mode, add a read-only progress display (badge or static bar) using `objective.progress || 0`. Do not wire it to local state.
  - Ensure the `handleSubmit` payload no longer includes `progress` (it will be silently dropped by `extra="ignore"` anyway, but remove it explicitly to keep the contract clean).
  - `description` field stays editable in both create and edit modes (already present, just verify).

- [x] **WU-5.3** Run tests: `docker compose exec -T frontend npx vitest run`. All WU-5.1 tests must pass (green). 7/7 ✓

**Commit message**: `feat(frontend): remove manual progress slider from ObjectiveFormModal; show derived progress read-only`

---

## Work Unit 6 — Frontend: ProjectDetailPage — per-objective Edit button

> Layer: frontend | TDD: write test first | Can run parallel with WU-5, WU-7 after WU-4

- [x] **WU-6.1 (test first)** Create `frontend/src/pages/__tests__/ProjectDetailPage.objectives.test.jsx`:
  - Test: renders an "Edit" (or "Editar") button for each objective in the list.
  - Test: clicking the Edit button for an objective calls `setEditingObjective` with that objective object (spy or check that `ObjectiveFormModal` receives `objective` prop equal to the clicked item).
  - Test: clicking the Edit button does NOT propagate to the accordion expand handler (use `stopPropagation` — simulate click and verify `expandedObjectiveId` does not change from its current value).
  - Mock SWR, `usePermissions`, `getProject`, `getObjectives` using patterns from existing page tests.
  - Run tests → expect FAIL (red).

- [x] **WU-6.2** `frontend/src/pages/ProjectDetailPage.jsx` — inside the `objectives.map(obj => ...)` render block:
  - Add an Edit button per objective row. Suggested placement: inside the `display: 'flex', alignItems: 'center', gap: '12px'` cluster alongside the date and avatar, protected by `<Can permission={canEditProject}>`.
  - Button handler: `(e) => { e.stopPropagation(); setEditingObjective(obj); setShowObjectiveForm(true); }`.
  - The existing `showObjectiveForm && <ObjectiveFormModal ... objective={editingObjective} ...>` already handles the conditional render — no additional changes to the modal mount needed.

- [x] **WU-6.3** Run tests: `docker compose exec -T frontend npx vitest run`. All WU-6.1 tests must pass (green). 3/3 ✓

**Commit message**: `feat(frontend): add per-objective Edit button on ProjectDetailPage`

---

## Work Unit 7 — Frontend: neutralize dead okrStore.updateProgress

> Layer: frontend | Automatable: yes | Can run parallel with WU-5, WU-6 after WU-4

- [x] **WU-7.1** Verify no component currently calls `updateProgress` from `okrStore`:
  Search: `grep -r "updateProgress" frontend/src/` — expected: 0 call sites outside `okrStore.js` itself.

- [x] **WU-7.2** `frontend/src/store/okrStore.js` — remove the `updateProgress` action entirely. The store retains `objectives`, `loading`, and `setObjectives`.
  Final state of file:
  ```js
  import { create } from 'zustand';

  export const useOkrStore = create((set) => ({
    objectives: [],
    loading: false,
    setObjectives: (data) => set({ objectives: data }),
  }));
  ```

- [x] **WU-7.3 (test)** Add a test in `frontend/src/store/__tests__/okrStore.test.js`:
  - Verify `useOkrStore.getState()` has `setObjectives` but NOT `updateProgress`.
  - Run: `docker compose exec -T frontend npx vitest run`. Must pass (green).

**Commit message**: `refactor(frontend): remove dead updateProgress from okrStore`

---

## Work Unit 8 — Integration smoke test (manual)

> Layer: cross-stack | Automatable: no | Sequential: after all WU-1..7 complete

- [ ] **WU-8.1 (manual)** Open the app in a browser as a manager user. Navigate to a project detail page.
  - Verify each objective row shows an Edit button.
  - Click Edit on an objective → modal opens with title, description, and a read-only progress display (no slider).
  - Edit title and description, click Save → modal closes, list refreshes, updated values visible.
  - Verify `progress` displayed in the list reflects the real SQL-derived value (not 0).

- [ ] **WU-8.2 (manual)** Attempt to delete an objective as a manager user. Confirm objective is removed from the list after deletion (via an API call to `DELETE /api/v1/objectives/:id`; no frontend delete button is required by spec — this is an API-level verification).

- [ ] **WU-8.3 (manual)** Open the OKR progress chart (`/metrics` or the analytics page with `OkrProgressChart`). Verify objectives with tasks show non-zero progress bars.

**Commit message**: N/A (manual gate; no commit)

---

## Task Summary

| WU | Layer | Type | Depends on | Parallel with |
|----|-------|------|-----------|---------------|
| WU-1 | DB | automated CLI | — | — |
| WU-2 | backend | automated | WU-1 | — |
| WU-3 | backend | automated + manual verify | WU-2 | — |
| WU-4 | frontend/test | automated | WU-3 (API contract) | WU-5, WU-6, WU-7 |
| WU-5 | frontend | TDD automated | WU-4 | WU-6, WU-7 |
| WU-6 | frontend | TDD automated | WU-4 | WU-5, WU-7 |
| WU-7 | frontend | automated | WU-4 | WU-5, WU-6 |
| WU-8 | integration | manual | WU-1–7 | — |

Total tasks: 8 work units / 30 individual checklist items (13 automated, 7 manual-verify, 10 test steps).

---

## Review Workload Forecast

| Metric | Estimate |
|--------|----------|
| Files changed | ~8 (objectives.py, models.py, schemas.py, init.sql, ObjectiveFormModal.jsx, ProjectDetailPage.jsx, okrStore.js, vite.config.js) |
| New test files | 3 (ObjectiveFormModal.test.jsx, ProjectDetailPage.objectives.test.jsx, okrStore.test.js) + 1 setup file |
| Estimated changed lines | ~280–340 (backend ~120, frontend ~100, tests ~80, infra ~20) |
| Chained PRs recommended | No — within 400-line budget |
| 400-line budget risk | **Low** (estimate: 280–340 lines; comfortable margin) |
| Decision needed before apply | No — delivery strategy `ask-on-risk` threshold not triggered |

Single PR is safe. All work units are designed as independently reviewable commits that can be stacked in a single PR without exceeding the 400-line budget.
