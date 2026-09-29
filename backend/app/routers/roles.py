from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/roles", tags=["Roles & Permissions"])

ACCESS_LEVEL_LABELS = {
    "full": "Full access",
    "high": "High access",
    "medium": "Medium access",
    "limited": "Limited access",
}


def _role_to_out(db: Session, role: models.Role) -> schemas.RoleOut:
    assigned = db.query(models.User).filter(models.User.role_id == role.id).count()
    return schemas.RoleOut(
        id=role.id,
        role_name=role.role_name,
        description=role.description,
        access_level=role.access_level,
        assigned_users=assigned,
    )


@router.get("", response_model=list[schemas.RoleOut])
def list_roles(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    roles = db.query(models.Role).filter(
        models.Role.company_id == current_user.company_id
    ).order_by(models.Role.id).all()
    return [_role_to_out(db, r) for r in roles]


@router.post("", response_model=schemas.RoleOut, status_code=201)
def create_role(
    payload: schemas.RoleCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.Role).filter(
        models.Role.company_id == current_user.company_id, models.Role.role_name == payload.role_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A role with this name already exists")

    role = models.Role(
        company_id=current_user.company_id,
        role_name=payload.role_name,
        description=payload.description,
        access_level=payload.access_level,
    )
    db.add(role)
    db.flush()

    modules = db.query(models.Module).all()
    for m in modules:
        db.add(models.RolePermission(role_id=role.id, module_id=m.id))

    db.commit()
    db.refresh(role)
    return _role_to_out(db, role)


@router.get("/{role_id}", response_model=schemas.RoleDetailOut)
def get_role(
    role_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = db.query(models.Role).filter(
        models.Role.id == role_id, models.Role.company_id == current_user.company_id
    ).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    modules = db.query(models.Module).order_by(models.Module.sort_order).all()
    perms_by_module = {p.module_id: p for p in role.permissions}

    permission_items = []
    for m in modules:
        p = perms_by_module.get(m.id)
        permission_items.append(schemas.ModulePermissionItem(
            module_id=m.id,
            module_key=m.module_key,
            module_name=m.module_name,
            can_view=p.can_view if p else False,
            can_add=p.can_add if p else False,
            can_edit=p.can_edit if p else False,
            can_delete=p.can_delete if p else False,
            can_approve=p.can_approve if p else False,
        ))

    base = _role_to_out(db, role)
    return schemas.RoleDetailOut(**base.model_dump(), permissions=permission_items)


@router.put("/{role_id}", response_model=schemas.RoleOut)
def update_role(
    role_id: int,
    payload: schemas.RoleUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = db.query(models.Role).filter(
        models.Role.id == role_id, models.Role.company_id == current_user.company_id
    ).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(role, field, value)

    db.commit()
    db.refresh(role)
    return _role_to_out(db, role)


@router.put("/{role_id}/permissions", response_model=schemas.RoleDetailOut)
def update_role_permissions(
    role_id: int,
    payload: schemas.RolePermissionsUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = db.query(models.Role).filter(
        models.Role.id == role_id, models.Role.company_id == current_user.company_id
    ).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system_role and role.role_name == "Owner":
        raise HTTPException(status_code=400, detail="Owner role permissions cannot be modified")

    existing = {p.module_id: p for p in role.permissions}
    for item in payload.permissions:
        p = existing.get(item.module_id)
        if not p:
            p = models.RolePermission(role_id=role.id, module_id=item.module_id)
            db.add(p)
        p.can_view = item.can_view
        p.can_add = item.can_add
        p.can_edit = item.can_edit
        p.can_delete = item.can_delete
        p.can_approve = item.can_approve

    db.commit()
    return get_role(role_id, current_user, db)


@router.delete("/{role_id}", status_code=204)
def delete_role(
    role_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = db.query(models.Role).filter(
        models.Role.id == role_id, models.Role.company_id == current_user.company_id
    ).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system_role:
        raise HTTPException(status_code=400, detail="Cannot delete a system role")

    assigned = db.query(models.User).filter(models.User.role_id == role_id).count()
    if assigned:
        raise HTTPException(status_code=400, detail="Cannot delete a role that has users assigned to it")

    db.delete(role)
    db.commit()
    return None


@router.get("/meta/modules", response_model=list[dict])
def list_modules(db: Session = Depends(get_db)):
    modules = db.query(models.Module).order_by(models.Module.sort_order).all()
    return [{"id": m.id, "module_key": m.module_key, "module_name": m.module_name,
             "category": m.category, "is_active": m.is_active} for m in modules]
