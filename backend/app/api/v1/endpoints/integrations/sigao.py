import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.api.v1.endpoints.objectives import _PROGRESS_SELECT
from app.core.security import hash_password
from app.core.errors import api_error
from app.core.sigao_auth import verify_sigao_api_key
from app.db.database import get_db
from app.models.models import (
    Milestone,
    Objective,
    ObjectiveComment,
    Project,
    ProjectKpi,
    ProjectMember,
    ProjectStatus,
    Task,
    TaskStatus,
    TaskType,
    User,
    UserRole,
)
from app.schemas.sigao_schemas import (
    InitialKpiCreate,
    KpiHitoCreate,
    KpiHitoResponse,
    KpiHitoUpdate,
    KpiObjectiveCreate,
    KpiObjectiveProgressUpdate,
    KpiObjectiveResponse,
    KpiObjectiveUpdate,
    ObjectiveCommentCreate,
    ObjectiveCommentResponse,
    SigaoProjectCreate,
    SigaoProjectResponse,
    SigaoProjectResponsibleResponse,
    SigaoProjectResponsibleUpdate,
    SigaoProjectUpdate,
    SigaoUserEnsure,
    SigaoUserEnsureResponse,
)
from app.services.project_events import record_project_event
from app.services.sigao_projects import (
    build_sigao_project_response,
    get_project_by_external_uuid,
)

router = APIRouter(dependencies=[Depends(verify_sigao_api_key)])


# ---------------------------------------------------------------------------
# KPI-objective helpers
# ---------------------------------------------------------------------------


def _resolve_kpi_due_date(project: Project) -> datetime:
    """Default due_date for a KPI-objective: project.end_date, else NOW()+90d."""
    if project.end_date:
        return datetime.combine(project.end_date, datetime.min.time()).replace(
            tzinfo=timezone.utc
        )
    return datetime.now(timezone.utc) + timedelta(days=90)


def _get_objective_or_404(db: Session, objective_id: int, project_id: int) -> Objective:
    obj = db.query(Objective).filter(Objective.id == objective_id).first()
    if not obj:
        raise api_error(404, "OBJECTIVE_NOT_FOUND", "Objective not found")
    # Compound scoping (mandatory): the objective must actually belong to the
    # caller's project — mirrors how native `project_kpis` already
    # compound-scope by (id, project_id). `project_id` is a required query
    # param on every objective_id-keyed route, so this check always runs.
    if obj.project_id != project_id:
        raise api_error(404, "OBJECTIVE_NOT_FOUND", "Objective not found")
    return obj


def _task_to_hito(task: Task) -> KpiHitoResponse:
    status_value = (
        task.status.value if isinstance(task.status, TaskStatus) else str(task.status)
    )
    return KpiHitoResponse(
        id=task.id,
        objective_id=task.objective_id,
        title=task.title,
        completed=status_value == TaskStatus.done.value,
        completed_at=task.completed_at,
        position=task.position or 0,
        created_at=task.created_at,
    )


def _build_kpi_objective_response(db: Session, objective_id: int) -> KpiObjectiveResponse:
    row = db.execute(
        text(_PROGRESS_SELECT.format(where="o.id = :objective_id")),
        {"objective_id": objective_id},
    ).mappings().first()
    if not row:
        raise api_error(404, "OBJECTIVE_NOT_FOUND", "Objective not found")

    hitos = (
        db.query(Task)
        .filter(Task.objective_id == objective_id)
        .order_by(Task.position, Task.id)
        .all()
    )
    comments = (
        db.query(ObjectiveComment)
        .filter(ObjectiveComment.objective_id == objective_id)
        .order_by(ObjectiveComment.created_at.desc())
        .all()
    )
    return KpiObjectiveResponse(
        id=row["id"],
        project_id=row["project_id"],
        title=row["title"],
        description=row["description"],
        mode=row["mode"],
        progress=row["progress"],
        hitos=[_task_to_hito(t) for t in hitos],
        comments=[ObjectiveCommentResponse.model_validate(c) for c in comments],
        created_at=row["created_at"],
    )


def _apply_status(project: Project, status: str | None) -> None:
    if status is not None:
        project.status = ProjectStatus(status)


def _get_user_by_email_ci(db: Session, email: str) -> User | None:
    """Case-insensitive email lookup (`User.email` has no DB-level CI collation)."""
    return db.query(User).filter(func.lower(User.email) == email.lower()).first()


def _ensure_sigao_user(db: Session, email: str, name: str) -> tuple[User, bool]:
    """Find-or-create a User for SIGAO-driven flows.

    New users are provisioned as global `developer` with `is_active=True`.
    They authenticate via SIGAO SSO, not TaskFlow local login, so the
    password is a random unrecoverable value (never the model/init.sql
    shared default hash, and never `DEFAULT_NEW_USER_PASSWORD`).
    Returns (user, created).
    """
    existing = _get_user_by_email_ci(db, email)
    if existing:
        return existing, False

    user = User(
        email=email,
        name=name,
        role=UserRole.developer,
        is_active=True,
        password_hash=hash_password(secrets.token_urlsafe(32)),
    )
    db.add(user)
    db.flush()
    return user, True


def _seed_kpi_hitos(
    db: Session, project_id: int, objective_id: int, hito_titles: list[str]
) -> None:
    """Seed initial Hitos del KPI for a milestone-mode Objective, atomically.

    Each Task is added and flushed individually (single-row INSERT) rather
    than left for SQLAlchemy's batched multi-row "insertmanyvalues" flush:
    the ORM-declared enum type name (`taskstatus`, derived from the Python
    `TaskStatus` class) doesn't match the actual Postgres enum type name
    (`task_status`, from docker/init.sql); Postgres can infer/cast the
    per-row scalar bind in a single-row INSERT but not in a batched
    multi-row VALUES insert. Deferring the commit to the caller (instead of
    committing per row) keeps the whole objective+hitos creation in ONE
    transaction: if any row fails, nothing is committed and the caller's
    session rollback (on `db.close()`) discards the objective and any
    already-flushed hitos too — no orphan objective/tasks persist.
    """
    for position, title in enumerate(hito_titles):
        clean_title = str(title).strip() if title else ""
        if not clean_title:
            continue
        if len(clean_title) > 255:
            # Belt-and-suspenders: schema validation already rejects this at
            # the request boundary (422), this guards any internal caller.
            raise api_error(422, "SIGAO_HITO_TITLE_TOO_LONG", "El título del hito no puede superar 255 caracteres")
        db.add(
            Task(
                project_id=project_id,
                objective_id=objective_id,
                title=clean_title,
                status=TaskStatus.todo,
                type=TaskType.task,
                position=position,
            )
        )
        db.flush()


def _seed_initial_kpi_objective(
    db: Session, project: Project, kpi: InitialKpiCreate
) -> Objective:
    """Seed one Objective (+ optional milestone hitos) inside the caller's TX.

    Caller owns the commit. ADR-11/ADR-16: SIGAO create provisions Objectives,
    not ProjectKpi rows.
    """
    mode = kpi.mode
    progress_pct = kpi.progress_pct if mode == "manual" else None
    if mode == "manual" and progress_pct is None:
        progress_pct = 0

    kpi_objective = Objective(
        project_id=project.id,
        title=kpi.name,
        description=None,
        due_date=_resolve_kpi_due_date(project),
        mode=mode,
        progress_pct=progress_pct,
    )
    db.add(kpi_objective)
    db.flush()

    if mode == "milestone" and kpi.hitos:
        _seed_kpi_hitos(db, project.id, kpi_objective.id, list(kpi.hitos))

    return kpi_objective


@router.post("/projects", response_model=SigaoProjectResponse)
def create_sigao_project(
    payload: SigaoProjectCreate,
    response: Response,
    db: Session = Depends(get_db),
):
    existing = get_project_by_external_uuid(db, payload.external_uuid)
    if existing:
        response.status_code = 200
        return build_sigao_project_response(db, existing)

    response.status_code = 201

    project = Project(
        external_uuid=payload.external_uuid,
        name=payload.name,
        description=payload.description,
        project_type=payload.project_type,
        responsible_name=payload.responsible_name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        budget_total=payload.budget_total,
        budget_spent=payload.budget_spent,
        status=ProjectStatus(payload.status or "active"),
    )
    db.add(project)
    db.flush()

    for kpi in payload.initial_kpis:
        _seed_initial_kpi_objective(db, project, kpi)

    record_project_event(
        db,
        project_id=project.id,
        event_type="project_created",
        summary=f"Proyecto «{project.name}» creado desde SIGAO",
        actor_name=payload.actor_name,
    )
    db.commit()
    db.refresh(project)

    return build_sigao_project_response(db, project)


@router.get("/projects", response_model=list[SigaoProjectResponse])
def list_sigao_projects(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Project).filter(Project.external_uuid.isnot(None))
    if status:
        q = q.filter(Project.status == ProjectStatus(status))
    projects = q.order_by(Project.created_at.desc()).all()
    return [build_sigao_project_response(db, p) for p in projects]


@router.get("/projects/{external_uuid}", response_model=SigaoProjectResponse)
def get_sigao_project(external_uuid: UUID, db: Session = Depends(get_db)):
    project = get_project_by_external_uuid(db, external_uuid)
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")
    return build_sigao_project_response(db, project)


@router.patch("/projects/{external_uuid}", response_model=SigaoProjectResponse)
def update_sigao_project(
    external_uuid: UUID,
    payload: SigaoProjectUpdate,
    db: Session = Depends(get_db),
):
    project = get_project_by_external_uuid(db, external_uuid)
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")

    data = payload.model_dump(exclude_unset=True)
    actor_name = data.pop("actor_name", None)
    status = data.pop("status", None)
    for key, value in data.items():
        setattr(project, key, value)
    _apply_status(project, status)

    record_project_event(
        db,
        project_id=project.id,
        event_type="project_updated",
        summary=f"Proyecto «{project.name}» actualizado desde SIGAO",
        actor_name=actor_name,
        payload={"fields": list(data.keys())},
    )
    db.commit()
    db.refresh(project)
    return build_sigao_project_response(db, project)


@router.delete("/projects/{external_uuid}", status_code=204)
def delete_sigao_project(external_uuid: UUID, db: Session = Depends(get_db)):
    project = get_project_by_external_uuid(db, external_uuid)
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")
    db.delete(project)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# KPI-objectives (SIGAO KPI ⇒ TaskFlow Objective, mode-split)
# ---------------------------------------------------------------------------


@router.get(
    "/projects/{external_uuid}/objectives",
    response_model=list[KpiObjectiveResponse],
)
def list_kpi_objectives(external_uuid: UUID, db: Session = Depends(get_db)):
    project = get_project_by_external_uuid(db, external_uuid)
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")
    ids = [
        row.id
        for row in db.query(Objective.id)
        .filter(Objective.project_id == project.id)
        .order_by(Objective.created_at.desc())
        .all()
    ]
    return [_build_kpi_objective_response(db, oid) for oid in ids]


@router.post(
    "/projects/{external_uuid}/objectives",
    response_model=KpiObjectiveResponse,
    status_code=201,
)
def create_kpi_objective(
    external_uuid: UUID,
    payload: KpiObjectiveCreate,
    db: Session = Depends(get_db),
):
    project = get_project_by_external_uuid(db, external_uuid)
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")

    due_date = payload.due_date or _resolve_kpi_due_date(project)
    # progress_pct is only settable for manual mode (Invariant 9);
    # milestone-mode objectives always derive progress from Hitos del KPI.
    if payload.mode == "manual":
        progress_pct = payload.progress_pct if payload.progress_pct is not None else 0
    else:
        progress_pct = None

    objective = Objective(
        project_id=project.id,
        title=payload.title,
        description=payload.description,
        due_date=due_date,
        mode=payload.mode,
        progress_pct=progress_pct,
    )
    db.add(objective)
    db.flush()

    # Same atomic seeding path as create_sigao_project (Fix #1): objective +
    # hitos land in a single transaction, one commit below.
    if payload.mode == "milestone" and payload.hitos:
        _seed_kpi_hitos(db, project.id, objective.id, list(payload.hitos))

    record_project_event(
        db,
        project_id=project.id,
        event_type="kpi_objective_created",
        summary=f"KPI «{objective.title}» ({objective.mode}) creado",
        actor_name=payload.actor_name,
    )
    db.commit()
    return _build_kpi_objective_response(db, objective.id)


@router.get("/objectives/{objective_id}", response_model=KpiObjectiveResponse)
def get_kpi_objective(
    objective_id: int,
    project_id: int = Query(..., description="Caller's project id for compound scoping"),
    db: Session = Depends(get_db),
):
    _get_objective_or_404(db, objective_id, project_id)
    return _build_kpi_objective_response(db, objective_id)


@router.patch("/objectives/{objective_id}", response_model=KpiObjectiveResponse)
def update_kpi_objective(
    objective_id: int,
    payload: KpiObjectiveUpdate,
    project_id: int = Query(..., description="Caller's project id for compound scoping"),
    db: Session = Depends(get_db),
):
    objective = _get_objective_or_404(db, objective_id, project_id)
    data = payload.model_dump(exclude_unset=True)
    actor_name = data.pop("actor_name", None)
    for key, value in data.items():
        setattr(objective, key, value)

    if data:
        record_project_event(
            db,
            project_id=objective.project_id,
            event_type="kpi_objective_updated",
            summary=f"KPI «{objective.title}» actualizado",
            actor_name=actor_name,
            payload={"fields": list(data.keys())},
        )
    db.commit()
    return _build_kpi_objective_response(db, objective_id)


@router.delete("/objectives/{objective_id}", status_code=204)
def delete_kpi_objective(
    objective_id: int,
    project_id: int = Query(
        ..., description="Caller's project id for compound scoping"
    ),
    db: Session = Depends(get_db),
):
    objective = _get_objective_or_404(db, objective_id, project_id)
    db.delete(objective)
    db.commit()
    return None


@router.patch(
    "/objectives/{objective_id}/progress", response_model=KpiObjectiveResponse
)
def update_kpi_objective_progress(
    objective_id: int,
    payload: KpiObjectiveProgressUpdate,
    project_id: int = Query(
        ..., description="Caller's project id for compound scoping"
    ),
    db: Session = Depends(get_db),
):
    objective = _get_objective_or_404(db, objective_id, project_id)
    if objective.mode != "manual":
        # Derived (milestone) progress is never hand-set — ADR-11/ADR-12.
        raise api_error(409, "SIGAO_KPI_PROGRESS_IMMUTABLE", "El progreso de un KPI por hitos se deriva de los hitos, no se edita manualmente")

    objective.progress_pct = payload.progress_pct
    if payload.comment:
        db.add(
            ObjectiveComment(
                objective_id=objective.id,
                body=payload.comment,
                actor_name=payload.actor_name,
            )
        )

    record_project_event(
        db,
        project_id=objective.project_id,
        event_type="kpi_progress_updated",
        summary=f"KPI «{objective.title}» actualizado a {payload.progress_pct}%",
        actor_name=payload.actor_name,
        payload={"objective_id": objective.id, "progress_pct": payload.progress_pct},
    )
    db.commit()
    return _build_kpi_objective_response(db, objective_id)


# ---------------------------------------------------------------------------
# Hitos del KPI (Task rows under a milestone-mode Objective)
# ---------------------------------------------------------------------------


@router.get(
    "/objectives/{objective_id}/hitos", response_model=list[KpiHitoResponse]
)
def list_kpi_hitos(
    objective_id: int,
    project_id: int = Query(
        ..., description="Caller's project id for compound scoping"
    ),
    db: Session = Depends(get_db),
):
    _get_objective_or_404(db, objective_id, project_id)
    tasks = (
        db.query(Task)
        .filter(Task.objective_id == objective_id)
        .order_by(Task.position, Task.id)
        .all()
    )
    return [_task_to_hito(t) for t in tasks]


@router.post(
    "/objectives/{objective_id}/hitos",
    response_model=KpiHitoResponse,
    status_code=201,
)
def create_kpi_hito(
    objective_id: int,
    payload: KpiHitoCreate,
    project_id: int = Query(
        ..., description="Caller's project id for compound scoping"
    ),
    db: Session = Depends(get_db),
):
    objective = _get_objective_or_404(db, objective_id, project_id)
    if objective.mode != "milestone":
        raise api_error(400, "SIGAO_HITOS_MILESTONE_ONLY", "Los hitos solo aplican a KPIs en modo por hitos")

    task = Task(
        project_id=objective.project_id,
        objective_id=objective.id,
        title=payload.title,
        status=TaskStatus.todo,
        type=TaskType.task,
        position=payload.position or 0,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_to_hito(task)


def _get_kpi_hito_or_404(db: Session, objective_id: int, task_id: int) -> Task:
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.objective_id == objective_id)
        .first()
    )
    if not task:
        raise api_error(404, "SIGAO_HITO_NOT_FOUND", "Hito not found")
    return task


@router.patch(
    "/objectives/{objective_id}/hitos/{task_id}", response_model=KpiHitoResponse
)
def update_kpi_hito(
    objective_id: int,
    task_id: int,
    payload: KpiHitoUpdate,
    project_id: int = Query(
        ..., description="Caller's project id for compound scoping"
    ),
    db: Session = Depends(get_db),
):
    objective = _get_objective_or_404(db, objective_id, project_id)
    if objective.mode != "milestone":
        raise api_error(400, "SIGAO_HITOS_MILESTONE_ONLY", "Los hitos solo aplican a KPIs en modo por hitos")
    task = _get_kpi_hito_or_404(db, objective_id, task_id)

    data = payload.model_dump(exclude_unset=True)
    data.pop("actor_name", None)
    if "completed" in data:
        completed = data.pop("completed")
        task.status = TaskStatus.done if completed else TaskStatus.todo
        task.completed_at = datetime.now(timezone.utc) if completed else None
    for key, value in data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return _task_to_hito(task)


@router.delete("/objectives/{objective_id}/hitos/{task_id}", status_code=204)
def delete_kpi_hito(
    objective_id: int,
    task_id: int,
    project_id: int = Query(
        ..., description="Caller's project id for compound scoping"
    ),
    db: Session = Depends(get_db),
):
    objective = _get_objective_or_404(db, objective_id, project_id)
    if objective.mode != "milestone":
        raise api_error(400, "SIGAO_HITOS_MILESTONE_ONLY", "Los hitos solo aplican a KPIs en modo por hitos")
    task = _get_kpi_hito_or_404(db, objective_id, task_id)
    db.delete(task)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Objective comments (manual-mode trail)
# ---------------------------------------------------------------------------


@router.get(
    "/objectives/{objective_id}/comments",
    response_model=list[ObjectiveCommentResponse],
)
def list_objective_comments(
    objective_id: int,
    project_id: int = Query(
        ..., description="Caller's project id for compound scoping"
    ),
    db: Session = Depends(get_db),
):
    _get_objective_or_404(db, objective_id, project_id)
    comments = (
        db.query(ObjectiveComment)
        .filter(ObjectiveComment.objective_id == objective_id)
        .order_by(ObjectiveComment.created_at.desc())
        .all()
    )
    return comments


@router.post(
    "/objectives/{objective_id}/comments",
    response_model=ObjectiveCommentResponse,
    status_code=201,
)
def create_objective_comment(
    objective_id: int,
    payload: ObjectiveCommentCreate,
    project_id: int = Query(
        ..., description="Caller's project id for compound scoping"
    ),
    db: Session = Depends(get_db),
):
    objective = _get_objective_or_404(db, objective_id, project_id)
    comment = ObjectiveComment(
        objective_id=objective.id,
        body=payload.body,
        actor_name=payload.actor_name,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


# ---------------------------------------------------------------------------
# REQ-024: user provisioning / project responsible sync
# ---------------------------------------------------------------------------


@router.post("/users/ensure", response_model=SigaoUserEnsureResponse)
def ensure_sigao_user(payload: SigaoUserEnsure, db: Session = Depends(get_db)):
    user, created = _ensure_sigao_user(db, payload.email, payload.name)
    db.commit()
    db.refresh(user)
    return SigaoUserEnsureResponse(
        id=user.id, email=user.email, name=user.name, created=created
    )


@router.put(
    "/projects/{external_uuid}/responsible",
    response_model=SigaoProjectResponsibleResponse,
)
def set_sigao_project_responsible(
    external_uuid: UUID,
    payload: SigaoProjectResponsibleUpdate,
    db: Session = Depends(get_db),
):
    project = get_project_by_external_uuid(db, external_uuid)
    if not project:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")

    user, _created = _ensure_sigao_user(db, payload.email, payload.name)
    project.responsible_name = payload.name

    if payload.previous_email:
        previous_user = _get_user_by_email_ci(db, payload.previous_email)
        if previous_user and previous_user.id != user.id:
            previous_member = (
                db.query(ProjectMember)
                .filter(
                    ProjectMember.project_id == project.id,
                    ProjectMember.user_id == previous_user.id,
                    ProjectMember.role == UserRole.manager,
                )
                .first()
            )
            if previous_member:
                previous_member.role = UserRole.developer

    member = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
        )
        .first()
    )
    if member:
        member.role = UserRole.manager
    else:
        db.add(
            ProjectMember(
                project_id=project.id, user_id=user.id, role=UserRole.manager
            )
        )

    record_project_event(
        db,
        project_id=project.id,
        event_type="project_responsible_updated",
        summary=f"Responsable del proyecto «{project.name}» actualizado a {payload.name}",
        payload={"email": payload.email, "previous_email": payload.previous_email},
    )

    db.commit()
    return SigaoProjectResponsibleResponse(
        user_id=user.id, email=user.email, role="manager", project_id=project.id
    )
