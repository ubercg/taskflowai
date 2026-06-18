# Calendar View Specification

## Purpose

Defines the requirements for the task calendar visualization, including the backend API for fetching date-bounded task data and the frontend UI behaviors for timeline filtering and interactions.

## Requirements

### Requirement: Task Calendar Fetching

The backend MUST provide an endpoint to fetch tasks bounded by a date range for a specific project. Tasks with no `due_date` MUST be excluded from the calendar results. Developers MUST only see tasks assigned to them, while managers and admins see all project tasks.

- **Endpoint:** `GET /api/v1/tasks/calendar`
- **Parameters (Query):**
  - `project_id` (Required): The ID of the project.
  - `start_date` (Required): ISO 8601 date string for the start of the calendar window.
  - `end_date` (Required): ISO 8601 date string for the end of the calendar window.
- **Response Schema:** Array of task objects containing `id`, `title`, `status`, `start_date`, and `due_date`.

#### Scenario: Successful data fetch

- GIVEN a valid `project_id`, `start_date`, and `end_date`
- AND the user has access to the project
- AND the user is a manager or admin
- WHEN a `GET` request is made to `/api/v1/tasks/calendar`
- THEN the system MUST return a `200 OK` status with an array of all tasks in the project whose `start_date` or `due_date` fall within the requested date range.

#### Scenario: Role-based task visibility (Developer)

- GIVEN a valid `project_id`, `start_date`, and `end_date`
- AND the user has access to the project with the `developer` role
- WHEN a `GET` request is made to `/api/v1/tasks/calendar`
- THEN the system MUST return a `200 OK` status with an array of tasks limited ONLY to those where `assignee_id` matches the current user's ID.

#### Scenario: Exclude tasks without due dates

- GIVEN tasks exist in the project that overlap the date range but have `due_date` set to `null`
- WHEN a `GET` request is made to `/api/v1/tasks/calendar`
- THEN the system MUST exclude those tasks from the response array.

#### Scenario: Missing required parameters

- GIVEN a request missing `project_id`, `start_date`, or `end_date`
- WHEN a `GET` request is made
- THEN the system MUST return a `422 Unprocessable Entity` status indicating the missing parameter, consistent with FastAPI defaults.

#### Scenario: Project access denied or project not found

- GIVEN a request with a `project_id`
- AND the user does not have permission to view the project (or the project does not exist)
- WHEN a `GET` request is made
- THEN the system MUST return a `403 Forbidden` status.

### Requirement: Calendar UI Modes

The frontend MUST display a calendar with toggleable view modes.

#### Scenario: Switch calendar modes

- GIVEN the user is on the Calendar View
- WHEN the user selects "Week", "Month", or "Year" from the view toggle
- THEN the calendar MUST re-render to display the selected time range
- AND the current view mode MUST be visually highlighted as active.

### Requirement: Day Selection Behavior

The frontend MUST allow users to interact with specific days on the calendar to view tasks.

#### Scenario: Click on a day

- GIVEN the user is viewing the calendar
- WHEN the user clicks on a specific date cell
- THEN a list of tasks for that specific day MUST be displayed
- AND the selected day MUST be visually highlighted to indicate active selection.

### Requirement: Task Visual States

The calendar UI MUST visually differentiate tasks based on their current status.

#### Scenario: Display task statuses

- GIVEN tasks are rendered on the calendar
- WHEN a task has a specific status (e.g., pending, in-progress, completed)
- THEN the task MUST use distinct visual indicators mapped to that status.
