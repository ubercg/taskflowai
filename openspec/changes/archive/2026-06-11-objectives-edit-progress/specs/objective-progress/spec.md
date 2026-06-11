# Objective Progress Specification

## Purpose

Specifies how an objective's completion percentage is derived from its associated
tasks and exposed as a read-only field on the objective list endpoint.

---

## Requirements

### Requirement: Derived Progress on Objective List

`GET /api/v1/objectives?project_id=X` MUST return each objective with a `progress`
integer field in the range 0–100 (inclusive).

`progress` is computed server-side as:

```
progress = ROUND(done_tasks / total_tasks * 100)
```

where:
- `done_tasks` = count of tasks where `tasks.objective_id = objective.id`
  AND `tasks.status = 'done'`
- `total_tasks` = count of ALL tasks where `tasks.objective_id = objective.id`
  (regardless of status)

The computation MUST use a SQL aggregation (LEFT JOIN + GROUP BY) so all objectives
are returned in a single query.

#### Scenario: Objective with no tasks → 0%

- GIVEN an objective that has no associated tasks (`tasks.objective_id` has no rows)
- WHEN `GET /api/v1/objectives?project_id=X` is called
- THEN `progress` for that objective is `0`
- AND no division-by-zero error occurs

#### Scenario: Some tasks done → partial progress

- GIVEN an objective with 4 tasks: 2 with `status = 'done'`, 2 with other statuses
- WHEN `GET /api/v1/objectives?project_id=X` is called
- THEN `progress` for that objective is `50`

#### Scenario: All tasks done → 100%

- GIVEN an objective where every associated task has `status = 'done'`
- WHEN `GET /api/v1/objectives?project_id=X` is called
- THEN `progress` for that objective is `100`

#### Scenario: No tasks done → 0%

- GIVEN an objective with tasks but none with `status = 'done'`
- WHEN `GET /api/v1/objectives?project_id=X` is called
- THEN `progress` for that objective is `0`

#### Scenario: Non-done statuses do not count as completed

- GIVEN an objective with tasks having statuses `backlog`, `todo`, `in_progress`,
  `review`, and `blocked` — none are `done`
- WHEN `GET /api/v1/objectives?project_id=X` is called
- THEN `progress` is `0` (those statuses count only toward the denominator)

---

### Requirement: Progress is Read-Only

`progress` MUST NOT be accepted as an input field in any create or update payload.

The `ObjectiveCreate` and `ObjectiveUpdate` schemas MUST NOT include a `progress`
field. If a client sends `progress` in a create or update request, the server MUST
ignore it or return `422 Unprocessable Entity`. The stored/derived value MUST remain
unchanged.

#### Scenario: Client attempts to set progress on create

- GIVEN a manager submitting `POST /api/v1/objectives` with body that includes
  `{"progress": 80, "title": "Goal", "project_id": 1}`
- WHEN the request is processed
- THEN the objective is created with `progress` derived from tasks (0 initially)
- AND the submitted value `80` is NOT stored

#### Scenario: Client attempts to set progress on update

- GIVEN a manager submitting `PATCH /api/v1/objectives/42` with body `{"progress": 80}`
- WHEN the request is processed
- THEN the response status is `200 OK` or `422 Unprocessable Entity`
- AND `progress` returned reflects the derived task-based value, NOT `80`

---

### Requirement: Manual Progress Slider Removed from UI

The frontend `ObjectiveFormModal` MUST NOT render a manual progress slider or any
editable progress input. Progress MUST be displayed as a read-only derived value
(e.g., a percentage label or a non-interactive progress bar).

`okrStore.updateProgress` dead code MUST be removed or left unwired; it MUST NOT
be called from any UI interaction.

#### Scenario: Form renders without progress slider

- GIVEN a user opens the Objective edit modal
- WHEN the modal is rendered
- THEN no slider or numeric input for progress is visible
- AND a read-only display of the derived progress percentage IS visible

#### Scenario: OkrProgressChart reflects real progress

- GIVEN objectives with tasks in various statuses
- WHEN `OkrProgressChart` renders using data from the objective list endpoint
- THEN bar heights correspond to the derived `progress` values (not always 0)

---

## Test Coverage Notes

- **Automatically verifiable (vitest)**: "Form renders without progress slider"
  and "OkrProgressChart reflects real progress" — once `src/test/setup.js` exists.
- **Manually verified**: all backend aggregation scenarios (no pytest infrastructure).
- The `done_tasks / total_tasks` boundary cases (0 tasks, all done) SHOULD be
  added to vitest integration tests that mock the API response.
