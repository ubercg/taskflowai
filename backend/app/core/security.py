from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, Header, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.config import settings
from app.core.errors import api_error

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# TSK-014: while a forced password change is pending, the token is only good
# for the escape hatch (change your password) and reading your own identity.
# Every other authenticated endpoint is blocked server-side, so the frontend
# gate can no longer be skipped by hitting the API directly.
PASSWORD_CHANGE_ALLOWLIST = frozenset(
    {
        "/api/v1/auth/change-password",
        "/api/v1/auth/me",
        "/api/v1/auth/logout",
    }
)


def _enforce_password_change(user, request: Request) -> None:
    """Block a must_change_password user everywhere except the allowlist."""
    if getattr(user, "must_change_password", False) and (
        request.url.path not in PASSWORD_CHANGE_ALLOWLIST
    ):
        raise api_error(
            403,
            "PASSWORD_CHANGE_REQUIRED",
            "Debés cambiar tu contraseña antes de continuar",
        )


import bcrypt


def verify_password(plain: str, hashed: str) -> bool:
    try:
        # bcrypt expects bytes
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception as e:
        print(f"Error checking password: {e}")
        return False


def hash_password(password: str) -> str:
    # bcrypt expects bytes and returns bytes, so we decode to str for DB
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise api_error(401, "AUTH_TOKEN_INVALID", "Token inválido o expirado")


# Dependencia principal — inyectar en cualquier endpoint
def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
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
    _enforce_password_change(user, request)
    return user


def require_role(*roles):
    """Factory de dependencias por rol. Uso: Depends(require_role('admin','manager'))"""

    def checker(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise api_error(
                403,
                "AUTH_ROLE_FORBIDDEN",
                f"Acceso denegado. Roles permitidos: {', '.join(roles)}",
                headers={"X-Required-Role": ", ".join(roles)},
            )
        return current_user

    return checker


# Shortcuts
def require_admin(user=Depends(require_role("admin"))):
    return user


def require_manager_or_above(user=Depends(require_role("admin", "manager"))):
    return user


def require_authenticated(user=Depends(get_current_user)):
    return user


def check_project_access(
    project_id: int, current_user, db: Session, require_ownership=False
):
    """Verifica que el usuario tenga acceso al proyecto"""
    if current_user.role == "admin":
        return True
    from app.models.models import ProjectMember

    member = (
        db.query(ProjectMember)
        .filter_by(project_id=project_id, user_id=current_user.id)
        .first()
    )
    if not member:
        raise api_error(403, "PROJECT_ACCESS_DENIED", "No tienes acceso a este proyecto")
    if require_ownership and member.role not in ("admin", "manager"):
        raise api_error(403, "PROJECT_MANAGER_REQUIRED", "Se requiere rol de manager en este proyecto")
    return member


def accessible_project_ids(db: Session, current_user):
    """
    Project ids the caller may see in list endpoints without an explicit project_id.

    Returns None for global admins (unrestricted). Returns [] when the user
    has no memberships. Same visibility rule as read_projects.
    """
    if current_user.role == "admin":
        return None
    from app.models.models import ProjectMember

    rows = (
        db.query(ProjectMember.project_id)
        .filter(ProjectMember.user_id == current_user.id)
        .all()
    )
    return [r[0] for r in rows]
