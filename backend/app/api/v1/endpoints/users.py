from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import require_authenticated
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import UserResponse

router = APIRouter()


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
