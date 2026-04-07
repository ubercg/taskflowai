from pydantic import BaseModel, EmailStr, ConfigDict
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


class UserCreate(UserBase):
    role: Optional[str] = "developer"
    color: Optional[str] = "#6366f1"


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


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    """Campos opcionales para PATCH; ignora claves extra (p. ej. fechas solo en UI)."""

    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    status: Optional[str] = None


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# Objective Schemas
class ObjectiveBase(BaseModel):
    title: str
    due_date: datetime
    project_id: int


class ObjectiveCreate(ObjectiveBase):
    pass


class ObjectiveResponse(ObjectiveBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    progress: int = 0  # Calculado al vuelo o fallback


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
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[int] = None
    due_date: Optional[datetime] = None


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
