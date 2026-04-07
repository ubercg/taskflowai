from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


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
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


# Dependencia principal — inyectar en cualquier endpoint
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Token sin subject")
    from app.models.models import User

    user = (
        db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    )
    if not user:
        raise HTTPException(401, "Usuario no encontrado o inactivo")
    return user


def require_role(*roles):
    """Factory de dependencias por rol. Uso: Depends(require_role('admin','manager'))"""

    def checker(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Acceso denegado. Roles permitidos: {', '.join(roles)}",
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
        raise HTTPException(403, "No tienes acceso a este proyecto")
    if require_ownership and member.role not in ("admin", "manager"):
        raise HTTPException(403, "Se requiere rol de manager en este proyecto")
    return member
