from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal


class InitialKpiCreate(BaseModel):
    name: str
    target_value: Decimal = Field(gt=0)
    current_value: Decimal = Field(default=Decimal("0"), ge=0)
    unit: Optional[str] = None


class SigaoProjectCreate(BaseModel):
    external_uuid: UUID
    name: str
    description: Optional[str] = None
    project_type: Optional[str] = None
    responsible_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget_total: Decimal = Field(default=Decimal("0"), ge=0)
    budget_spent: Decimal = Field(default=Decimal("0"), ge=0)
    status: Optional[str] = "active"
    initial_kpi: Optional[InitialKpiCreate] = None
    actor_name: Optional[str] = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class SigaoProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[str] = None
    responsible_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget_total: Optional[Decimal] = Field(default=None, ge=0)
    budget_spent: Optional[Decimal] = Field(default=None, ge=0)
    status: Optional[str] = None
    actor_name: Optional[str] = None


class ProjectKpiResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    name: str
    unit: Optional[str] = None
    target_value: Decimal
    current_value: Decimal
    sort_order: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProjectKpiCreate(BaseModel):
    name: str
    target_value: Decimal = Field(gt=0)
    current_value: Decimal = Field(default=Decimal("0"), ge=0)
    unit: Optional[str] = None
    sort_order: Optional[int] = 0
    actor_name: Optional[str] = None


class ProjectKpiUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    target_value: Optional[Decimal] = Field(default=None, gt=0)
    current_value: Optional[Decimal] = Field(default=None, ge=0)
    unit: Optional[str] = None
    sort_order: Optional[int] = None
    actor_name: Optional[str] = None


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    title: str
    due_date: date
    status: str
    completed_at: Optional[datetime] = None
    sort_order: int = 0
    created_at: datetime


class MilestoneCreate(BaseModel):
    title: str
    due_date: date
    sort_order: Optional[int] = 0
    actor_name: Optional[str] = None


class MilestoneUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    sort_order: Optional[int] = None
    actor_name: Optional[str] = None


class ProjectEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    event_type: str
    actor_name: Optional[str] = None
    summary: str
    payload: Optional[dict] = None
    created_at: datetime


class SigaoProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    external_uuid: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    project_type: Optional[str] = None
    responsible_name: Optional[str] = None
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget_total: Decimal = Decimal("0")
    budget_spent: Decimal = Decimal("0")
    color: Optional[str] = "#6366f1"
    icon: Optional[str] = "🚀"
    created_at: datetime
    kpis: list[ProjectKpiResponse] = []
    milestones: list[MilestoneResponse] = []
