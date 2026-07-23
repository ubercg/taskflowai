from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import List, Optional
from datetime import date, datetime
from app.models.models import TaskStatus, TaskPriority, TaskType


# Common Base Config
class ConfigBase(BaseModel):
    model_config = {"from_attributes": True}


# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    role: str
    color: Optional[str] = "#6366f1"
    is_active: bool = True


# Project Schemas
class ProjectBase(BaseModel):
    name: str
    status: Optional[str] = "active"
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"
    icon: Optional[str] = "🚀"
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    """Campos opcionales para PATCH."""

    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# Objective Schemas
class ObjectiveBase(BaseModel):
    title: str
    due_date: datetime
    project_id: int
    description: Optional[str] = None


class ObjectiveCreate(ObjectiveBase):
    pass


class ObjectiveUpdate(BaseModel):
    """Optional fields for PATCH (mirrors ProjectUpdate pattern)."""

    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    due_date: Optional[datetime] = None
    description: Optional[str] = None


class ObjectiveResponse(ObjectiveBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    mode: str = "milestone"
    progress: int = 0  # Derived server-side; default 0 when no tasks exist


# Task Schemas ampliados (agregando los que faltaban)
class TaskBase(BaseModel):
    title: str
    project_id: int
    objective_id: Optional[int] = None
    assignee_id: Optional[int] = None
    parent_id: Optional[int] = None
    status: Optional[TaskStatus] = TaskStatus.backlog
    priority: Optional[TaskPriority] = TaskPriority.medium
    type: Optional[TaskType] = TaskType.task
    position: Optional[int] = 0
    estimated_hours: Optional[float] = None
    description: Optional[str] = None


class TaskCreate(TaskBase):
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    # `status` is intentionally NOT here: it carries the WIP / open-subtasks
    # invariants (RN-01, RN-02) enforced only by PATCH /tasks/{id}/move.
    # Allowing it through this generic update would bypass those guards
    # (TSK-004). The status transition has exactly one path: /move.
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[int] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None


# Este ya lo teníamos pero lo amplío con Config
class TaskMove(BaseModel):
    status: TaskStatus
    position: Optional[int] = None
    user_id: Optional[int] = None


class TaskResponseFull(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    logged_hours: float
    start_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    due_date: Optional[datetime] = None


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    position: Optional[int] = None


# TimeLog Schemas
class TimeLogBase(BaseModel):
    task_id: int
    user_id: int
    hours: float
    description: Optional[str] = None
    log_date: date


class TimeLogCreate(TimeLogBase):
    pass


class TimeLogResponse(TimeLogBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
