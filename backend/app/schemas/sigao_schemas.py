from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal


# Hito title is stored on `Task.title`, a `String(255)` column — reject
# over-long titles at the schema boundary with a clean 422 instead of
# letting a mid-loop DB failure surface as a 500.
HITO_TITLE_MAX_LENGTH = 255


class InitialKpiCreate(BaseModel):
    name: str
    mode: str = "manual"  # manual | milestone (ADR-16: SIGAO create seeds mode)
    progress_pct: Optional[int] = Field(default=0, ge=0, le=100)
    # Legacy numeric fields kept optional for older SIGAO clients; ignored by Objective path.
    target_value: Optional[Decimal] = Field(default=None, gt=0)
    current_value: Decimal = Field(default=Decimal("0"), ge=0)
    unit: Optional[str] = None
    hitos: list[str] = Field(default_factory=list)  # initial Hitos del KPI (milestone only)

    @field_validator("hitos")
    @classmethod
    def hitos_title_max_length(cls, value: list[str]) -> list[str]:
        for title in value:
            if title and len(str(title).strip()) > HITO_TITLE_MAX_LENGTH:
                raise ValueError(
                    f"El título del hito no puede superar {HITO_TITLE_MAX_LENGTH} caracteres"
                )
        return value


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


# --- Hitos del KPI (Task under Objective) ---
# Naming firewall (ADR-15): NEVER reuse "milestone" naming here — Hitos del
# proyecto (native `Milestone`) and Hitos del KPI (`Task.objective_id`) are
# distinct concepts with distinct schemas/lifecycles.
class KpiHitoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    objective_id: int
    title: str
    completed: bool  # derived: status == 'done'
    completed_at: Optional[datetime] = None
    position: int = 0
    created_at: datetime


class KpiHitoCreate(BaseModel):
    title: str = Field(max_length=HITO_TITLE_MAX_LENGTH)
    position: Optional[int] = 0
    actor_name: Optional[str] = None


class KpiHitoUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = Field(default=None, max_length=HITO_TITLE_MAX_LENGTH)
    completed: Optional[bool] = None
    position: Optional[int] = None
    actor_name: Optional[str] = None


# --- Objective comments (manual trail) ---
class ObjectiveCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    objective_id: int
    body: str
    actor_name: Optional[str] = None
    created_at: datetime


class ObjectiveCommentCreate(BaseModel):
    body: str = Field(min_length=1)
    actor_name: Optional[str] = None


# --- KPI-objective (Objective acting as a SIGAO KPI) ---
class KpiObjectiveCreate(BaseModel):
    title: str
    mode: str = Field(default="manual", pattern="^(manual|milestone)$")
    description: Optional[str] = None
    due_date: Optional[datetime] = None  # optional; native objectives require it
    progress_pct: Optional[int] = Field(default=0, ge=0, le=100)  # manual seed only
    hitos: list[str] = Field(default_factory=list)  # initial Hitos del KPI (milestone only)
    actor_name: Optional[str] = None

    @field_validator("hitos")
    @classmethod
    def hitos_title_max_length(cls, value: list[str]) -> list[str]:
        for title in value:
            if title and len(str(title).strip()) > HITO_TITLE_MAX_LENGTH:
                raise ValueError(
                    f"El título del hito no puede superar {HITO_TITLE_MAX_LENGTH} caracteres"
                )
        return value


class KpiObjectiveUpdate(BaseModel):
    """Rename / retarget only — `mode` is immutable once set (Invariant 9)."""

    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    description: Optional[str] = None
    actor_name: Optional[str] = None


class KpiObjectiveProgressUpdate(BaseModel):
    progress_pct: int = Field(ge=0, le=100)
    comment: Optional[str] = None  # optional trail entry
    actor_name: Optional[str] = None


class KpiObjectiveResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    title: str
    description: Optional[str] = None
    mode: str  # 'manual' | 'milestone'
    progress: int  # resolved (stored OR derived)
    hitos: list[KpiHitoResponse] = []
    comments: list[ObjectiveCommentResponse] = []
    created_at: datetime
