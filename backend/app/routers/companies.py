from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/company", tags=["Company Profile"])


@router.get("/profile", response_model=schemas.CompanyOut)
def get_company_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.put("/profile", response_model=schemas.CompanyOut)
def update_company_profile(
    payload: schemas.CompanyUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_owner:
        raise HTTPException(status_code=403, detail="Only the company owner can edit company profile")

    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(company, field, value)

    db.commit()
    db.refresh(company)
    return company


@router.get("/snapshot", response_model=schemas.CompanySnapshotOut)
def get_company_snapshot(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    branches = db.query(models.Branch).filter(models.Branch.company_id == company_id).count()
    active_users = db.query(models.User).filter(
        models.User.company_id == company_id, models.User.status == "active"
    ).count()
    roles = db.query(models.Role).filter(models.Role.company_id == company_id).count()
    company = db.query(models.Company).filter(models.Company.id == company_id).first()

    return schemas.CompanySnapshotOut(
        branches=branches,
        active_users=active_users,
        roles_configured=roles,
        member_since=company.member_since.strftime("%b %Y") if company and company.member_since else "",
    )
