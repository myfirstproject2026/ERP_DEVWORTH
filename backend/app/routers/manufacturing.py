from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, extract

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user
from app.routers.inventory import _get_or_create_stock_level, _record_movement

router = APIRouter(prefix="/api/manufacturing", tags=["Manufacturing"])

STAGES = ["Raw Material Prep", "Machining", "Assembly", "Quality Checking", "Packaging", "Completed"]


# ============================================================
# Helpers
# ============================================================
def _next_wo_number(db: Session, company_id: int) -> str:
    count = db.query(models.WorkOrder).filter(models.WorkOrder.company_id == company_id).count()
    return f"WO-{1041 + count + 1}"


def _wc_out(db: Session, wc: models.WorkCenter) -> schemas.WorkCenterOut:
    active = db.query(models.WorkOrder).filter(
        models.WorkOrder.work_center_id == wc.id,
        models.WorkOrder.status.in_(["scheduled", "in_progress"]),
    ).count()
    return schemas.WorkCenterOut(
        id=wc.id, name=wc.name, code=wc.code, branch_id=wc.branch_id, branch_name=wc.branch.branch_name,
        description=wc.description, capacity_per_day=wc.capacity_per_day, status=wc.status,
        active_work_orders=active,
    )


def _bom_out(b: models.BillOfMaterials) -> schemas.BomOut:
    return schemas.BomOut(
        id=b.id, product_id=b.product_id, product_name=b.product.product_name,
        bom_name=b.bom_name, version=b.version, status=b.status, notes=b.notes,
    )


def _bom_detail_out(b: models.BillOfMaterials) -> schemas.BomDetailOut:
    base = _bom_out(b)
    return schemas.BomDetailOut(**base.model_dump(), components=[
        schemas.BomComponentOut(id=c.id, component_product_id=c.component_product_id,
                                 component_product_name=c.component_product.product_name,
                                 quantity_required=c.quantity_required, unit=c.unit)
        for c in b.components
    ])


def _wo_out(o: models.WorkOrder) -> schemas.WorkOrderOut:
    return schemas.WorkOrderOut(
        id=o.id, wo_number=o.wo_number, branch_id=o.branch_id, branch_name=o.branch.branch_name,
        product_id=o.product_id, product_name=o.product.product_name, bom_id=o.bom_id,
        work_center_id=o.work_center_id, work_center_name=o.work_center.name if o.work_center else None,
        quantity_planned=o.quantity_planned, quantity_completed=o.quantity_completed, status=o.status,
        priority=o.priority, current_stage=o.current_stage, progress_pct=o.progress_pct,
        materials_issued=o.materials_issued, start_date=o.start_date, due_date=o.due_date, notes=o.notes,
    )


def _wo_detail_out(o: models.WorkOrder) -> schemas.WorkOrderDetailOut:
    base = _wo_out(o)
    bom_components = []
    if o.bom:
        bom_components = [
            schemas.BomComponentOut(id=c.id, component_product_id=c.component_product_id,
                                     component_product_name=c.component_product.product_name,
                                     quantity_required=c.quantity_required, unit=c.unit)
            for c in o.bom.components
        ]
    return schemas.WorkOrderDetailOut(
        **base.model_dump(),
        material_issues=[
            schemas.MaterialIssueOut(id=m.id, component_product_id=m.component_product_id,
                                      component_product_name=m.component_product.product_name,
                                      quantity_issued=m.quantity_issued)
            for m in o.material_issues
        ],
        bom_components=bom_components,
    )


# ============================================================
# OVERVIEW
# ============================================================
@router.get("/overview", response_model=schemas.ManufacturingOverviewOut)
def get_overview(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = current_user.company_id
    total = db.query(models.WorkOrder).filter(models.WorkOrder.company_id == cid).count()
    in_progress = db.query(models.WorkOrder).filter(
        models.WorkOrder.company_id == cid, models.WorkOrder.status == "in_progress"
    ).count()
    now = datetime.utcnow()
    completed_this_month = db.query(models.WorkOrder).filter(
        models.WorkOrder.company_id == cid, models.WorkOrder.status == "completed",
        extract("year", models.WorkOrder.completed_at) == now.year,
        extract("month", models.WorkOrder.completed_at) == now.month,
    ).count()
    total_wc = db.query(models.WorkCenter).filter(models.WorkCenter.company_id == cid).count()
    active_boms = db.query(models.BillOfMaterials).filter(
        models.BillOfMaterials.company_id == cid, models.BillOfMaterials.status == "active"
    ).count()
    recent = db.query(models.WorkOrder).filter(
        models.WorkOrder.company_id == cid
    ).order_by(models.WorkOrder.id.desc()).limit(5).all()

    return schemas.ManufacturingOverviewOut(
        total_work_orders=total, in_progress_count=in_progress, completed_this_month=completed_this_month,
        total_work_centers=total_wc, active_boms=active_boms, recent_work_orders=[_wo_out(o) for o in recent],
    )


@router.get("/stages", response_model=List[str])
def get_stages():
    return STAGES


# ============================================================
# WORK CENTERS
# ============================================================
@router.get("/work-centers", response_model=List[schemas.WorkCenterOut])
def list_work_centers(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    wcs = db.query(models.WorkCenter).filter(
        models.WorkCenter.company_id == current_user.company_id
    ).order_by(models.WorkCenter.id).all()
    return [_wc_out(db, wc) for wc in wcs]


@router.post("/work-centers", response_model=schemas.WorkCenterOut, status_code=201)
def create_work_center(
    payload: schemas.WorkCenterCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.WorkCenter).filter(
        models.WorkCenter.company_id == current_user.company_id, models.WorkCenter.code == payload.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A work center with this code already exists")
    wc = models.WorkCenter(company_id=current_user.company_id, **payload.model_dump())
    db.add(wc)
    db.commit()
    db.refresh(wc)
    return _wc_out(db, wc)


@router.put("/work-centers/{wc_id}", response_model=schemas.WorkCenterOut)
def update_work_center(
    wc_id: int, payload: schemas.WorkCenterUpdateRequest,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    wc = db.query(models.WorkCenter).filter(
        models.WorkCenter.id == wc_id, models.WorkCenter.company_id == current_user.company_id
    ).first()
    if not wc:
        raise HTTPException(status_code=404, detail="Work center not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(wc, field, value)
    db.commit()
    db.refresh(wc)
    return _wc_out(db, wc)


@router.delete("/work-centers/{wc_id}", status_code=204)
def delete_work_center(
    wc_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    wc = db.query(models.WorkCenter).filter(
        models.WorkCenter.id == wc_id, models.WorkCenter.company_id == current_user.company_id
    ).first()
    if not wc:
        raise HTTPException(status_code=404, detail="Work center not found")
    in_use = db.query(models.WorkOrder).filter(models.WorkOrder.work_center_id == wc_id).count()
    if in_use:
        raise HTTPException(status_code=400, detail="Cannot delete a work center with linked work orders")
    db.delete(wc)
    db.commit()
    return None


# ============================================================
# BILL OF MATERIALS
# ============================================================
@router.get("/boms", response_model=List[schemas.BomOut])
def list_boms(
    product_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.BillOfMaterials).filter(models.BillOfMaterials.company_id == current_user.company_id)
    if product_id:
        q = q.filter(models.BillOfMaterials.product_id == product_id)
    boms = q.order_by(models.BillOfMaterials.id.desc()).all()
    return [_bom_out(b) for b in boms]


@router.post("/boms", response_model=schemas.BomDetailOut, status_code=201)
def create_bom(
    payload: schemas.BomCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(
        models.Product.id == payload.product_id, models.Product.company_id == current_user.company_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not payload.components:
        raise HTTPException(status_code=400, detail="A BOM needs at least one component")

    bom = models.BillOfMaterials(
        company_id=current_user.company_id, product_id=payload.product_id, bom_name=payload.bom_name,
        version=payload.version, notes=payload.notes, status="active",
    )
    db.add(bom)
    db.flush()
    for c in payload.components:
        db.add(models.BomComponent(bom_id=bom.id, component_product_id=c.component_product_id,
                                    quantity_required=c.quantity_required, unit=c.unit))
    db.commit()
    db.refresh(bom)
    return _bom_detail_out(bom)


@router.get("/boms/{bom_id}", response_model=schemas.BomDetailOut)
def get_bom(bom_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    bom = db.query(models.BillOfMaterials).filter(
        models.BillOfMaterials.id == bom_id, models.BillOfMaterials.company_id == current_user.company_id
    ).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")
    return _bom_detail_out(bom)


@router.put("/boms/{bom_id}", response_model=schemas.BomDetailOut)
def update_bom(
    bom_id: int, payload: schemas.BomUpdateRequest,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    bom = db.query(models.BillOfMaterials).filter(
        models.BillOfMaterials.id == bom_id, models.BillOfMaterials.company_id == current_user.company_id
    ).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")

    update_data = payload.model_dump(exclude_unset=True, exclude={"components"})
    for field, value in update_data.items():
        setattr(bom, field, value)

    if payload.components is not None:
        for existing in list(bom.components):
            db.delete(existing)
        db.flush()
        for c in payload.components:
            db.add(models.BomComponent(bom_id=bom.id, component_product_id=c.component_product_id,
                                        quantity_required=c.quantity_required, unit=c.unit))

    db.commit()
    db.refresh(bom)
    return _bom_detail_out(bom)


@router.delete("/boms/{bom_id}", status_code=204)
def delete_bom(bom_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    bom = db.query(models.BillOfMaterials).filter(
        models.BillOfMaterials.id == bom_id, models.BillOfMaterials.company_id == current_user.company_id
    ).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")
    in_use = db.query(models.WorkOrder).filter(models.WorkOrder.bom_id == bom_id).count()
    if in_use:
        raise HTTPException(status_code=400, detail="Cannot delete a BOM referenced by work orders")
    db.delete(bom)
    db.commit()
    return None


# ============================================================
# WORK ORDERS
# ============================================================
@router.get("/work-orders", response_model=List[schemas.WorkOrderOut])
def list_work_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    branch_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.WorkOrder).filter(models.WorkOrder.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        q = q.filter(models.WorkOrder.status == status_filter.lower())
    if branch_id:
        q = q.filter(models.WorkOrder.branch_id == branch_id)
    orders = q.order_by(models.WorkOrder.id.desc()).all()
    return [_wo_out(o) for o in orders]


@router.post("/work-orders", response_model=schemas.WorkOrderDetailOut, status_code=201)
def create_work_order(
    payload: schemas.WorkOrderCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(
        models.Product.id == payload.product_id, models.Product.company_id == current_user.company_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    bom = None
    if payload.bom_id:
        bom = db.query(models.BillOfMaterials).filter(
            models.BillOfMaterials.id == payload.bom_id, models.BillOfMaterials.company_id == current_user.company_id
        ).first()
        if not bom:
            raise HTTPException(status_code=404, detail="BOM not found")
    else:
        bom = db.query(models.BillOfMaterials).filter(
            models.BillOfMaterials.product_id == payload.product_id,
            models.BillOfMaterials.company_id == current_user.company_id,
            models.BillOfMaterials.status == "active",
        ).first()

    wo = models.WorkOrder(
        company_id=current_user.company_id, branch_id=payload.branch_id,
        wo_number=_next_wo_number(db, current_user.company_id), product_id=payload.product_id,
        bom_id=bom.id if bom else None, work_center_id=payload.work_center_id,
        quantity_planned=payload.quantity_planned, status="draft", priority=payload.priority,
        current_stage=STAGES[0], progress_pct=0, start_date=payload.start_date, due_date=payload.due_date,
        notes=payload.notes, created_by_user_id=current_user.id,
    )
    db.add(wo)
    db.commit()
    db.refresh(wo)
    return _wo_detail_out(wo)


@router.get("/work-orders/{wo_id}", response_model=schemas.WorkOrderDetailOut)
def get_work_order(wo_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    wo = db.query(models.WorkOrder).filter(
        models.WorkOrder.id == wo_id, models.WorkOrder.company_id == current_user.company_id
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return _wo_detail_out(wo)


@router.put("/work-orders/{wo_id}", response_model=schemas.WorkOrderOut)
def update_work_order(
    wo_id: int, payload: schemas.WorkOrderUpdateRequest,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    wo = db.query(models.WorkOrder).filter(
        models.WorkOrder.id == wo_id, models.WorkOrder.company_id == current_user.company_id
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot edit a {wo.status} work order")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(wo, field, value)
    db.commit()
    db.refresh(wo)
    return _wo_out(wo)


@router.delete("/work-orders/{wo_id}", status_code=204)
def delete_work_order(wo_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    wo = db.query(models.WorkOrder).filter(
        models.WorkOrder.id == wo_id, models.WorkOrder.company_id == current_user.company_id
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status not in ("draft", "cancelled"):
        raise HTTPException(status_code=400, detail="Only draft or cancelled work orders can be deleted")
    db.delete(wo)
    db.commit()
    return None


@router.put("/work-orders/{wo_id}/issue-materials", response_model=schemas.WorkOrderDetailOut)
def issue_materials(
    wo_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    """Consume raw materials per the linked BOM (quantity_required × quantity_planned) from stock."""
    wo = db.query(models.WorkOrder).filter(
        models.WorkOrder.id == wo_id, models.WorkOrder.company_id == current_user.company_id
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.materials_issued:
        raise HTTPException(status_code=400, detail="Materials have already been issued for this work order")
    if not wo.bom:
        raise HTTPException(status_code=400, detail="This work order has no linked BOM to issue materials from")
    if wo.status not in ("draft", "scheduled"):
        raise HTTPException(status_code=400, detail=f"Cannot issue materials for a {wo.status} work order")

    # validate stock availability first
    shortages = []
    for comp in wo.bom.components:
        needed = comp.quantity_required * wo.quantity_planned
        sl = _get_or_create_stock_level(db, current_user.company_id, comp.component_product_id, wo.branch_id)
        if sl.quantity_on_hand < needed:
            shortages.append(f"{comp.component_product.product_name} (need {needed}, have {sl.quantity_on_hand})")
    if shortages:
        raise HTTPException(status_code=400, detail=f"Insufficient stock to issue materials: {', '.join(shortages)}")

    for comp in wo.bom.components:
        needed = comp.quantity_required * wo.quantity_planned
        sl = _get_or_create_stock_level(db, current_user.company_id, comp.component_product_id, wo.branch_id)
        sl.quantity_on_hand -= needed
        _record_movement(
            db, current_user.company_id, comp.component_product_id, wo.branch_id, "production_consume",
            needed, sl.quantity_on_hand, current_user.id,
            reference_type="work_order", reference_id=wo.id,
            notes=f"Issued to {wo.wo_number}",
        )
        db.add(models.MaterialIssue(
            work_order_id=wo.id, company_id=current_user.company_id,
            component_product_id=comp.component_product_id, quantity_issued=needed,
            branch_id=wo.branch_id, issued_by_user_id=current_user.id,
        ))

    wo.materials_issued = True
    wo.status = "in_progress"
    if not wo.start_date:
        wo.start_date = date.today()

    db.commit()
    db.refresh(wo)
    return _wo_detail_out(wo)


@router.put("/work-orders/{wo_id}/advance-stage", response_model=schemas.WorkOrderOut)
def advance_stage(
    wo_id: int, payload: schemas.WorkOrderStageRequest,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    wo = db.query(models.WorkOrder).filter(
        models.WorkOrder.id == wo_id, models.WorkOrder.company_id == current_user.company_id
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status not in ("in_progress", "scheduled"):
        raise HTTPException(status_code=400, detail=f"Cannot advance stage on a {wo.status} work order")
    if payload.current_stage not in STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {', '.join(STAGES)}")

    wo.current_stage = payload.current_stage
    wo.progress_pct = max(0, min(100, payload.progress_pct))
    db.commit()
    db.refresh(wo)
    return _wo_out(wo)


@router.put("/work-orders/{wo_id}/complete", response_model=schemas.WorkOrderDetailOut)
def complete_work_order(
    wo_id: int, payload: schemas.WorkOrderCompleteRequest,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    """Produce finished goods into stock and mark the work order completed."""
    wo = db.query(models.WorkOrder).filter(
        models.WorkOrder.id == wo_id, models.WorkOrder.company_id == current_user.company_id
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status == "completed":
        raise HTTPException(status_code=400, detail="Work order is already completed")
    if wo.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot complete a cancelled work order")
    if payload.quantity_completed <= 0:
        raise HTTPException(status_code=400, detail="Quantity completed must be greater than zero")

    sl = _get_or_create_stock_level(db, current_user.company_id, wo.product_id, wo.branch_id)
    sl.quantity_on_hand += payload.quantity_completed
    _record_movement(
        db, current_user.company_id, wo.product_id, wo.branch_id, "production_output",
        payload.quantity_completed, sl.quantity_on_hand, current_user.id,
        reference_type="work_order", reference_id=wo.id,
        notes=f"Produced via {wo.wo_number}",
    )

    wo.quantity_completed += payload.quantity_completed
    wo.status = "completed"
    wo.current_stage = "Completed"
    wo.progress_pct = 100
    wo.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(wo)
    return _wo_detail_out(wo)


@router.put("/work-orders/{wo_id}/cancel", response_model=schemas.WorkOrderOut)
def cancel_work_order(wo_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    wo = db.query(models.WorkOrder).filter(
        models.WorkOrder.id == wo_id, models.WorkOrder.company_id == current_user.company_id
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed work order")
    wo.status = "cancelled"
    db.commit()
    db.refresh(wo)
    return _wo_out(wo)
