from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/branches", tags=["Branches"])


def _branch_to_out(db: Session, branch: models.Branch) -> schemas.BranchOut:
    users_count = db.query(models.User).filter(models.User.branch_id == branch.id).count()
    return schemas.BranchOut(
        id=branch.id,
        branch_name=branch.branch_name,
        branch_type=branch.branch_type,
        address=branch.address,
        city=branch.city,
        state=branch.state,
        manager_name=branch.manager.full_name if branch.manager else None,
        manager_user_id=branch.manager_user_id,
        gstin=branch.gstin,
        status=branch.status,
        users_count=users_count,
        is_default=branch.is_default,
    )


@router.get("", response_model=list[schemas.BranchOut])
def list_branches(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Branch).filter(models.Branch.company_id == current_user.company_id)
    if search:
        query = query.filter(models.Branch.branch_name.ilike(f"%{search}%"))
    if status_filter and status_filter != "All":
        query = query.filter(models.Branch.status == status_filter.lower())
    branches = query.order_by(models.Branch.is_default.desc(), models.Branch.id).all()
    return [_branch_to_out(db, b) for b in branches]


@router.get("/stats", response_model=schemas.BranchStatsOut)
def branch_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    total = db.query(models.Branch).filter(models.Branch.company_id == company_id).count()
    active = db.query(models.Branch).filter(models.Branch.company_id == company_id, models.Branch.status == "active").count()
    inactive = total - active
    staff = db.query(models.User).filter(models.User.company_id == company_id).count()
    return schemas.BranchStatsOut(
        total_branches=total, active_branches=active, inactive_branches=inactive, total_staff=staff
    )


@router.post("", response_model=schemas.BranchOut, status_code=201)
def create_branch(
    payload: schemas.BranchCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    branch = models.Branch(
        company_id=current_user.company_id,
        branch_name=payload.branch_name,
        branch_type=payload.branch_type,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        manager_user_id=payload.manager_user_id,
        gstin=payload.gstin,
        is_default=payload.is_default,
        status="active",
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return _branch_to_out(db, branch)


@router.get("/{branch_id}", response_model=schemas.BranchOut)
def get_branch(
    branch_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    branch = db.query(models.Branch).filter(
        models.Branch.id == branch_id, models.Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return _branch_to_out(db, branch)


@router.put("/{branch_id}", response_model=schemas.BranchOut)
def update_branch(
    branch_id: int,
    payload: schemas.BranchUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    branch = db.query(models.Branch).filter(
        models.Branch.id == branch_id, models.Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(branch, field, value)

    db.commit()
    db.refresh(branch)
    return _branch_to_out(db, branch)


@router.delete("/{branch_id}", status_code=204)
def delete_branch(
    branch_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    branch = db.query(models.Branch).filter(
        models.Branch.id == branch_id, models.Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    if branch.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default head office branch")

    has_users = db.query(models.User).filter(models.User.branch_id == branch_id).count()
    if has_users:
        raise HTTPException(status_code=400, detail="Cannot delete a branch that still has users assigned")

    db.delete(branch)
    db.commit()
    return None
