# Archive Report: Calendar View SDD Change

**Date Archived:** 2026-06-16  
**Change:** calendar-view  
**Project:** taskflowai  
**Artifact Store Mode:** openspec  

## Final Status

**Status:** PASS WITH WARNINGS  
**Verification Verdict:** 0 CRITICAL, 3 WARNING  
**Implementation:** Complete (with documented deferrals)  
**PR Status:** Both PRs #2 (backend) and #3 (frontend) merged to `dev` branch  

## Change Summary

The calendar-view SDD successfully delivered a task calendar visualization feature that allows users to view tasks filtered by date ranges (week, month, or year). The backend `GET /api/v1/tasks/calendar` endpoint is fully functional and tested; the frontend components are implemented and integrated into the UI.

## Deliverables

### Backend (PR #2 — Merged to dev)
- **Endpoint:** `GET /api/v1/tasks/calendar`  
  - Accepts mandatory query parameters: `project_id`, `start_date`, `end_date` (ISO 8601 format)  
  - Filters tasks by date range using SQLAlchemy `or_` condition: `Task.start_date.between(start_date, end_date)` OR `Task.due_date.between(start_date, end_date)`  
  - Excludes tasks with null `due_date` using `.isnot(None)` filter  
  - Applies role-based visibility: developers see only their assigned tasks; managers/admins see all project tasks  
  - Returns 422 for missing parameters, 403 for access denied  
  - Response schema: Array of task objects (id, title, status, start_date, due_date)  

- **Files Modified:**
  - `backend/app/api/v1/endpoints/tasks.py` — Added `/calendar` endpoint with full date-range filtering logic

- **Tests:** 7 passing backend tests covering parameter validation, null `due_date` exclusion, and role-based filtering  

### Frontend (PR #3 — Merged to dev)
- **CalendarView Component** (`frontend/src/features/calendar/CalendarView.jsx`)  
  - Renders calendar using `react-day-picker` library  
  - Local state management for date window (startDate, endDate, selectedDay)  
  - SWR data fetching with cache key `['/api/v1/tasks/calendar', projectId, startDate, endDate]`  
  - Month view fully functional; week/year view toggle structure in place (see Deferred Items)  

- **CalendarDaySidebar Component** (`frontend/src/features/calendar/CalendarDaySidebar.jsx`)  
  - Displays tasks for selected day  
  - Status-specific visual styling using project conventions (pending, in_progress, completed)  

- **API Integration** (`frontend/src/services/api/index.js`)  
  - New function `getCalendarTasks(projectId, startDate, endDate)` exported  

- **UI Integration** (`frontend/src/pages/BoardPage.jsx`)  
  - Added "Calendar" view mode toggle option  
  - Conditional rendering of CalendarView based on selected viewMode  

- **Dependencies Added:**
  - `date-fns` (date manipulation)  
  - `react-day-picker` (calendar component)  

- **Tests:** 2 passing frontend tests for CalendarView component; basic rendering and SWR integration verified  

## Specification Compliance

| Requirement | Status | Notes |
|---|---|---|
| Task Calendar Fetching endpoint | ✅ Complete | Backend endpoint fully implements spec |
| Required parameters (project_id, start_date, end_date) | ✅ Complete | All required; returns 422 if missing |
| Exclude null due_date tasks | ✅ Complete | Implemented via `.isnot(None)` filter |
| Role-based visibility | ✅ Complete | Developer filtering implemented and tested |
| Missing parameter handling (422) | ✅ Complete | FastAPI automatic validation |
| Access denied handling (403) | ✅ Complete | check_project_access dependency validates |
| Calendar UI Modes (Week/Month/Year toggle) | ⚠️ Partial | Month view implemented; toggle structure in place but week/year views deferred |
| Day Selection Behavior | ✅ Complete | Click to select day and view tasks implemented |
| Task Visual States | ✅ Complete | Status-specific styling implemented |

## Deferred Items (Documented Tracked Deferrals)

The following items from the specification are intentionally deferred to a follow-up SDD change, documented and tracked:

### W-01: Week/Year View Toggle
**Status:** Deferred  
**Spec Section:** "Requirement: Calendar UI Modes" — "Switch calendar modes (Week, Month, or Year)"  
**What Was Delivered:** Month view and calendar navigation structure  
**What Is Deferred:** Week and year view modes; the toggle UI exists but routes to month view only  
**Reasoning:** The week/year calculations require additional date boundary logic and testing; delivering month view first allows validation of the calendar architecture before adding view variants  
**Follow-up SDD:** Create `/sdd-new "calendar-view-week-year-modes"` to implement week and year views  
**Risk:** Users currently cannot view week or year perspectives; this limits planning visibility for those timeframes  

### W-02: Frontend Integration Tests (Tasks 4.1, 4.2)
**Status:** Blocked — Vitest Module Resolution Issue  
**What Was Blocked:** Tasks 4.1 (view mode toggling tests) and 4.2 (sidebar data flow integration tests)  
**Reason:** Vitest configuration issue unrelated to calendar-view feature; affects broader frontend test suite  
**Impact:** Frontend calendar implementation is functionally correct but lacks comprehensive automated test coverage for interaction scenarios  
**Follow-up:** Address Vitest module resolution in a separate infrastructure improvement SDD  

### W-03: Response Schema Superset
**Status:** Accepted — Not a Bug  
**What:** Backend returns TaskResponseFull (all task fields) instead of minimal schema {id, title, status, start_date, due_date}  
**Why:** TaskResponseFull is a superset; includes all spec fields plus additional metadata  
**Decision:** Frontend filters what it needs; no schema mismatch  
**No Action:** Accepted as-is; no spec violation  

## Merged Pull Requests

| PR # | Title | Branch | Status | Key Changes |
|---|---|---|---|---|
| #2 | Backend: Calendar View Endpoint | dev | ✅ Merged | `GET /api/v1/tasks/calendar`, role-based filtering, date range queries |
| #3 | Frontend: Calendar Components & Integration | dev | ✅ Merged | CalendarView, CalendarDaySidebar, BoardPage integration, dependencies |

## Key Technical Decisions

### Decision 1: Dedicated Endpoint vs. Extended `/tasks` Endpoint
**Choice:** Created new dedicated `GET /api/v1/tasks/calendar` endpoint  
**Rationale:** Separation of concerns; prevents complexity in general-purpose task listing endpoint  
**Implementation:** Separate route handler in `tasks.py` with explicit date-bounding logic  

### Decision 2: Frontend State Management Strategy
**Choice:** Local component state for UI window + SWR for declarative data fetching  
**Alternative Considered:** Store fetched calendar tasks in global `kanbanStore`  
**Rationale:** SWR's built-in caching keyed by `[projectId, startDate, endDate]` is sufficient; no need to duplicate time-bounded remote data into global state  

### Decision 3: Date Boundary Logic (SQLAlchemy)
**Choice:** Used SQLAlchemy `or_` with `.between()` on both `start_date` AND `due_date`  
**SQL Generated:** `(start_date BETWEEN ? AND ?) OR (due_date BETWEEN ? AND ?)`  
**Rationale:** Captures tasks that begin, end, or span within the requested window; filters null `due_date` explicitly with `.isnot(None)`  

### Decision 4: Frontend Calendar Library
**Choice:** `react-day-picker` (unstyled) + `date-fns` (utilities)  
**Rationale:** Unstyled component allows full Tailwind integration; `date-fns` provides ISO 8601 parsing and date arithmetic  

### Decision 5: Response Schema
**Choice:** Return TaskResponseFull (superset of spec requirements)  
**Rationale:** Frontend can filter; maintains consistency with existing task response schema across the API  

## Test Coverage Summary

### Backend Tests: ✅ 7 Passed
- Parameter validation (422 for missing fields)  
- Null `due_date` exclusion  
- Role-based developer filtering  
- Date boundary logic  
- Project access control (403)  

**Coverage:** All backend requirements validated by automated tests  

### Frontend Tests: ⚠️ 2 Passed (Partial)
- Basic CalendarView rendering  
- SWR integration and cache key structure  

**Gaps:** View mode toggling interaction tests and sidebar data flow tests blocked by Vitest configuration  

**Coverage:** Core component rendering tested; interaction scenarios incomplete  

## Warnings and Risks

### W-01: Backend Deprecation Warnings
- `fastapi.testclient` + `httpx` deprecation  
- `passlib.utils` + `crypt` (Python 3.13)  

**Severity:** Medium (non-blocking; affects future compatibility)  

### W-02: Frontend Development Warnings
- React Router v7 future flags (not calendar-specific)  
- Vitest `--localstorage-file` configuration  
- UserFormModal controlled/uncontrolled input (unrelated to calendar)  

**Severity:** Low (development tooling; no impact on feature functionality)  

### R-01: Frontend Test Coverage Gap Risk
**Severity:** Medium  
**Impact:** View mode toggling and day selection data flow are not automated; regressions could be introduced without being caught  
**Mitigation:** Unblock Vitest and implement missing integration tests in follow-up work  

### R-02: Incomplete View Mode Implementation
**Severity:** Medium  
**Impact:** Users cannot access week or year views despite spec requiring them  
**Mitigation:** Documented deferral; tracked for follow-up SDD  

## Rollback and Maintenance

### Rollback Plan (If Needed)
1. Revert backend: Remove `GET /calendar` endpoint from `tasks.py`  
2. Revert frontend: Remove CalendarView components and routes from BoardPage  
3. Remove dependencies: `npm uninstall date-fns react-day-picker`  
4. No database migrations to reverse (no schema changes)  

### Maintenance Notes
- Calendar endpoint is stateless; no background jobs or async tasks  
- No new database columns or migrations  
- Date parsing relies on ISO 8601 format (enforced by `date-fns`)  
- Role-based filtering delegates to existing `check_project_access` dependency  

## Artifacts Preserved in Archive

Archive location: `openspec/changes/archive/2026-06-16-calendar-view/`

- ✅ `proposal.md` — Original SDD proposal with scope and intent  
- ✅ `exploration.md` — Investigation of approaches and recommendations  
- ✅ `design.md` — Technical architecture and design decisions  
- ✅ `tasks.md` — Task breakdown with completion status  
- ✅ `verify-report.md` — Verification report with test evidence  
- ✅ `specs/calendar-view/spec.md` — Delta spec (canonical copy at `openspec/specs/calendar-view/spec.md`)  

## Synced to Canonical Specs

- **New:** `openspec/specs/calendar-view/spec.md` — Complete specification for calendar-view feature  
  - 4 Requirements (Task Calendar Fetching, UI Modes, Day Selection, Task Visual States)  
  - 7 Scenarios with GIVEN/WHEN/THEN test narratives  
  - Full API contract (endpoint, parameters, error codes)  

## Next Recommended Actions

### High Priority
1. **Unblock and Complete Frontend Tests**  
   - Resolve Vitest module resolution issue  
   - Implement tests for tasks 4.1 (view mode toggling) and 4.2 (sidebar data flow)  
   - Follow-up: Infrastructure/testing SDD  

2. **Implement Week/Year Views (Deferred Feature)**  
   - Create new SDD: `/sdd-new "calendar-view-week-year-modes"`  
   - Add week boundary logic (Monday–Sunday calculations)  
   - Add year view aggregation logic  

### Medium Priority
3. **Address Backend Deprecation Warnings**  
   - Upgrade `httpx` or pin `httpx2`  
   - Address `passlib` Python 3.13 compatibility  

4. **Investigate Performance at Scale**  
   - Test with large date ranges (e.g., full year of tasks)  
   - Consider pagination or filtering strategies if needed  

### Low Priority
5. **Polish Frontend Warnings**  
   - React Router v7 migration planning  
   - UserFormModal controlled component fix (unrelated)  

## Closure Statement

The calendar-view SDD change has reached completion with a **PASS WITH WARNINGS** verdict. The core feature—a month-view calendar with date-range task filtering—is fully implemented, merged to the `dev` branch, and tested on the backend. Frontend implementation is functionally complete but has documented test coverage gaps that should be addressed in follow-up work.

All documented deferrals (week/year views, integration tests, deprecation warnings) are tracked and ready for their respective follow-up SDD changes or infrastructure improvements.

**Status: ARCHIVED AND CLOSED**

The change is ready for promotion to main branch pending the completion of testing enhancements and any additional quality assurance steps your workflow requires.

---

**Archived By:** SDD Archive Phase  
**Archive Date:** 2026-06-16  
**Archive Location:** openspec/changes/archive/2026-06-16-calendar-view/  
**Canonical Specs Updated:** openspec/specs/calendar-view/spec.md

---

## Post-Archive Amendment — 2026-06-18

**Type:** UI Redesign  
**Scope:** Frontend only — no backend changes  
**Commits:** `dev 13f638f`, `main 67328bd`

### What Changed

`CalendarView.jsx` was completely rewritten to replace the `react-day-picker` + lateral sidebar layout with a native full month grid calendar:

| Before | After |
|--------|-------|
| `react-day-picker` DayPicker component | Custom 7-column CSS Grid (LUN→DOM, week starts Monday) |
| CalendarDaySidebar as a side panel | Task cards rendered inline inside each day cell |
| No filter bar | Filter bar: date range display + status dropdown + Limpiar Filtros |
| No today highlight | Today's cell has indigo top border + bold indigo day number |

**CalendarDaySidebar.jsx** converted to a minimal internal `TaskCard` component — sidebar panel layout removed, module kept to avoid import breaks.

### Task Card Design

Each task card in a day cell shows:
- Time (HH:mm from `task.due_date`)
- Title (truncated with `text-overflow: ellipsis`)
- Status badge with same color palette as original sidebar (backlog/todo/in_progress/review/done/blocked)
- Left border colored by status

### Filter Bar

- **Filtrar por fecha:** Two read-only date inputs auto-reflecting the current month range (updates on month navigation)
- **Filtrar por estado:** `<select>` dropdown filtering tasks client-side (no additional API call)
- **Limpiar Filtros:** Resets status filter to "all"

### Dependencies Note

`react-day-picker` remains declared in `package.json` (added in commit `2dd00a5`) but is no longer imported anywhere in the codebase after this redesign. It can be removed in a maintenance pass: `npm uninstall react-day-picker`.

### Test Status

Existing 2 Vitest tests continue to pass without modification (SWR behavior and component rendering are preserved).
