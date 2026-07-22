from typing import Any

from fastapi import Depends
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.core.security import decode_token
from app.db.database import get_db

oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login", auto_error=False
)
sigao_api_key_header = APIKeyHeader(name="X-SIGAO-Key", auto_error=False)


def verify_sigao_api_key(
    x_sigao_key: str = Depends(
        APIKeyHeader(name="X-SIGAO-Key", auto_error=True, description="SIGAO service key")
    ),
) -> bool:
    if not settings.SIGAO_API_KEY:
        raise api_error(503, "SIGAO_NOT_CONFIGURED", "Integración SIGAO no configurada (SIGAO_API_KEY ausente)")
    if x_sigao_key != settings.SIGAO_API_KEY:
        raise api_error(401, "SIGAO_API_KEY_INVALID", "API key inválida")
    return True


class AuthContext:
    """Resultado de autenticación dual: JWT de usuario o API key SIGAO."""

    def __init__(self, auth_type: str, user: Any | None = None):
        self.auth_type = auth_type
        self.user = user

    @property
    def is_sigao_service(self) -> bool:
        return self.auth_type == "sigao"


def require_jwt_or_sigao_key(
    token: str | None = Depends(oauth2_scheme_optional),
    api_key: str | None = Depends(sigao_api_key_header),
    db: Session = Depends(get_db),
) -> AuthContext:
    if api_key:
        if not settings.SIGAO_API_KEY:
            raise api_error(503, "SIGAO_NOT_CONFIGURED", "Integración SIGAO no configurada (SIGAO_API_KEY ausente)")
        if api_key == settings.SIGAO_API_KEY:
            return AuthContext(auth_type="sigao", user=None)
        raise api_error(401, "SIGAO_API_KEY_INVALID", "API key inválida")

    if not token:
        raise api_error(401, "AUTH_CREDENTIALS_REQUIRED", "Credenciales requeridas")

    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise api_error(401, "AUTH_TOKEN_NO_SUBJECT", "Token sin subject")

    from app.models.models import User

    user = (
        db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    )
    if not user:
        raise api_error(401, "AUTH_USER_INACTIVE", "Usuario no encontrado o inactivo")
    return AuthContext(auth_type="jwt", user=user)


def check_project_access_or_sigao(
    project_id: int,
    auth: AuthContext,
    db: Session,
    *,
    require_ownership: bool = False,
) -> None:
    if auth.is_sigao_service:
        from app.models.models import Project

        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")
        return

    from app.core.security import check_project_access

    check_project_access(project_id, auth.user, db, require_ownership=require_ownership)
