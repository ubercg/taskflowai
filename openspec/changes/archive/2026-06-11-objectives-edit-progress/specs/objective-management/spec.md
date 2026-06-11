# Objective Management Specification

## Purpose

Specifies the read, edit, and delete operations for individual Objectives (OKRs),
including the authorization rules and the `description` field persisted to the database.

## Preconditions

- The `objectives` table MUST have a `description TEXT` nullable column before any
  endpoint in this spec is exercised. This column is added via `ALTER TABLE objectives
  ADD COLUMN description TEXT;` on running containers and via `docker/init.sql` for
  fresh installations. No migration tooling (Alembic) is used — this is a deploy-time
  manual step, not a runtime requirement.

---

## Requirements

### Requirement: Read Single Objective

The system MUST expose `GET /api/v1/objectives/:id` that returns a single objective
by its primary key.

Authentication is required; no role restriction beyond a valid session.
Returns `ObjectiveResponse` including all fields (`id`, `title`, `due_date`,
`description`, `project_id`, `progress`).

#### Scenario: Retrieve existing objective

- GIVEN an authenticated user with a valid session
- WHEN `GET /api/v1/objectives/42` is requested and objective 42 exists
- THEN the response status is `200 OK`
- AND the body contains `id`, `title`, `due_date`, `description`, `project_id`, `progress`

#### Scenario: Retrieve non-existent objective

- GIVEN an authenticated user
- WHEN `GET /api/v1/objectives/9999` is requested and no objective has that id
- THEN the response status is `404 Not Found`

#### Scenario: Unauthenticated request

- GIVEN no authentication token is provided
- WHEN `GET /api/v1/objectives/42` is requested
- THEN the response status is `401 Unauthorized`

---

### Requirement: Edit Objective

The system MUST expose `PATCH /api/v1/objectives/:id` that partially updates an
existing objective.

Editable fields: `title` (string), `due_date` (date or null), `description` (string
or null). All fields are optional in the request payload — partial updates MUST be
accepted (sending only `title` MUST NOT clear `due_date` or `description`).

`PATCH` requires the caller to have role `manager` or above (`require_manager_or_above`)
AND to have access to the project that owns the objective (`check_project_access`
against the objective's `project_id`).

The `progress` field MUST NOT be accepted in the update payload; if included, it
MUST be ignored or rejected with `422`.

#### Scenario: Successful partial update (title only)

- GIVEN an authenticated manager with access to the objective's project
- WHEN `PATCH /api/v1/objectives/42` is requested with body `{"title": "New Title"}`
- THEN the response status is `200 OK`
- AND the returned `title` equals `"New Title"`
- AND `due_date` and `description` are unchanged from their previous values

#### Scenario: Successful update with description

- GIVEN an authenticated manager with access to the objective's project
- WHEN `PATCH /api/v1/objectives/42` is requested with body `{"description": "Context here"}`
- THEN the response status is `200 OK`
- AND the returned `description` equals `"Context here"`

#### Scenario: Clear description (set to null)

- GIVEN an objective with a non-null `description`
- WHEN `PATCH /api/v1/objectives/42` is requested with body `{"description": null}`
- THEN the response status is `200 OK`
- AND the returned `description` is `null`

#### Scenario: Empty title rejected

- GIVEN an authenticated manager
- WHEN `PATCH /api/v1/objectives/42` is requested with body `{"title": ""}`
- THEN the response status is `422 Unprocessable Entity`

#### Scenario: Objective not found

- GIVEN an authenticated manager
- WHEN `PATCH /api/v1/objectives/9999` is requested and objective does not exist
- THEN the response status is `404 Not Found`

#### Scenario: Caller lacks manager role

- GIVEN an authenticated user with role `member` (below manager)
- WHEN `PATCH /api/v1/objectives/42` is requested
- THEN the response status is `403 Forbidden`

#### Scenario: Caller has no access to the objective's project

- GIVEN an authenticated manager who is not a member of the objective's project
- WHEN `PATCH /api/v1/objectives/42` is requested
- THEN the response status is `403 Forbidden`

#### Scenario: Unauthenticated request

- GIVEN no authentication token is provided
- WHEN `PATCH /api/v1/objectives/42` is requested
- THEN the response status is `401 Unauthorized`

#### Scenario: Progress field in payload is ignored/rejected

- GIVEN an authenticated manager with project access
- WHEN `PATCH /api/v1/objectives/42` is requested with body `{"progress": 75}`
- THEN the response status is `200 OK` or `422 Unprocessable Entity`
- AND the stored `progress` value is NOT altered to 75 (progress remains derived)

---

### Requirement: Delete Objective

The system MUST expose `DELETE /api/v1/objectives/:id` that permanently removes an
objective.

`DELETE` requires the caller to have role `manager` or above (`require_manager_or_above`).
No `check_project_access` constraint is required beyond the manager role for deletion.

#### Scenario: Successful deletion

- GIVEN an authenticated manager
- WHEN `DELETE /api/v1/objectives/42` is requested and objective 42 exists
- THEN the response status is `200 OK` or `204 No Content`
- AND a subsequent `GET /api/v1/objectives/42` returns `404`

#### Scenario: Delete non-existent objective

- GIVEN an authenticated manager
- WHEN `DELETE /api/v1/objectives/9999` is requested and no such objective exists
- THEN the response status is `404 Not Found`

#### Scenario: Caller lacks manager role

- GIVEN an authenticated user with role `member`
- WHEN `DELETE /api/v1/objectives/42` is requested
- THEN the response status is `403 Forbidden`

#### Scenario: Unauthenticated request

- GIVEN no authentication token is provided
- WHEN `DELETE /api/v1/objectives/42` is requested
- THEN the response status is `401 Unauthorized`

---

### Requirement: description Field Persistence

The `Objective` model and `ObjectiveResponse` schema MUST include `description` as a
nullable text field. It MUST be returned in `GET /objectives` (list), `GET /objectives/:id`,
and `PATCH /objectives/:id` responses.

#### Scenario: description persists across create and read

- GIVEN a new objective created without a `description`
- WHEN `GET /api/v1/objectives/:id` is called
- THEN `description` in the response is `null`

#### Scenario: description set on create is returned on read

- GIVEN an objective created via `POST /objectives` (if description is accepted there)
  OR updated via `PATCH` with `description: "Rationale"`
- WHEN `GET /api/v1/objectives/:id` is called
- THEN `description` equals `"Rationale"`

---

## Test Coverage Notes

- All scenarios under this spec are **manually verified** (no backend test infrastructure).
- Frontend integration scenarios for the Edit button and modal SHOULD be covered by
  vitest once `src/test/setup.js` exists.
