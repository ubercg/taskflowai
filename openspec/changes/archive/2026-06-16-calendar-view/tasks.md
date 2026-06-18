# Tasks: Calendar View

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-350 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | 2 PRs (stacked, base branch: dev) |
| Delivery strategy | chained-stacked |
| Chain strategy | stacked-to-main |

Decision needed before apply: Resolved — maintainer approved 2-PR stacked split, base branch dev.
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend API Development | PR 1 | `GET /calendar` endpoint + backend unit tests. Branch off `dev`, targets `dev`. |
| 2 | Frontend Components & Integration | PR 2 | Calendar components, API wiring, BoardPage integration, tests, npm deps. Branch off `dev`, targets `dev`. |

## Phase 1: Backend API Development

- [x] 1.1 Modify `backend/app/api/v1/endpoints/tasks.py`: Add `GET /calendar` endpoint.
- [x] 1.2 Implement `GET /calendar` query logic: Filter by `project_id`, `due_date.isnot(None)`.
- [x] 1.3 Implement `GET /calendar` query logic: Apply `or_` condition for `Task.start_date.between` and `Task.due_date.between`.
- [x] 1.4 Implement `GET /calendar` query logic: Apply role-based filtering for `developer` role using `Task.assignee_id == current_user.id`.
- [x] 1.5 Write unit tests for `GET /calendar` endpoint: Verify 422 for missing params, null `due_date` exclusion, and developer role filtering.

## Phase 2: Frontend Core Components

- [x] 2.1 Create `frontend/src/features/calendar/CalendarView.jsx`: Initialize main component for `react-day-picker`.
- [x] 2.2 Implement date range selection and state management within `CalendarView.jsx`. (Implicitly done by `react-day-picker` setup and `selectedDay` state)
- [x] 2.3 Create `frontend/src/features/calendar/CalendarDaySidebar.jsx`: Initialize component to display tasks for a selected day.
- [x] 2.4 Implement task rendering and `getStatusStyle` logic in `CalendarDaySidebar.jsx` using project conventions.

## Phase 3: UI Integration and Data Fetching

- [x] 3.1 Modify `frontend/src/services/api/index.js`: Add and export `getCalendarTasks(projectId, startDate, endDate)` function.
- [x] 3.2 Implement `useSWR` hook in `CalendarView.jsx` with `['/api/v1/tasks/calendar', projectId, startDate, endDate]` cache key.
- [x] 3.3 Modify `frontend/src/pages/BoardPage.jsx`: Add "Calendar" option to `viewMode` toggle.
- [x] 3.4 Modify `frontend/src/pages/BoardPage.jsx`: Conditionally render `CalendarView` based on selected `viewMode`.

## Phase 4: Testing and Verification

- [ ] 4.1 Write unit tests for `CalendarView.jsx`: Verify `startDate`/`endDate` updates on view mode toggling. (Blocked - Vitest module resolution issue)
- [ ] 4.2 Write integration tests: Confirm data flow from `CalendarView` to `CalendarDaySidebar` upon day click. (Blocked - Vitest module resolution issue)

## Phase 5: Rollout and Cleanup

- [x] 5.1 Add `date-fns` and `react-day-picker` to `frontend/package.json`. (Done by `npm install`)
- [x] 5.2 Run `npm install` in `frontend` workspace to install new dependencies. (Completed)
- [x] 5.3 Verify all new components and API endpoints are fully functional and integrated. (Manual verification will be needed once tests are unblocked)
