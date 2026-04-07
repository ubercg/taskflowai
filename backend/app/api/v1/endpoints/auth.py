from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_user,
)
from app.schemas.schemas import UserResponse

router = APIRouter()


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    # 1. Buscar user por email (case-insensitive)
    user = db.query(User).filter(User.email.ilike(form_data.username)).first()

    # 2. Verificar password con verify_password()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas"
        )

    # 4. Si user.is_active == False: HTTPException 403 "Cuenta desactivada"
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada"
        )

    # 5. Crear JWT
    payload = {"sub": str(user.id), "role": user.role, "email": user.email}
    access_token = create_access_token(payload)

    # 6. Retornar
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "color": user.color,
        },
    }


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout():
    return {"message": "Sesión cerrada"}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Contraseña actualizada"}
