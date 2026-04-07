from fastapi import APIRouter
from app.api.v1.endpoints import (
    ai,
    auth,
    projects,
    tasks,
    users,
    admin_users,
    objectives,
    metrics,
    timelogs,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(
    admin_users.router, prefix="/admin/users", tags=["admin-users"]
)
api_router.include_router(objectives.router, prefix="/objectives", tags=["objectives"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
api_router.include_router(timelogs.router, prefix="/time-logs", tags=["time-logs"])
