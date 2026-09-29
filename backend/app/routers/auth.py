import random
from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import (
    verify_password, hash_password, create_access_token, get_current_user, allowed_module_keys,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _find_user_by_identifier(db: Session, identifier: str):
    """identifier can be email or a 'user id' (we treat as email local-part match)."""
    user = db.query(models.User).filter(models.User.email == identifier).first()
    if user:
        return user
    # fallback: match on local-part of email (User ID style e.g. "ravi.kumar")
    normalized = identifier.replace(".", "").lower()
    candidates = db.query(models.User).all()
    for u in candidates:
        local_part = u.email.split("@")[0].replace(".", "").lower()
        if local_part == normalized:
            return u
    return None


def _user_to_out(db: Session, user: models.User) -> schemas.UserOut:
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
        allowed_modules=allowed_module_keys(db, user),
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = _find_user_by_identifier(db, payload.identifier)
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid user ID/email or password")
    if user.status == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended. Contact your administrator.")
    if user.status == "invited":
        raise HTTPException(status_code=403, detail="Please accept your invite email before signing in.")

    user.last_login_at = datetime.utcnow()
    db.commit()

    expire_minutes = 60 * 24 * 30 if payload.keep_signed_in else None
    token = create_access_token({"sub": str(user.id)}, expires_minutes=expire_minutes)
    return schemas.TokenResponse(access_token=token, user=_user_to_out(db, user))


@router.post("/send-otp")
def send_otp(payload: schemas.OtpSendRequest, db: Session = Depends(get_db)):
    user = _find_user_by_identifier(db, payload.identifier)
    if not user:
        raise HTTPException(status_code=404, detail="No account found for that user ID / mobile number")

    otp_code = f"{random.randint(0, 999999):06d}"
    otp = models.OtpRequest(
        user_id=user.id,
        otp_code=otp_code,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(otp)
    db.commit()
    # NOTE: In production this would be dispatched via SMS gateway.
    # Returned here only because this is a self-contained demo build.
    return {"message": "OTP sent to registered mobile number", "demo_otp": otp_code}


@router.post("/verify-otp", response_model=schemas.TokenResponse)
def verify_otp(payload: schemas.OtpVerifyRequest, db: Session = Depends(get_db)):
    user = _find_user_by_identifier(db, payload.identifier)
    if not user:
        raise HTTPException(status_code=404, detail="No account found")

    otp = (
        db.query(models.OtpRequest)
        .filter(
            models.OtpRequest.user_id == user.id,
            models.OtpRequest.otp_code == payload.otp_code,
            models.OtpRequest.is_used.is_(False),
        )
        .order_by(models.OtpRequest.id.desc())
        .first()
    )
    if not otp or otp.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    otp.is_used = True
    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return schemas.TokenResponse(access_token=token, user=_user_to_out(db, user))


@router.post("/register-company", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
def register_company(payload: schemas.CompanyRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(models.Company).filter(
        (models.Company.gstin == payload.gstin) | (models.Company.business_email == payload.business_email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A company with this GSTIN or business email already exists")

    company = models.Company(
        company_name=payload.company_name,
        business_type=payload.business_type,
        industry=payload.industry,
        cin=payload.cin,
        contact_number=payload.contact_number,
        business_email=payload.business_email,
        address_line=payload.address_line,
        city=payload.city,
        state=payload.state,
        pin_code=payload.pin_code,
        country=payload.country,
        gstin=payload.gstin,
        pan=payload.pan,
        default_gst_rate=payload.default_gst_rate,
        financial_year_start=payload.financial_year_start,
        member_since=date.today(),
    )
    db.add(company)
    db.flush()

    # seed default system roles for the new company
    default_roles = [
        ("Owner", "Full access to all modules and settings", "full"),
        ("Manager", "Access to all modules, no billing/settings", "high"),
        ("Branch Manager", "Manage assigned branch operations", "medium"),
        ("Sales Staff", "Sales, CRM and quotations only", "limited"),
        ("Accountant", "Finance, GST and payment modules", "limited"),
        ("Production Staff", "Manufacturing and inventory only", "limited"),
    ]
    role_objs = {}
    for name, desc, level in default_roles:
        r = models.Role(company_id=company.id, role_name=name, description=desc,
                         access_level=level, is_system_role=(name == "Owner"))
        db.add(r)
        db.flush()
        role_objs[name] = r

    # grant full permissions to Owner across all active modules
    modules = db.query(models.Module).all()
    for m in modules:
        db.add(models.RolePermission(
            role_id=role_objs["Owner"].id, module_id=m.id,
            can_view=True, can_add=True, can_edit=True, can_delete=True, can_approve=True,
        ))

    head_office = models.Branch(
        company_id=company.id,
        branch_name=f"{payload.city} HQ (Head Office)",
        branch_type="Head Office",
        address=payload.address_line,
        city=payload.city,
        state=payload.state,
        status="active",
        is_default=True,
    )
    db.add(head_office)
    db.flush()

    owner_user = models.User(
        company_id=company.id,
        branch_id=head_office.id,
        role_id=role_objs["Owner"].id,
        full_name=payload.owner_full_name,
        email=payload.business_email,
        mobile_number=payload.contact_number,
        password_hash=hash_password(payload.owner_password),
        login_method="password",
        is_owner=True,
        status="active",
    )
    db.add(owner_user)
    db.flush()

    head_office.manager_user_id = owner_user.id
    db.commit()
    db.refresh(owner_user)

    token = create_access_token({"sub": str(owner_user.id)})
    return schemas.TokenResponse(access_token=token, user=_user_to_out(db, owner_user))


@router.get("/me", response_model=schemas.MeOut)
def get_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return schemas.MeOut(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role_name=current_user.role.role_name if current_user.role else "",
        is_owner=current_user.is_owner,
        company_id=current_user.company_id,
        company_name=current_user.company.company_name if current_user.company else "",
        branch_name=current_user.branch.branch_name if current_user.branch else None,
        allowed_modules=allowed_module_keys(db, current_user),
    )
