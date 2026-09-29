from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_access_token(data: dict, expires_minutes: Optional[int] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=expires_minutes or settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if user.status == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended")
    return user


_METHOD_TO_FLAG = {
    "GET": "can_view", "HEAD": "can_view", "OPTIONS": "can_view",
    "POST": "can_add", "PUT": "can_edit", "PATCH": "can_edit", "DELETE": "can_delete",
}


def allowed_module_keys(db: Session, user: models.User) -> list:
    """Module keys the user may view. Owners see every active module."""
    if user.is_owner:
        return [m.module_key for m in db.query(models.Module).all()]
    rows = (
        db.query(models.Module.module_key)
        .join(models.RolePermission, models.RolePermission.module_id == models.Module.id)
        .filter(models.RolePermission.role_id == user.role_id, models.RolePermission.can_view == True)  # noqa: E712
        .all()
    )
    return [r[0] for r in rows]


def require_module(module_key: str):
    """Router-level dependency enforcing the role's view/add/edit/delete flag for a module."""

    def checker(
        request: Request,
        user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> models.User:
        if user.is_owner:
            return user
        flag = _METHOD_TO_FLAG.get(request.method, "can_edit")
        perm = (
            db.query(models.RolePermission)
            .join(models.Module, models.Module.id == models.RolePermission.module_id)
            .filter(models.RolePermission.role_id == user.role_id, models.Module.module_key == module_key)
            .first()
        )
        if not perm or not getattr(perm, flag):
            raise HTTPException(status_code=403, detail="Your role does not have permission for this action")
        return user

    return checker
