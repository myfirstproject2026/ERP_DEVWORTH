import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user, hash_password

router = APIRouter(prefix="/api/users", tags=["Users"])


def _user_to_out(user: models.User) -> schemas.UserOut:
    return schemas.UserOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        mobile_number=user.mobile_number,
        role_id=user.role_id,
        role_name=user.role.role_name if user.role else "",
        branch_id=user.branch_id,
        branch_name=user.branch.branch_name if user.branch else None,
        status=user.status,
        is_owner=user.is_owner,
    )


@router.get("", response_model=list[schemas.UserOut])
def list_users(
    search: Optional[str] = Query(None),
    branch_id: Optional[int] = Query(None),
    role_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.User).filter(models.User.company_id == current_user.company_id)
    if search:
        query = query.filter(
            (models.User.full_name.ilike(f"%{search}%")) | (models.User.email.ilike(f"%{search}%"))
        )
    if branch_id:
        query = query.filter(models.User.branch_id == branch_id)
    if role_id:
        query = query.filter(models.User.role_id == role_id)
    if status_filter and status_filter != "All":
        query = query.filter(models.User.status == status_filter.lower())

    users = query.order_by(models.User.id).all()
    return [_user_to_out(u) for u in users]


@router.get("/stats", response_model=schemas.UserStatsOut)
def user_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base = db.query(models.User).filter(models.User.company_id == current_user.company_id)
    total = base.count()
    active = base.filter(models.User.status == "active").count()
    invited = base.filter(models.User.status == "invited").count()
    suspended = base.filter(models.User.status == "suspended").count()
    return schemas.UserStatsOut(
        total_users=total, active_users=active, invited_users=invited, suspended_users=suspended
    )


@router.post("/invite", response_model=schemas.UserOut, status_code=201)
def invite_user(
    payload: schemas.UserInviteRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.User).filter(
        models.User.company_id == current_user.company_id, models.User.email == payload.email
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    role = db.query(models.Role).filter(
        models.Role.id == payload.role_id, models.Role.company_id == current_user.company_id
    ).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    branch = db.query(models.Branch).filter(
        models.Branch.id == payload.branch_id, models.Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    temp_password = None
    password_hash = None
    if payload.login_method == "password":
        temp_password = secrets.token_urlsafe(8)
        password_hash = hash_password(temp_password)

    user = models.User(
        company_id=current_user.company_id,
        branch_id=payload.branch_id,
        role_id=payload.role_id,
        full_name=payload.full_name,
        email=payload.email,
        mobile_number=payload.mobile_number,
        password_hash=password_hash,
        login_method=payload.login_method,
        status="invited",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    # NOTE: email/WhatsApp dispatch would be triggered here via a notification service.
    return _user_to_out(user)


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(
        models.User.id == user_id, models.User.company_id == current_user.company_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_out(user)


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(
        models.User.id == user_id, models.User.company_id == current_user.company_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_owner and payload.status and payload.status != "active":
        raise HTTPException(status_code=400, detail="Cannot change the status of the company owner")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return _user_to_out(user)


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(
        models.User.id == user_id, models.User.company_id == current_user.company_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_owner:
        raise HTTPException(status_code=400, detail="Cannot delete the company owner")

    db.delete(user)
    db.commit()
    return None
