from datetime import date, timedelta
from fastapi.testclient import TestClient
from fastapi import HTTPException
from unittest.mock import MagicMock, ANY
import pytest

from app.main import app
from app.models.models import UserRole, Task, Project
from app.schemas.schemas import TaskStatus
from app.db.database import get_db
from app.core.security import require_authenticated
from app.api.v1.endpoints.tasks import check_project_access

client = TestClient(app)

# Mock dependencies
@pytest.fixture
def mock_db_session():
    return MagicMock()

@pytest.fixture
def mock_current_user_admin():
    mock_user = MagicMock()
    mock_user.id = 1
    mock_user.role = UserRole.admin
    return mock_user

@pytest.fixture
def mock_current_user_manager():
    mock_user = MagicMock()
    mock_user.id = 2
    mock_user.role = UserRole.manager
    return mock_user

@pytest.fixture
def mock_current_user_developer():
    mock_user = MagicMock()
    mock_user.id = 3
    mock_user.role = UserRole.developer
    return mock_user

# Sample data
@pytest.fixture
def sample_project():
    project = MagicMock(spec=Project)
    project.id = 1
    project.name = "Test Project"
    return project

@pytest.fixture
def sample_tasks(sample_project, mock_current_user_developer, mock_current_user_manager):
    today = date.today()
    return [
        Task(id=1, project_id=sample_project.id, title="Dev Task 1", status=TaskStatus.in_progress,
                  start_date=today, due_date=today + timedelta(days=5), assignee_id=mock_current_user_developer.id, logged_hours=0.0, created_at=today),
        Task(id=2, project_id=sample_project.id, title="Manager Task 1", status=TaskStatus.todo,
                  start_date=today + timedelta(days=1), due_date=today + timedelta(days=6), assignee_id=mock_current_user_manager.id, logged_hours=0.0, created_at=today),
        Task(id=3, project_id=sample_project.id, title="Old Task", status=TaskStatus.done,
                  start_date=today - timedelta(days=10), due_date=today - timedelta(days=7), assignee_id=None, logged_hours=0.0, created_at=today),
        Task(id=4, project_id=sample_project.id, title="Future Task", status=TaskStatus.backlog,
                  start_date=today + timedelta(days=10), due_date=today + timedelta(days=15), assignee_id=None, logged_hours=0.0, created_at=today),
        Task(id=5, project_id=sample_project.id, title="Task No Due Date", status=TaskStatus.todo,
                  start_date=today, due_date=None, assignee_id=None, logged_hours=0.0, created_at=today),
        Task(id=6, project_id=sample_project.id, title="Dev Task 2", status=TaskStatus.review,
                  start_date=today + timedelta(days=2), due_date=today + timedelta(days=3), assignee_id=mock_current_user_developer.id, logged_hours=0.0, created_at=today),
    ]

class TestCalendarTasks:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_get_calendar_tasks_missing_params_422(self, mock_db_session, mock_current_user_admin):
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[require_authenticated] = lambda: mock_current_user_admin
        
        response = client.get("/api/v1/tasks/calendar")
        assert response.status_code == 422

    def test_get_calendar_tasks_project_access_denied_403(self, mock_db_session, mock_current_user_admin):
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[require_authenticated] = lambda: mock_current_user_admin
        
        def override_check_project_access(project_id, user, db):
            raise HTTPException(status_code=403, detail="Access denied")
        
        from unittest.mock import patch
        with patch("app.api.v1.endpoints.tasks.check_project_access", side_effect=HTTPException(status_code=403, detail="Access denied")):
            today = date.today()
            response = client.get(
                f"/api/v1/tasks/calendar?project_id=999&start_date={today}&end_date={today + timedelta(days=7)}"
            )
            assert response.status_code == 403
            assert response.json()["detail"] == "Access denied"

    def test_get_calendar_tasks_exclude_null_due_date(self, mock_db_session, mock_current_user_admin, sample_project, sample_tasks):
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[require_authenticated] = lambda: mock_current_user_admin

        expected_tasks = [t for t in sample_tasks if t.due_date is not None]
        mock_db_session.query.return_value.filter.return_value.all.return_value = expected_tasks

        from unittest.mock import patch
        with patch("app.api.v1.endpoints.tasks.check_project_access"):
            today = date.today()
            response = client.get(
                f"/api/v1/tasks/calendar?project_id={sample_project.id}&start_date={today}&end_date={today + timedelta(days=7)}"
            )
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data) == len(expected_tasks)

    def test_get_calendar_tasks_success_manager_admin(self, mock_db_session, mock_current_user_manager, sample_project, sample_tasks):
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[require_authenticated] = lambda: mock_current_user_manager
        
        expected_tasks = [t for t in sample_tasks if t.due_date is not None and (t.start_date <= date.today() + timedelta(days=7) and t.due_date >= date.today())]
        mock_db_session.query.return_value.filter.return_value.all.return_value = expected_tasks

        from unittest.mock import patch
        with patch("app.api.v1.endpoints.tasks.check_project_access"):
            today = date.today()
            response = client.get(
                f"/api/v1/tasks/calendar?project_id={sample_project.id}&start_date={today}&end_date={today + timedelta(days=7)}"
            )
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data) == len(expected_tasks)

    def test_get_calendar_tasks_response_fields(self, mock_db_session, mock_current_user_admin, sample_project, sample_tasks):
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[require_authenticated] = lambda: mock_current_user_admin
        
        expected_tasks = [t for t in sample_tasks if t.due_date is not None]
        mock_db_session.query.return_value.filter.return_value.all.return_value = expected_tasks
        
        from unittest.mock import patch
        with patch("app.api.v1.endpoints.tasks.check_project_access"):
            today = date.today()
            response = client.get(
                f"/api/v1/tasks/calendar?project_id={sample_project.id}&start_date={today}&end_date={today + timedelta(days=7)}"
            )
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data) > 0
            # Explicitly check for fields in TaskResponseFull
            assert "start_date" in response_data[0]
            assert "due_date" in response_data[0]
            assert "completed_at" in response_data[0]
            assert "created_at" in response_data[0]

    def test_get_calendar_tasks_developer_visibility(self, mock_db_session, mock_current_user_developer, sample_project, sample_tasks):
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[require_authenticated] = lambda: mock_current_user_developer

        developer_tasks = [t for t in sample_tasks if t.assignee_id == mock_current_user_developer.id and t.due_date is not None and (t.start_date <= date.today() + timedelta(days=7) and t.due_date >= date.today())]
        mock_db_session.query.return_value.filter.return_value.filter.return_value.all.return_value = developer_tasks

        from unittest.mock import patch
        with patch("app.api.v1.endpoints.tasks.check_project_access"):
            today = date.today()
            response = client.get(
                f"/api/v1/tasks/calendar?project_id={sample_project.id}&start_date={today}&end_date={today + timedelta(days=7)}"
            )
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data) == len(developer_tasks)
