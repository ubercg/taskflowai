from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import UserResponse, UserCreate
from app.core.security import require_authenticated, hash_password
from app.core.config import settings

router = APIRouter()


from sqlalchemy import or_


@router.get("", response_model=list[UserResponse])
def read_users(
    skip: int = 0,
    limit: int = 100,
    search: str = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_authenticated),
):
    query = db.query(User).filter(User.is_active == True)
    if search:
        query = query.filter(
            or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"))
        )
    return query.offset(skip).limit(limit).all()


@router.post("", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    data = user.model_dump()
    data["password_hash"] = hash_password(settings.DEFAULT_NEW_USER_PASSWORD)
    db_user = User(**data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
