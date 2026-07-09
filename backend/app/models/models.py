from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Enum as SQLEnum,
    ForeignKey,
    DECIMAL,
    DateTime,
    Date,
    JSON,
    Uuid,
    text,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.db.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    developer = "developer"
    viewer = "viewer"


class ProjectStatus(str, enum.Enum):
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    archived = "archived"


class MilestoneStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(
        String(255),
        default="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniJ7HQxQZFx3g8K5vP.8X/5oq",
    )
    role = Column(SQLEnum(UserRole), default=UserRole.developer)
    color = Column(String(7), default="#6366f1")
    is_active = Column(Boolean, default=True)  # Postgres boolean o smallint
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProjectMember(Base):
    __tablename__ = "project_members"
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role = Column(SQLEnum(UserRole), default=UserRole.developer)


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String)
    color = Column(String(7), default="#6366f1")
    icon = Column(String(10), default="🚀")
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.active)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    external_uuid = Column(Uuid(as_uuid=True), unique=True, nullable=True, index=True)
    project_type = Column(String(50), nullable=True)
    responsible_name = Column(String(255), nullable=True)
    budget_total = Column(DECIMAL(14, 2), default=0)
    budget_spent = Column(DECIMAL(14, 2), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProjectKpi(Base):
    __tablename__ = "project_kpis"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=True)
    target_value = Column(DECIMAL(14, 4), nullable=False)
    current_value = Column(DECIMAL(14, 4), default=0)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Milestone(Base):
    __tablename__ = "milestones"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    title = Column(String(255), nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(
        SQLEnum(MilestoneStatus), default=MilestoneStatus.pending, nullable=False
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProjectEvent(Base):
    __tablename__ = "project_events"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    event_type = Column(String(50), nullable=False)
    actor_name = Column(String(255), nullable=True)
    summary = Column(String, nullable=False)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Objective(Base):
    __tablename__ = "objectives"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    title = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TaskStatus(str, enum.Enum):
    backlog = "backlog"
    todo = "todo"
    in_progress = "in_progress"
    review = "review"
    done = "done"
    blocked = "blocked"


class TaskPriority(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class TaskType(str, enum.Enum):
    task = "task"
    subtask = "subtask"
    activity = "activity"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    objective_id = Column(Integer, ForeignKey("objectives.id", ondelete="SET NULL"))
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    parent_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    title = Column(String(255), nullable=False)
    description = Column(String)
    due_date = Column(DateTime(timezone=True))
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.backlog)
    priority = Column(SQLEnum(TaskPriority), default=TaskPriority.medium)
    type = Column(SQLEnum(TaskType), default=TaskType.task)
    position = Column(Integer, default=0)
    estimated_hours = Column(DECIMAL(5, 2))
    logged_hours = Column(DECIMAL(5, 2), default=0)
    start_date = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TimeLog(Base):
    __tablename__ = "time_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    hours = Column(DECIMAL(5, 2), nullable=False)
    description = Column(String, nullable=True)
    log_date = Column(DateTime(timezone=False), nullable=False)  # Guardamos como Date
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    from_status = Column(SQLEnum(TaskStatus))
    to_status = Column(SQLEnum(TaskStatus), nullable=False)
    comment = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
