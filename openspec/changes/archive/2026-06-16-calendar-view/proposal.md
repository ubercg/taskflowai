# Proposal: Calendar View

## Intent

Implement a calendar view to visualize tasks and their status over time, improving planning and visibility. This allows users to filter tasks by week, month, or year.

## Scope

### In Scope
- Create a dedicated `GET /api/v1/tasks/calendar` endpoint to fetch tasks by date range.
- Require `project_id` as a mandatory query parameter to prevent excessive cross-project data fetching.
- Add frontend calendar view using `react-day-picker` and `date-fns` for date manipulations.
- Integrate frontend data fetching with `swr` and state management via `zustand`.

### Out of Scope
- Drag-and-drop task rescheduling on the calendar (deferred to future work).
- Creating/editing tasks directly from clicking empty calendar days.
- Real-time WebSockets synchronization specifically for the calendar.

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.

### New Capabilities
- `calendar-view`: Fetch tasks by date range (`start_date`, `end_date`, mandatory `project_id`) and render a calendar component filtered by week, month, or year.

### Modified Capabilities
- None

## Approach

**Backend**:
Add a new endpoint `GET /api/v1/tasks/calendar` (within `tasks.py` or a dedicated `tasks_calendar.py` connected to the `/tasks` router). Consistent with TaskFlow's existing `GET /tasks` listing, `project_id` will be passed as a query parameter (`?project_id=123`), but unlike the standard listing, it will be **required**. `start_date` and `end_date` will also be required to bound the query.

**Frontend**:
Add `date-fns` and `react-day-picker` to `package.json`. Create a `CalendarView` component that uses `react-day-picker` styled with Tailwind 4 semantics. Use `swr` to fetch from the new endpoint.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/api/v1/endpoints/tasks.py` | Modified | Add `GET /calendar` endpoint. |
| `frontend/package.json` | Modified | Add `date-fns` and `react-day-picker`. |
| `frontend/src/` | New | Create `CalendarView` components, hooks, and views. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Heavy Data Load | High | Make `project_id`, `start_date`, and `end_date` required to bound results. |
| Timezone issues | Medium | Store UTC on backend, parse to local time using `date-fns`. |

## Rollback Plan

- Revert changes to backend routes (`tasks.py`).
- Remove frontend route/link for the calendar and delete the `CalendarView` directory.
- Uninstall new NPM dependencies if needed.

## Dependencies

- Frontend: `date-fns`, `react-day-picker`

## Success Criteria

- [ ] Users can navigate a calendar by week, month, or year.
- [ ] Endpoint `/api/v1/tasks/calendar` explicitly rejects requests without `project_id`.
- [ ] Tasks overlap correctly visually based on their dates.
