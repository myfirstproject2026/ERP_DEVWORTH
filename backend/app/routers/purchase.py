from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user
from app.routers.inventory import _get_or_create_stock_level, _record_movement

router = APIRouter(prefix="/api/purchase", tags=["Purchase"])


# ============================================================
# Helpers
# ============================================================
def _next_document_number(db: Session, company_id: int, model, number_field: str, prefix: str) -> str:
    count = db.query(model).filter(model.company_id == company_id).count()
    return f"{prefix}-{count + 1:05d}"


def _calc_line_items(items: List[schemas.LineItemIn]):
    subtotal = Decimal("0")
    tax_amount = Decimal("0")
    rows = []
    for it in items:
        line_base = (it.quantity or Decimal("0")) * (it.unit_price or Decimal("0"))
        line_tax = line_base * (it.tax_rate or Decimal("0")) / Decimal("100")
        line_total = line_base + line_tax
        subtotal += line_base
        tax_amount += line_tax
        rows.append((it, line_total))
    return subtotal, tax_amount, subtotal + tax_amount, rows


def _ensure_product_link(db: Session, company_id: int, poi: models.PurchaseOrderItem, branch_id: int) -> None:
    """Link a typed-name PO line to an inventory product: reuse a same-named product,
    otherwise create it from the line's own details so the goods can be stocked."""
    if poi.product_id:
        return
    name = (poi.product_name or "").strip()
    product = db.query(models.Product).filter(
        models.Product.company_id == company_id,
        sqlfunc.lower(models.Product.product_name) == name.lower(),
    ).first()
    if not product:
        product = models.Product(
            company_id=company_id, product_name=name, unit_of_measure=poi.unit or "unit",
            cost_price=poi.unit_price, tax_rate=poi.tax_rate, primary_branch_id=branch_id,
        )
        db.add(product)
        db.flush()
    poi.product_id = product.id


def _supplier_out(db: Session, s: models.Supplier) -> schemas.SupplierOut:
    open_po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.supplier_id == s.id,
        models.PurchaseOrder.status.notin_(["received", "cancelled"]),
    ).count()
    total_spend = db.query(sqlfunc.coalesce(sqlfunc.sum(models.PurchaseBill.total_amount), 0)).filter(
        models.PurchaseBill.supplier_id == s.id, models.PurchaseBill.status != "cancelled"
    ).scalar() or Decimal("0")
    return schemas.SupplierOut(
        id=s.id, supplier_name=s.supplier_name, contact_person=s.contact_person, email=s.email,
        phone=s.phone, gstin=s.gstin, billing_address=s.billing_address, category=s.category,
        payment_terms=s.payment_terms, rating=s.rating, status=s.status,
        assigned_to_user_id=s.assigned_to_user_id,
        assigned_to_name=s.assigned_to.full_name if s.assigned_to else None,
        open_po_count=open_po, total_spend=total_spend,
    )


def _po_out(o: models.PurchaseOrder) -> schemas.PurchaseOrderOut:
    return schemas.PurchaseOrderOut(
        id=o.id, po_number=o.po_number, branch_id=o.branch_id, branch_name=o.branch.branch_name,
        supplier_id=o.supplier_id, supplier_name=o.supplier.supplier_name, po_date=o.po_date,
        expected_delivery_date=o.expected_delivery_date, status=o.status, subtotal=o.subtotal,
        tax_amount=o.tax_amount, total_amount=o.total_amount, notes=o.notes,
    )


def _receipt_out(r: models.PurchaseReceipt) -> schemas.PurchaseReceiptOut:
    return schemas.PurchaseReceiptOut(
        id=r.id, grn_number=r.grn_number, branch_id=r.branch_id, branch_name=r.branch.branch_name,
        purchase_order_id=r.purchase_order_id, po_number=r.purchase_order.po_number,
        supplier_name=r.purchase_order.supplier.supplier_name, receipt_date=r.receipt_date,
        status=r.status, notes=r.notes,
    )


def _bill_out(b: models.PurchaseBill) -> schemas.PurchaseBillOut:
    return schemas.PurchaseBillOut(
        id=b.id, bill_number=b.bill_number, branch_id=b.branch_id, branch_name=b.branch.branch_name,
        supplier_id=b.supplier_id, supplier_name=b.supplier.supplier_name,
        purchase_order_id=b.purchase_order_id, bill_date=b.bill_date, due_date=b.due_date,
        status=b.status, subtotal=b.subtotal, tax_amount=b.tax_amount, total_amount=b.total_amount,
        amount_paid=b.amount_paid, balance_due=b.total_amount - b.amount_paid,
    )


def _refresh_bill_status(b: models.PurchaseBill):
    if b.status == "cancelled":
        return
    if b.amount_paid >= b.total_amount:
        b.status = "paid"
    elif b.amount_paid > 0:
        b.status = "partially_paid"
    elif b.due_date < date.today():
        b.status = "overdue"
    else:
        b.status = "pending"


# ============================================================
# OVERVIEW
# ============================================================
@router.get("/overview", response_model=schemas.PurchaseOverviewOut)
def get_overview(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = current_user.company_id
    total_suppliers = db.query(models.Supplier).filter(models.Supplier.company_id == cid).count()
    open_pos = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.company_id == cid,
        models.PurchaseOrder.status.notin_(["received", "cancelled"]),
    ).count()
    pending_receipts = db.query(models.PurchaseReceipt).filter(
        models.PurchaseReceipt.company_id == cid, models.PurchaseReceipt.status == "draft"
    ).count()
    bills_due = db.query(sqlfunc.coalesce(
        sqlfunc.sum(models.PurchaseBill.total_amount - models.PurchaseBill.amount_paid), 0
    )).filter(
        models.PurchaseBill.company_id == cid, models.PurchaseBill.status.in_(["pending", "partially_paid", "overdue"])
    ).scalar() or Decimal("0")
    bills_overdue = db.query(models.PurchaseBill).filter(
        models.PurchaseBill.company_id == cid, models.PurchaseBill.status == "overdue"
    ).count()
    recent = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.company_id == cid
    ).order_by(models.PurchaseOrder.id.desc()).limit(5).all()

    return schemas.PurchaseOverviewOut(
        total_suppliers=total_suppliers, open_purchase_orders=open_pos,
        pending_receipts=pending_receipts, bills_due_amount=bills_due,
        bills_overdue_count=bills_overdue, recent_orders=[_po_out(o) for o in recent],
    )


# ============================================================
# SUPPLIERS
# ============================================================
@router.get("/suppliers", response_model=List[schemas.SupplierOut])
def list_suppliers(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Supplier).filter(models.Supplier.company_id == current_user.company_id)
    if search:
        q = q.filter(models.Supplier.supplier_name.ilike(f"%{search}%"))
    if status_filter and status_filter != "All":
        q = q.filter(models.Supplier.status == status_filter.lower())
    suppliers = q.order_by(models.Supplier.id).all()
    return [_supplier_out(db, s) for s in suppliers]


@router.get("/suppliers/stats", response_model=schemas.SupplierStatsOut)
def supplier_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = current_user.company_id
    total = db.query(models.Supplier).filter(models.Supplier.company_id == cid).count()
    active = db.query(models.Supplier).filter(models.Supplier.company_id == cid, models.Supplier.status == "active").count()
    open_pos = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.company_id == cid, models.PurchaseOrder.status.notin_(["received", "cancelled"])
    ).count()
    bills_due = db.query(sqlfunc.coalesce(
        sqlfunc.sum(models.PurchaseBill.total_amount - models.PurchaseBill.amount_paid), 0
    )).filter(
        models.PurchaseBill.company_id == cid, models.PurchaseBill.status.in_(["pending", "partially_paid", "overdue"])
    ).scalar() or Decimal("0")
    return schemas.SupplierStatsOut(
        total_suppliers=total, active_suppliers=active, open_purchase_orders=open_pos, bills_due=bills_due
    )


@router.post("/suppliers", response_model=schemas.SupplierOut, status_code=201)
def create_supplier(
    payload: schemas.SupplierCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = models.Supplier(company_id=current_user.company_id, **payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _supplier_out(db, s)


@router.get("/suppliers/{supplier_id}", response_model=schemas.SupplierOut)
def get_supplier(
    supplier_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    s = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id, models.Supplier.company_id == current_user.company_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _supplier_out(db, s)


@router.put("/suppliers/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: schemas.SupplierUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id, models.Supplier.company_id == current_user.company_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return _supplier_out(db, s)


@router.delete("/suppliers/{supplier_id}", status_code=204)
def delete_supplier(
    supplier_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    s = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id, models.Supplier.company_id == current_user.company_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    has_pos = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.supplier_id == supplier_id).count()
    if has_pos:
        raise HTTPException(status_code=400, detail="Cannot delete a supplier with existing purchase orders")
    db.delete(s)
    db.commit()
    return None


# ============================================================
# PURCHASE ORDERS
# ============================================================
@router.get("/orders", response_model=List[schemas.PurchaseOrderOut])
def list_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    supplier_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        q = q.filter(models.PurchaseOrder.status == status_filter.lower())
    if supplier_id:
        q = q.filter(models.PurchaseOrder.supplier_id == supplier_id)
    orders = q.order_by(models.PurchaseOrder.id.desc()).all()
    return [_po_out(o) for o in orders]


@router.post("/orders", response_model=schemas.PurchaseOrderDetailOut, status_code=201)
def create_order(
    payload: schemas.PurchaseOrderCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == payload.supplier_id, models.Supplier.company_id == current_user.company_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    subtotal, tax_amount, total, rows = _calc_line_items(payload.items)
    o = models.PurchaseOrder(
        company_id=current_user.company_id, branch_id=payload.branch_id, supplier_id=payload.supplier_id,
        po_number=_next_document_number(db, current_user.company_id, models.PurchaseOrder, "po_number", "PO"),
        po_date=payload.po_date, expected_delivery_date=payload.expected_delivery_date,
        status="draft", subtotal=subtotal, tax_amount=tax_amount, total_amount=total,
        notes=payload.notes, created_by_user_id=current_user.id,
    )
    db.add(o)
    db.flush()
    for it, line_total in rows:
        db.add(models.PurchaseOrderItem(
            purchase_order_id=o.id, product_id=it.product_id, product_name=it.product_name,
            description=it.description, quantity=it.quantity, unit=it.unit, unit_price=it.unit_price,
            tax_rate=it.tax_rate, line_total=line_total,
        ))
    db.commit()
    db.refresh(o)
    return schemas.PurchaseOrderDetailOut(**_po_out(o).model_dump(), items=[
        schemas.LineItemOut(id=i.id, product_name=i.product_name, description=i.description,
                             quantity=i.quantity, unit=i.unit, unit_price=i.unit_price,
                             tax_rate=i.tax_rate, line_total=i.line_total, product_id=i.product_id,
                             received_quantity=i.received_quantity)
        for i in o.items
    ])


@router.get("/orders/{order_id}", response_model=schemas.PurchaseOrderDetailOut)
def get_order(order_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == order_id, models.PurchaseOrder.company_id == current_user.company_id
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return schemas.PurchaseOrderDetailOut(**_po_out(o).model_dump(), items=[
        schemas.LineItemOut(id=i.id, product_name=i.product_name, description=i.description,
                             quantity=i.quantity, unit=i.unit, unit_price=i.unit_price,
                             tax_rate=i.tax_rate, line_total=i.line_total, product_id=i.product_id,
                             received_quantity=i.received_quantity)
        for i in o.items
    ])


@router.put("/orders/{order_id}", response_model=schemas.PurchaseOrderOut)
def update_order(
    order_id: int,
    payload: schemas.PurchaseOrderUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    o = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == order_id, models.PurchaseOrder.company_id == current_user.company_id
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    update_data = payload.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(o, field, value)

    if payload.items is not None:
        for existing in list(o.items):
            db.delete(existing)
        db.flush()
        subtotal, tax_amount, total, rows = _calc_line_items(payload.items)
        o.subtotal, o.tax_amount, o.total_amount = subtotal, tax_amount, total
        for it, line_total in rows:
            db.add(models.PurchaseOrderItem(
                purchase_order_id=o.id, product_id=it.product_id, product_name=it.product_name,
                description=it.description, quantity=it.quantity, unit=it.unit, unit_price=it.unit_price,
                tax_rate=it.tax_rate, line_total=line_total,
            ))

    db.commit()
    db.refresh(o)
    return _po_out(o)


@router.delete("/orders/{order_id}", status_code=204)
def delete_order(order_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == order_id, models.PurchaseOrder.company_id == current_user.company_id
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if o.status not in ("draft", "cancelled"):
        raise HTTPException(status_code=400, detail="Only draft or cancelled orders can be deleted")
    db.delete(o)
    db.commit()
    return None


# ============================================================
# GOODS RECEIPT NOTES (GRN)
# ============================================================
@router.get("/receipts", response_model=List[schemas.PurchaseReceiptOut])
def list_receipts(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.PurchaseReceipt).filter(models.PurchaseReceipt.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        q = q.filter(models.PurchaseReceipt.status == status_filter.lower())
    receipts = q.order_by(models.PurchaseReceipt.id.desc()).all()
    return [_receipt_out(r) for r in receipts]


@router.post("/receipts", response_model=schemas.PurchaseReceiptDetailOut, status_code=201)
def create_receipt(
    payload: schemas.PurchaseReceiptCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == payload.purchase_order_id, models.PurchaseOrder.company_id == current_user.company_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status in ("received", "cancelled", "draft"):
        raise HTTPException(status_code=400, detail=f"Cannot receive against a {po.status} purchase order")

    r = models.PurchaseReceipt(
        company_id=current_user.company_id, branch_id=payload.branch_id,
        grn_number=_next_document_number(db, current_user.company_id, models.PurchaseReceipt, "grn_number", "GRN"),
        purchase_order_id=po.id, receipt_date=payload.receipt_date, status="draft",
        notes=payload.notes, created_by_user_id=current_user.id,
    )
    db.add(r)
    db.flush()

    for item in payload.items:
        poi = db.query(models.PurchaseOrderItem).filter(
            models.PurchaseOrderItem.id == item.purchase_order_item_id,
            models.PurchaseOrderItem.purchase_order_id == po.id,
        ).first()
        if not poi:
            raise HTTPException(status_code=404, detail=f"PO line item {item.purchase_order_item_id} not found")
        _ensure_product_link(db, current_user.company_id, poi, po.branch_id)
        remaining = poi.quantity - poi.received_quantity
        if item.quantity_received > remaining:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot receive {item.quantity_received} of '{poi.product_name}' — only {remaining} remaining on the PO",
            )
        db.add(models.PurchaseReceiptItem(
            purchase_receipt_id=r.id, purchase_order_item_id=poi.id, product_id=poi.product_id,
            product_name=poi.product_name, quantity_received=item.quantity_received, unit=poi.unit,
        ))

    db.commit()
    db.refresh(r)
    return schemas.PurchaseReceiptDetailOut(**_receipt_out(r).model_dump(), items=[
        schemas.ReceiptItemOut(id=i.id, purchase_order_item_id=i.purchase_order_item_id,
                                product_id=i.product_id, product_name=i.product_name,
                                quantity_received=i.quantity_received, unit=i.unit)
        for i in r.items
    ])


@router.get("/receipts/{receipt_id}", response_model=schemas.PurchaseReceiptDetailOut)
def get_receipt(receipt_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.query(models.PurchaseReceipt).filter(
        models.PurchaseReceipt.id == receipt_id, models.PurchaseReceipt.company_id == current_user.company_id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return schemas.PurchaseReceiptDetailOut(**_receipt_out(r).model_dump(), items=[
        schemas.ReceiptItemOut(id=i.id, purchase_order_item_id=i.purchase_order_item_id,
                                product_id=i.product_id, product_name=i.product_name,
                                quantity_received=i.quantity_received, unit=i.unit)
        for i in r.items
    ])


@router.put("/receipts/{receipt_id}/complete", response_model=schemas.PurchaseReceiptDetailOut)
def complete_receipt(
    receipt_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    r = db.query(models.PurchaseReceipt).filter(
        models.PurchaseReceipt.id == receipt_id, models.PurchaseReceipt.company_id == current_user.company_id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if r.status == "completed":
        raise HTTPException(status_code=400, detail="Receipt is already completed")

    for item in r.items:
        sl = _get_or_create_stock_level(db, current_user.company_id, item.product_id, r.branch_id)
        sl.quantity_on_hand += item.quantity_received
        _record_movement(
            db, current_user.company_id, item.product_id, r.branch_id, "purchase_in",
            item.quantity_received, sl.quantity_on_hand, current_user.id,
            reference_type="purchase_receipt", reference_id=r.id,
            notes=f"Received via {r.grn_number} ({r.purchase_order.po_number})",
        )
        poi = item.purchase_order_item
        poi.received_quantity += item.quantity_received

    r.status = "completed"

    po = r.purchase_order
    all_items = po.items
    if all(i.received_quantity >= i.quantity for i in all_items):
        po.status = "received"
    elif any(i.received_quantity > 0 for i in all_items):
        po.status = "partially_received"

    db.commit()
    db.refresh(r)
    return schemas.PurchaseReceiptDetailOut(**_receipt_out(r).model_dump(), items=[
        schemas.ReceiptItemOut(id=i.id, purchase_order_item_id=i.purchase_order_item_id,
                                product_id=i.product_id, product_name=i.product_name,
                                quantity_received=i.quantity_received, unit=i.unit)
        for i in r.items
    ])


# ============================================================
# PURCHASE BILLS
# ============================================================
@router.get("/bills", response_model=List[schemas.PurchaseBillOut])
def list_bills(
    status_filter: Optional[str] = Query(None, alias="status"),
    supplier_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.PurchaseBill).filter(models.PurchaseBill.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        q = q.filter(models.PurchaseBill.status == status_filter.lower())
    if supplier_id:
        q = q.filter(models.PurchaseBill.supplier_id == supplier_id)
    bills = q.order_by(models.PurchaseBill.id.desc()).all()
    for b in bills:
        _refresh_bill_status(b)
    db.commit()
    return [_bill_out(b) for b in bills]


@router.post("/bills", response_model=schemas.PurchaseBillDetailOut, status_code=201)
def create_bill(
    payload: schemas.PurchaseBillCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == payload.supplier_id, models.Supplier.company_id == current_user.company_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    subtotal, tax_amount, total, rows = _calc_line_items(payload.items)
    b = models.PurchaseBill(
        company_id=current_user.company_id, branch_id=payload.branch_id, supplier_id=payload.supplier_id,
        bill_number=_next_document_number(db, current_user.company_id, models.PurchaseBill, "bill_number", "BILL"),
        purchase_order_id=payload.purchase_order_id, bill_date=payload.bill_date, due_date=payload.due_date,
        status="pending", subtotal=subtotal, tax_amount=tax_amount, total_amount=total, amount_paid=0,
        created_by_user_id=current_user.id,
    )
    db.add(b)
    db.flush()
    for it, line_total in rows:
        db.add(models.PurchaseBillItem(
            purchase_bill_id=b.id, product_name=it.product_name, description=it.description,
            quantity=it.quantity, unit=it.unit, unit_price=it.unit_price, tax_rate=it.tax_rate,
            line_total=line_total,
        ))
    _refresh_bill_status(b)

    # Auto-post a balanced journal entry (Debit Cost of Goods Sold / Credit Accounts
    # Payable) so this bill actually shows up in Finance's P&L report, mirroring the
    # same pattern used for Expenses. Skips gracefully if no suitable accounts exist.
    cogs_account = (
        db.query(models.ChartOfAccount)
        .filter(
            models.ChartOfAccount.company_id == current_user.company_id,
            models.ChartOfAccount.account_type == "expense",
            models.ChartOfAccount.account_name.ilike("%cost of goods%"),
        )
        .first()
        or db.query(models.ChartOfAccount)
        .filter(
            models.ChartOfAccount.company_id == current_user.company_id,
            models.ChartOfAccount.account_type == "expense",
        )
        .order_by(models.ChartOfAccount.account_code)
        .first()
    )
    payable_account = (
        db.query(models.ChartOfAccount)
        .filter(
            models.ChartOfAccount.company_id == current_user.company_id,
            models.ChartOfAccount.account_type == "liability",
            models.ChartOfAccount.account_name.ilike("%payable%"),
        )
        .first()
    )
    if cogs_account and payable_account:
        entry_number = _next_document_number(db, current_user.company_id, models.JournalEntry, "entry_number", "JE")
        je = models.JournalEntry(
            company_id=current_user.company_id, branch_id=payload.branch_id, entry_number=entry_number,
            entry_date=payload.bill_date, reference=b.bill_number,
            narration=f"Purchase bill {b.bill_number} — {supplier.supplier_name}",
            status="posted", total_debit=total, total_credit=total,
            source_type="purchase_bill", source_id=b.id,
            posted_at=sqlfunc.now(), created_by_user_id=current_user.id,
        )
        db.add(je)
        db.flush()
        db.add(models.JournalEntryLine(
            journal_entry_id=je.id, account_id=cogs_account.id, debit_amount=total, credit_amount=0,
            description=f"Bill {b.bill_number}",
        ))
        db.add(models.JournalEntryLine(
            journal_entry_id=je.id, account_id=payable_account.id, debit_amount=0, credit_amount=total,
            description=f"Bill {b.bill_number} — {supplier.supplier_name}",
        ))

    db.commit()
    db.refresh(b)
    return schemas.PurchaseBillDetailOut(**_bill_out(b).model_dump(), items=[
        schemas.LineItemOut(id=i.id, product_name=i.product_name, description=i.description,
                             quantity=i.quantity, unit=i.unit, unit_price=i.unit_price,
                             tax_rate=i.tax_rate, line_total=i.line_total)
        for i in b.items
    ])


@router.get("/bills/{bill_id}", response_model=schemas.PurchaseBillDetailOut)
def get_bill(bill_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(models.PurchaseBill).filter(
        models.PurchaseBill.id == bill_id, models.PurchaseBill.company_id == current_user.company_id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bill not found")
    _refresh_bill_status(b)
    db.commit()
    db.refresh(b)
    return schemas.PurchaseBillDetailOut(**_bill_out(b).model_dump(), items=[
        schemas.LineItemOut(id=i.id, product_name=i.product_name, description=i.description,
                             quantity=i.quantity, unit=i.unit, unit_price=i.unit_price,
                             tax_rate=i.tax_rate, line_total=i.line_total)
        for i in b.items
    ])


@router.delete("/bills/{bill_id}", status_code=204)
def delete_bill(bill_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(models.PurchaseBill).filter(
        models.PurchaseBill.id == bill_id, models.PurchaseBill.company_id == current_user.company_id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bill not found")
    if b.amount_paid > 0:
        raise HTTPException(status_code=400, detail="Cannot delete a bill that already has payments recorded")
    db.delete(b)
    db.commit()
    return None


@router.post("/bills/{bill_id}/payments", response_model=schemas.PurchaseBillDetailOut)
def record_payment(
    bill_id: int,
    payload: schemas.PurchaseBillPaymentRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = db.query(models.PurchaseBill).filter(
        models.PurchaseBill.id == bill_id, models.PurchaseBill.company_id == current_user.company_id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bill not found")

    balance = b.total_amount - b.amount_paid
    if payload.amount > balance:
        raise HTTPException(status_code=400, detail=f"Payment of {payload.amount} exceeds outstanding balance of {balance}")

    db.add(models.PurchaseBillPayment(
        purchase_bill_id=b.id, company_id=current_user.company_id, amount=payload.amount,
        payment_date=payload.payment_date, payment_method=payload.payment_method,
        reference_number=payload.reference_number,
    ))
    b.amount_paid += payload.amount
    _refresh_bill_status(b)

    db.commit()
    db.refresh(b)
    return schemas.PurchaseBillDetailOut(**_bill_out(b).model_dump(), items=[
        schemas.LineItemOut(id=i.id, product_name=i.product_name, description=i.description,
                             quantity=i.quantity, unit=i.unit, unit_price=i.unit_price,
                             tax_rate=i.tax_rate, line_total=i.line_total)
        for i in b.items
    ])
