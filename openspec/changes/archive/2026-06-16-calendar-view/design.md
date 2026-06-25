# Design: Calendar View

## Technical Approach

Implement a new `GET /api/v1/tasks/calendar` backend endpoint that leverages SQLAlchemy `or_` conditions to filter tasks bounded by a `[start_date, end_date]` window, explicitly excluding null due dates and applying role-based visibility using the existing `check_project_access` dependency. On the frontend, integrate `react-day-picker` and `date-fns` within a new `CalendarView` module. State fetching will utilize `swr` keyed by the project ID and date window, keeping the fetching declarative and avoiding manual memoization.

## Architecture Decisions

### Decision: Calendar Endpoint Location

**Choice**: Add a dedicated `GET /api/v1/tasks/calendar` endpoint to `tasks.py`.
**Alternatives considered**: Overload the existing `GET /api/v1/tasks` with date boundary parameters.
**Rationale**: A dedicated endpoint ensures separation of concerns, avoiding complex conditional query building in the standard list endpoint while explicitly handling the strict `due_date.isnot(None)` requirement for the calendar.

### Decision: Frontend State Management

**Choice**: Local component state for UI window + SWR for declarative data fetching.
**Alternatives considered**: Store the fetched calendar tasks in the global `kanbanStore`.
**Rationale**: SWR's built-in caching and revalidation keyed by `[projectId, startDate, endDate]` is enough on its own; there is no need to duplicate this specific, time-bounded remote data into the global state manager.

## Data Flow

    CalendarView (react-day-picker) ──(startDate, endDate)──→ SWR Fetcher
           │                                                       │
           │                                                       ▼
    CalendarDaySidebar ←──────── (Tasks Data) ────────── GET /api/v1/tasks/calendar
           │
           └──→ Renders status-specific styles

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/api/v1/endpoints/tasks.py` | Modify | Add `GET /calendar` endpoint with `or_` bounding, `due_date` checks, and role filtering. |
| `frontend/src/services/api/index.js` | Modify | Export `getCalendarTasks(projectId, startDate, endDate)` function. |
| `frontend/src/pages/BoardPage.jsx` | Modify | Add "Calendar" to the `viewMode` toggle and render `CalendarView`. |
| `frontend/src/features/calendar/CalendarView.jsx` | Create | Main wrapper for `react-day-picker` handling the month/week window. |
| `frontend/src/features/calendar/CalendarDaySidebar.jsx` | Create | Sidebar component displaying the tasks assigned to the clicked day. |

## Interfaces / Contracts

**Backend SQLAlchemy Query (tasks.py):**
```python
from sqlalchemy import or_
from app.models.models import Task, UserRole

member = check_project_access(project_id, current_user, db)

query = db.query(Task).filter(
    Task.project_id == project_id,
    Task.due_date.isnot(None),
    or_(
        Task.start_date.between(start_date, end_date),
        Task.due_date.between(start_date, end_date)
    )
)

if current_user.role == UserRole.developer:
    query = query.filter(Task.assignee_id == current_user.id)
```

**Frontend SWR & Styling Usage (CalendarView.jsx):**
```jsx
import useSWR from 'swr';

// SWR Cache Key includes the parameters to automatically refetch when window changes
const { data: tasks, isLoading } = useSWR(
  ['/api/v1/tasks/calendar', projectId, startDate, endDate],
  () => getCalendarTasks(projectId, startDate, endDate)
);

// Standard inline style mapping matching project conventions
const getStatusStyle = (status) => {
  const styles = {
    pending: { backgroundColor: '#f1f5f9', color: '#1e293b' },
    in_progress: { backgroundColor: '#dbeafe', color: '#1e40af' },
    completed: { backgroundColor: '#dcfce3', color: '#166534' }
  };
  return styles[status] || { backgroundColor: '#e2e8f0', color: '#0f172a' };
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (Backend) | API endpoint bounds and rules | Test that `GET /calendar` returns 422 if params are missing, excludes tasks with null `due_date`, and applies developer role assignee filters correctly. |
| Unit (Frontend) | View modes and day selection | Verify `CalendarView` updates the `startDate` and `endDate` range when toggling between Week/Month modes. |
| Integration | Calendar to Sidebar data flow | Confirm that clicking a specific day passes the correct filtered subset of tasks to `CalendarDaySidebar`. |

## Migration / Rollout

- No database migrations required.
- **Rollout**: Requires `npm install date-fns react-day-picker` in the `frontend` workspace prior to running the application.

## Open Questions

- None at this time.
