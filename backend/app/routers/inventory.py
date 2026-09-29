from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


# ============================================================
# Helpers
# ============================================================
def _next_document_number(db: Session, company_id: int, model, number_field: str, prefix: str) -> str:
    count = db.query(model).filter(model.company_id == company_id).count()
    return f"{prefix}-{count + 1:05d}"


def _product_out(db: Session, p: models.Product) -> schemas.ProductOut:
    total_stock = db.query(sqlfunc.coalesce(sqlfunc.sum(models.StockLevel.quantity_on_hand), 0)).filter(
        models.StockLevel.product_id == p.id
    ).scalar() or Decimal("0")
    return schemas.ProductOut(
        id=p.id, product_name=p.product_name, sku=p.sku, category=p.category,
        unit_of_measure=p.unit_of_measure, hsn_code=p.hsn_code, cost_price=p.cost_price,
        selling_price=p.selling_price, tax_rate=p.tax_rate, reorder_level=p.reorder_level,
        reorder_quantity=p.reorder_quantity, barcode=p.barcode, description=p.description,
        primary_branch_id=p.primary_branch_id,
        primary_branch_name=p.primary_branch.branch_name if p.primary_branch else None,
        status=p.status, total_stock=total_stock,
    )


def _stock_level_out(sl: models.StockLevel) -> schemas.StockLevelOut:
    available = sl.quantity_on_hand - sl.quantity_reserved
    return schemas.StockLevelOut(
        id=sl.id, product_id=sl.product_id, product_name=sl.product.product_name,
        sku=sl.product.sku, branch_id=sl.branch_id, branch_name=sl.branch.branch_name,
        quantity_on_hand=sl.quantity_on_hand, quantity_reserved=sl.quantity_reserved,
        quantity_available=available, reorder_level=sl.product.reorder_level,
        is_low_stock=sl.quantity_on_hand <= sl.product.reorder_level,
    )


def _movement_out(m: models.StockMovement) -> schemas.StockMovementOut:
    return schemas.StockMovementOut(
        id=m.id, product_id=m.product_id, product_name=m.product.product_name,
        branch_id=m.branch_id, branch_name=m.branch.branch_name, movement_type=m.movement_type,
        quantity=m.quantity, reference_type=m.reference_type, reference_id=m.reference_id,
        balance_after=m.balance_after, notes=m.notes,
        created_by_name=m.created_by.full_name if m.created_by else None, created_at=m.created_at,
    )


def _get_or_create_stock_level(db: Session, company_id: int, product_id: int, branch_id: int) -> models.StockLevel:
    sl = db.query(models.StockLevel).filter(
        models.StockLevel.product_id == product_id, models.StockLevel.branch_id == branch_id
    ).first()
    if not sl:
        sl = models.StockLevel(company_id=company_id, product_id=product_id, branch_id=branch_id,
                                quantity_on_hand=0, quantity_reserved=0)
        db.add(sl)
        db.flush()
    return sl


def _record_movement(db: Session, company_id, product_id, branch_id, movement_type, quantity,
                      balance_after, user_id, reference_type=None, reference_id=None, notes=None):
    db.add(models.StockMovement(
        company_id=company_id, product_id=product_id, branch_id=branch_id, movement_type=movement_type,
        quantity=quantity, balance_after=balance_after, created_by_user_id=user_id,
        reference_type=reference_type, reference_id=reference_id, notes=notes,
    ))


def _transfer_out(t: models.StockTransfer) -> schemas.StockTransferOut:
    return schemas.StockTransferOut(
        id=t.id, transfer_number=t.transfer_number, from_branch_id=t.from_branch_id,
        from_branch_name=t.from_branch.branch_name, to_branch_id=t.to_branch_id,
        to_branch_name=t.to_branch.branch_name, transfer_date=t.transfer_date,
        status=t.status, notes=t.notes,
    )


def _adjustment_out(a: models.StockAdjustment) -> schemas.StockAdjustmentOut:
    return schemas.StockAdjustmentOut(
        id=a.id, adjustment_number=a.adjustment_number, branch_id=a.branch_id,
        branch_name=a.branch.branch_name, adjustment_date=a.adjustment_date,
        reason=a.reason, status=a.status, notes=a.notes,
    )


# ============================================================
# OVERVIEW
# ============================================================
@router.get("/overview", response_model=schemas.InventoryOverviewOut)
def get_overview(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    company_id = current_user.company_id
    total_products = db.query(models.Product).filter(models.Product.company_id == company_id).count()

    stock_rows = (
        db.query(models.StockLevel, models.Product)
        .join(models.Product, models.StockLevel.product_id == models.Product.id)
        .filter(models.Product.company_id == company_id)
        .all()
    )
    low_stock_count = sum(1 for sl, p in stock_rows if sl.quantity_on_hand <= p.reorder_level)
    total_stock_value = sum((sl.quantity_on_hand * p.cost_price for sl, p in stock_rows), Decimal("0"))

    pending_transfers = db.query(models.StockTransfer).filter(
        models.StockTransfer.company_id == company_id,
        models.StockTransfer.status.in_(["pending", "in_transit"]),
    ).count()

    recent = (
        db.query(models.StockMovement)
        .filter(models.StockMovement.company_id == company_id)
        .order_by(models.StockMovement.created_at.desc())
        .limit(8)
        .all()
    )

    return schemas.InventoryOverviewOut(
        total_products=total_products, low_stock_count=low_stock_count,
        total_stock_value=total_stock_value, pending_transfers=pending_transfers,
        recent_movements=[_movement_out(m) for m in recent],
    )


# ============================================================
# PRODUCTS
# ============================================================
@router.get("/products", response_model=List[schemas.ProductOut])
def list_products(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Product).filter(models.Product.company_id == current_user.company_id)
    if search:
        query = query.filter(
            (models.Product.product_name.ilike(f"%{search}%")) | (models.Product.sku.ilike(f"%{search}%"))
        )
    if category and category != "All":
        query = query.filter(models.Product.category == category)
    if status_filter and status_filter != "All":
        query = query.filter(models.Product.status == status_filter.lower())
    products = query.order_by(models.Product.id).all()
    return [_product_out(db, p) for p in products]


@router.get("/products/stats", response_model=schemas.InventoryStatsOut)
def product_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    company_id = current_user.company_id
    total = db.query(models.Product).filter(models.Product.company_id == company_id).count()
    active = db.query(models.Product).filter(
        models.Product.company_id == company_id, models.Product.status == "active"
    ).count()

    stock_rows = (
        db.query(models.StockLevel, models.Product)
        .join(models.Product, models.StockLevel.product_id == models.Product.id)
        .filter(models.Product.company_id == company_id)
        .all()
    )
    low_stock = sum(1 for sl, p in stock_rows if sl.quantity_on_hand <= p.reorder_level)
    stock_value = sum((sl.quantity_on_hand * p.cost_price for sl, p in stock_rows), Decimal("0"))

    return schemas.InventoryStatsOut(
        total_products=total, active_products=active, low_stock_count=low_stock, total_stock_value=stock_value
    )


@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(
    payload: schemas.ProductCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.sku:
        existing = db.query(models.Product).filter(
            models.Product.company_id == current_user.company_id, models.Product.sku == payload.sku
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="A product with this SKU already exists")

    product = models.Product(company_id=current_user.company_id, **payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_out(db, product)


@router.get("/products/{product_id}", response_model=schemas.ProductOut)
def get_product(
    product_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(models.Product).filter(
        models.Product.id == product_id, models.Product.company_id == current_user.company_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_out(db, p)


@router.put("/products/{product_id}", response_model=schemas.ProductOut)
def update_product(
    product_id: int,
    payload: schemas.ProductUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(models.Product).filter(
        models.Product.id == product_id, models.Product.company_id == current_user.company_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return _product_out(db, p)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(models.Product).filter(
        models.Product.id == product_id, models.Product.company_id == current_user.company_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    has_movements = db.query(models.StockMovement).filter(models.StockMovement.product_id == product_id).count()
    if has_movements:
        raise HTTPException(status_code=400, detail="Cannot delete a product with recorded stock movements. Mark it inactive instead.")

    db.delete(p)
    db.commit()
    return None


# ============================================================
# STOCK LEVELS
# ============================================================
@router.get("/stock-levels", response_model=List[schemas.StockLevelOut])
def list_stock_levels(
    branch_id: Optional[int] = Query(None),
    low_stock_only: bool = Query(False),
    search: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.StockLevel)
        .join(models.Product, models.StockLevel.product_id == models.Product.id)
        .filter(models.Product.company_id == current_user.company_id)
    )
    if branch_id:
        query = query.filter(models.StockLevel.branch_id == branch_id)
    if search:
        query = query.filter(models.Product.product_name.ilike(f"%{search}%"))

    rows = query.order_by(models.StockLevel.id).all()
    results = [_stock_level_out(sl) for sl in rows]
    if low_stock_only:
        results = [r for r in results if r.is_low_stock]
    return results


# ============================================================
# STOCK MOVEMENTS (read-only ledger)
# ============================================================
@router.get("/movements", response_model=List[schemas.StockMovementOut])
def list_movements(
    product_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.StockMovement).filter(models.StockMovement.company_id == current_user.company_id)
    if product_id:
        query = query.filter(models.StockMovement.product_id == product_id)
    if branch_id:
        query = query.filter(models.StockMovement.branch_id == branch_id)
    rows = query.order_by(models.StockMovement.created_at.desc()).limit(limit).all()
    return [_movement_out(m) for m in rows]


# ============================================================
# STOCK TRANSFERS
# ============================================================
@router.get("/transfers", response_model=List[schemas.StockTransferOut])
def list_transfers(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.StockTransfer).filter(models.StockTransfer.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        query = query.filter(models.StockTransfer.status == status_filter.lower())
    rows = query.order_by(models.StockTransfer.id.desc()).all()
    return [_transfer_out(t) for t in rows]


@router.post("/transfers", response_model=schemas.StockTransferDetailOut, status_code=201)
def create_transfer(
    payload: schemas.StockTransferCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.from_branch_id == payload.to_branch_id:
        raise HTTPException(status_code=400, detail="Source and destination branch must be different")
    if not payload.items:
        raise HTTPException(status_code=400, detail="A transfer needs at least one item")

    number = _next_document_number(db, current_user.company_id, models.StockTransfer, "transfer_number", "TR")
    transfer = models.StockTransfer(
        company_id=current_user.company_id, transfer_number=number,
        from_branch_id=payload.from_branch_id, to_branch_id=payload.to_branch_id,
        transfer_date=payload.transfer_date, notes=payload.notes, status="pending",
        created_by_user_id=current_user.id,
    )
    db.add(transfer)
    db.flush()

    for item in payload.items:
        db.add(models.StockTransferItem(transfer_id=transfer.id, product_id=item.product_id, quantity=item.quantity))

    db.commit()
    db.refresh(transfer)
    return schemas.StockTransferDetailOut(
        **_transfer_out(transfer).model_dump(),
        items=[schemas.TransferItemOut(id=i.id, product_id=i.product_id, product_name=i.product.product_name,
                                        quantity=i.quantity, received_quantity=i.received_quantity)
               for i in transfer.items],
    )


@router.get("/transfers/{transfer_id}", response_model=schemas.StockTransferDetailOut)
def get_transfer(
    transfer_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(models.StockTransfer).filter(
        models.StockTransfer.id == transfer_id, models.StockTransfer.company_id == current_user.company_id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return schemas.StockTransferDetailOut(
        **_transfer_out(t).model_dump(),
        items=[schemas.TransferItemOut(id=i.id, product_id=i.product_id, product_name=i.product.product_name,
                                        quantity=i.quantity, received_quantity=i.received_quantity)
               for i in t.items],
    )


@router.put("/transfers/{transfer_id}", response_model=schemas.StockTransferDetailOut)
def update_transfer(
    transfer_id: int,
    payload: schemas.StockTransferUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(models.StockTransfer).filter(
        models.StockTransfer.id == transfer_id, models.StockTransfer.company_id == current_user.company_id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if payload.notes is not None:
        t.notes = payload.notes

    if payload.status and payload.status != t.status:
        if payload.status == "completed" and t.status != "completed":
            # move stock: decrement source, increment destination, log both movements
            for item in t.items:
                src = _get_or_create_stock_level(db, current_user.company_id, item.product_id, t.from_branch_id)
                if src.quantity_on_hand < item.quantity:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for {item.product.product_name} at source branch "
                               f"(have {src.quantity_on_hand}, need {item.quantity})",
                    )
                src.quantity_on_hand -= item.quantity
                _record_movement(db, current_user.company_id, item.product_id, t.from_branch_id,
                                  "transfer_out", item.quantity, src.quantity_on_hand, current_user.id,
                                  reference_type="stock_transfer", reference_id=t.id)

                dst = _get_or_create_stock_level(db, current_user.company_id, item.product_id, t.to_branch_id)
                dst.quantity_on_hand += item.quantity
                item.received_quantity = item.quantity
                _record_movement(db, current_user.company_id, item.product_id, t.to_branch_id,
                                  "transfer_in", item.quantity, dst.quantity_on_hand, current_user.id,
                                  reference_type="stock_transfer", reference_id=t.id)
        t.status = payload.status

    db.commit()
    db.refresh(t)
    return schemas.StockTransferDetailOut(
        **_transfer_out(t).model_dump(),
        items=[schemas.TransferItemOut(id=i.id, product_id=i.product_id, product_name=i.product.product_name,
                                        quantity=i.quantity, received_quantity=i.received_quantity)
               for i in t.items],
    )


@router.delete("/transfers/{transfer_id}", status_code=204)
def delete_transfer(
    transfer_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(models.StockTransfer).filter(
        models.StockTransfer.id == transfer_id, models.StockTransfer.company_id == current_user.company_id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t.status not in ("pending",):
        raise HTTPException(status_code=400, detail="Only pending transfers can be deleted")

    db.delete(t)
    db.commit()
    return None


# ============================================================
# STOCK ADJUSTMENTS
# ============================================================
@router.get("/adjustments", response_model=List[schemas.StockAdjustmentOut])
def list_adjustments(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.StockAdjustment).filter(models.StockAdjustment.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        query = query.filter(models.StockAdjustment.status == status_filter.lower())
    rows = query.order_by(models.StockAdjustment.id.desc()).all()
    return [_adjustment_out(a) for a in rows]


@router.post("/adjustments", response_model=schemas.StockAdjustmentDetailOut, status_code=201)
def create_adjustment(
    payload: schemas.StockAdjustmentCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="An adjustment needs at least one item")

    number = _next_document_number(db, current_user.company_id, models.StockAdjustment, "adjustment_number", "ADJ")
    adjustment = models.StockAdjustment(
        company_id=current_user.company_id, adjustment_number=number, branch_id=payload.branch_id,
        adjustment_date=payload.adjustment_date, reason=payload.reason, notes=payload.notes,
        status="draft", created_by_user_id=current_user.id,
    )
    db.add(adjustment)
    db.flush()

    for item in payload.items:
        db.add(models.StockAdjustmentItem(
            adjustment_id=adjustment.id, product_id=item.product_id,
            quantity_change=item.quantity_change, reason_note=item.reason_note,
        ))

    db.commit()
    db.refresh(adjustment)
    return schemas.StockAdjustmentDetailOut(
        **_adjustment_out(adjustment).model_dump(),
        items=[schemas.AdjustmentItemOut(id=i.id, product_id=i.product_id, product_name=i.product.product_name,
                                          quantity_change=i.quantity_change, reason_note=i.reason_note)
               for i in adjustment.items],
    )


@router.get("/adjustments/{adjustment_id}", response_model=schemas.StockAdjustmentDetailOut)
def get_adjustment(
    adjustment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(models.StockAdjustment).filter(
        models.StockAdjustment.id == adjustment_id, models.StockAdjustment.company_id == current_user.company_id
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    return schemas.StockAdjustmentDetailOut(
        **_adjustment_out(a).model_dump(),
        items=[schemas.AdjustmentItemOut(id=i.id, product_id=i.product_id, product_name=i.product.product_name,
                                          quantity_change=i.quantity_change, reason_note=i.reason_note)
               for i in a.items],
    )


@router.put("/adjustments/{adjustment_id}/complete", response_model=schemas.StockAdjustmentDetailOut)
def complete_adjustment(
    adjustment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(models.StockAdjustment).filter(
        models.StockAdjustment.id == adjustment_id, models.StockAdjustment.company_id == current_user.company_id
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    if a.status == "completed":
        raise HTTPException(status_code=400, detail="Adjustment is already completed")

    for item in a.items:
        sl = _get_or_create_stock_level(db, current_user.company_id, item.product_id, a.branch_id)
        sl.quantity_on_hand += item.quantity_change
        movement_type = "adjustment_in" if item.quantity_change >= 0 else "adjustment_out"
        _record_movement(db, current_user.company_id, item.product_id, a.branch_id, movement_type,
                          abs(item.quantity_change), sl.quantity_on_hand, current_user.id,
                          reference_type="stock_adjustment", reference_id=a.id, notes=item.reason_note)

    a.status = "completed"
    db.commit()
    db.refresh(a)
    return schemas.StockAdjustmentDetailOut(
        **_adjustment_out(a).model_dump(),
        items=[schemas.AdjustmentItemOut(id=i.id, product_id=i.product_id, product_name=i.product.product_name,
                                          quantity_change=i.quantity_change, reason_note=i.reason_note)
               for i in a.items],
    )


@router.delete("/adjustments/{adjustment_id}", status_code=204)
def delete_adjustment(
    adjustment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(models.StockAdjustment).filter(
        models.StockAdjustment.id == adjustment_id, models.StockAdjustment.company_id == current_user.company_id
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    if a.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot delete a completed adjustment")

    db.delete(a)
    db.commit()
    return None
