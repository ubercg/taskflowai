import pytest
from datetime import date, datetime, timedelta, timezone, time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.models import Base, Project, Task, UserRole, User
from app.db.database import get_db
from app.core.security import require_authenticated

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=__import__('sqlalchemy.pool').StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

class MockUser:
    id = 1
    role = "admin"

def override_require_authenticated():
    return MockUser()



@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    user = User(id=1, email="test@test.com", password_hash="pw", name="Admin", role=UserRole.admin, is_active=True)
    db.add(user)
    
    project = Project(id=1, name="Test Project", status="active")
    db.add(project)
    db.commit()
    
    today = date.today()
    
    # Task due at 23:59:59 of today
    task1 = Task(
        id=1,
        project_id=1,
        title="Late today task",
        start_date=datetime.combine(today - timedelta(days=1), time.min, tzinfo=timezone.utc),
        due_date=datetime.combine(today, time(23, 59, 59), tzinfo=timezone.utc),
        assignee_id=1
    )
    # Task due at 00:00:01 of tomorrow (should not be included if end_date is today)
    task2 = Task(
        id=2,
        project_id=1,
        title="Tomorrow task",
        start_date=datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc),
        due_date=datetime.combine(today + timedelta(days=1), time(0, 0, 1), tzinfo=timezone.utc),
        assignee_id=1
    )
    db.add(task1)
    db.add(task2)
    db.commit()
    yield
    db.close()

def test_get_calendar_tasks_end_of_day_boundary():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_authenticated] = override_require_authenticated
    from unittest.mock import patch
    with patch("app.api.v1.endpoints.tasks.check_project_access"):
        today = date.today()
        # Query exactly 'today'
        response = client.get(
            f"/api/v1/tasks/calendar?project_id=1&start_date={today}&end_date={today}"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Late today task"
