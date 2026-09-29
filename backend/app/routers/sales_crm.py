from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/sales", tags=["Sales + CRM"])


# ============================================================
# Helpers
# ============================================================
def _next_document_number(db: Session, company_id: int, model, number_field: str, prefix: str) -> str:
    """Generates PREFIX-00001 style numbers, sequential per company per document type."""
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


def _customer_out(db: Session, c: models.Customer) -> schemas.CustomerOut:
    open_orders = db.query(models.SalesOrder).filter(
        models.SalesOrder.customer_id == c.id,
        models.SalesOrder.status.notin_(["completed", "cancelled"]),
    ).count()
    lifetime = db.query(sqlfunc.coalesce(sqlfunc.sum(models.Invoice.total_amount), 0)).filter(
        models.Invoice.customer_id == c.id, models.Invoice.status != "cancelled"
    ).scalar() or Decimal("0")
    return schemas.CustomerOut(
        id=c.id, customer_name=c.customer_name, customer_type=c.customer_type, city=c.city,
        zone=c.zone, phone=c.phone, email=c.email, gstin=c.gstin,
        branch_name=c.branch.branch_name if c.branch else None,
        assigned_to_name=c.assigned_to.full_name if c.assigned_to else None,
        status=c.status, credit_limit=c.credit_limit,
        open_orders_count=open_orders, lifetime_value=lifetime,
    )


def _lead_out(lead: models.Lead) -> schemas.LeadOut:
    return schemas.LeadOut(
        id=lead.id, lead_name=lead.lead_name, company_name=lead.company_name,
        contact_person=lead.contact_person, email=lead.email, phone=lead.phone,
        source=lead.source, status=lead.status, estimated_value=lead.estimated_value,
        assigned_to_name=lead.assigned_to.full_name if lead.assigned_to else None,
        converted_customer_id=lead.converted_customer_id, created_at=lead.created_at,
    )


def _quotation_out(q: models.Quotation) -> schemas.QuotationOut:
    return schemas.QuotationOut(
        id=q.id, quotation_number=q.quotation_number, customer_id=q.customer_id,
        customer_name=q.customer.customer_name, quotation_date=q.quotation_date,
        valid_until=q.valid_until, status=q.status, subtotal=q.subtotal,
        tax_amount=q.tax_amount, total_amount=q.total_amount,
    )


def _order_out(o: models.SalesOrder) -> schemas.SalesOrderOut:
    return schemas.SalesOrderOut(
        id=o.id, order_number=o.order_number, customer_id=o.customer_id,
        customer_name=o.customer.customer_name, order_date=o.order_date,
        expected_delivery_date=o.expected_delivery_date, status=o.status,
        subtotal=o.subtotal, tax_amount=o.tax_amount, total_amount=o.total_amount,
    )


def _invoice_out(inv: models.Invoice) -> schemas.InvoiceOut:
    return schemas.InvoiceOut(
        id=inv.id, invoice_number=inv.invoice_number, customer_id=inv.customer_id,
        customer_name=inv.customer.customer_name, invoice_date=inv.invoice_date,
        due_date=inv.due_date, status=inv.status, subtotal=inv.subtotal,
        tax_amount=inv.tax_amount, total_amount=inv.total_amount, amount_paid=inv.amount_paid,
        balance_due=inv.total_amount - inv.amount_paid,
    )


def _get_customer_or_404(db: Session, company_id: int, customer_id: int) -> models.Customer:
    c = db.query(models.Customer).filter(
        models.Customer.id == customer_id, models.Customer.company_id == company_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


# ============================================================
# CUSTOMERS
# ============================================================
@router.get("/customers", response_model=list[schemas.CustomerOut])
def list_customers(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Customer).filter(models.Customer.company_id == current_user.company_id)
    if search:
        query = query.filter(models.Customer.customer_name.ilike(f"%{search}%"))
    if status_filter and status_filter != "All":
        query = query.filter(models.Customer.status == status_filter.lower())
    customers = query.order_by(models.Customer.id.desc()).all()
    return [_customer_out(db, c) for c in customers]


@router.get("/customers/stats", response_model=schemas.CustomerStatsOut)
def customer_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base = db.query(models.Customer).filter(models.Customer.company_id == current_user.company_id)
    total = base.count()
    active = base.filter(models.Customer.status == "active").count()
    month_start = date.today().replace(day=1)
    new_this_month = base.filter(models.Customer.created_at >= month_start).count()
    lifetime = db.query(sqlfunc.coalesce(sqlfunc.sum(models.Invoice.total_amount), 0)).filter(
        models.Invoice.company_id == current_user.company_id, models.Invoice.status != "cancelled"
    ).scalar() or Decimal("0")
    return schemas.CustomerStatsOut(
        total_customers=total, active_customers=active,
        new_this_month=new_this_month, total_lifetime_value=lifetime,
    )


@router.post("/customers", response_model=schemas.CustomerOut, status_code=201)
def create_customer(
    payload: schemas.CustomerCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    customer = models.Customer(company_id=current_user.company_id, **payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _customer_out(db, customer)


@router.get("/customers/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(
    customer_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = _get_customer_or_404(db, current_user.company_id, customer_id)
    return _customer_out(db, c)


@router.put("/customers/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(
    customer_id: int,
    payload: schemas.CustomerUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = _get_customer_or_404(db, current_user.company_id, customer_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return _customer_out(db, c)


@router.delete("/customers/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = _get_customer_or_404(db, current_user.company_id, customer_id)
    has_docs = (
        db.query(models.Quotation).filter(models.Quotation.customer_id == customer_id).count()
        or db.query(models.SalesOrder).filter(models.SalesOrder.customer_id == customer_id).count()
        or db.query(models.Invoice).filter(models.Invoice.customer_id == customer_id).count()
    )
    if has_docs:
        raise HTTPException(status_code=400, detail="Cannot delete a customer with existing quotations, orders, or invoices")
    db.delete(c)
    db.commit()
    return None


# ============================================================
# LEADS
# ============================================================
@router.get("/leads", response_model=list[schemas.LeadOut])
def list_leads(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Lead).filter(models.Lead.company_id == current_user.company_id)
    if search:
        query = query.filter(models.Lead.lead_name.ilike(f"%{search}%"))
    if status_filter and status_filter != "All":
        query = query.filter(models.Lead.status == status_filter.lower())
    leads = query.order_by(models.Lead.id.desc()).all()
    return [_lead_out(l) for l in leads]


@router.get("/leads/stats", response_model=schemas.LeadStatsOut)
def lead_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base = db.query(models.Lead).filter(models.Lead.company_id == current_user.company_id)
    total = base.count()
    new_leads = base.filter(models.Lead.status == "new").count()
    qualified = base.filter(models.Lead.status == "qualified").count()
    won = base.filter(models.Lead.status == "won").count()
    pipeline_value = db.query(sqlfunc.coalesce(sqlfunc.sum(models.Lead.estimated_value), 0)).filter(
        models.Lead.company_id == current_user.company_id,
        models.Lead.status.notin_(["won", "lost"]),
    ).scalar() or Decimal("0")
    return schemas.LeadStatsOut(
        total_leads=total, new_leads=new_leads, qualified_leads=qualified,
        won_leads=won, pipeline_value=pipeline_value,
    )


@router.post("/leads", response_model=schemas.LeadOut, status_code=201)
def create_lead(
    payload: schemas.LeadCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = models.Lead(company_id=current_user.company_id, **payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead)


@router.put("/leads/{lead_id}", response_model=schemas.LeadOut)
def update_lead(
    lead_id: int,
    payload: schemas.LeadUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = db.query(models.Lead).filter(
        models.Lead.id == lead_id, models.Lead.company_id == current_user.company_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead)


@router.post("/leads/{lead_id}/convert", response_model=schemas.CustomerOut)
def convert_lead(
    lead_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = db.query(models.Lead).filter(
        models.Lead.id == lead_id, models.Lead.company_id == current_user.company_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.converted_customer_id:
        raise HTTPException(status_code=400, detail="This lead has already been converted")

    customer = models.Customer(
        company_id=current_user.company_id,
        customer_name=lead.company_name or lead.lead_name,
        email=lead.email,
        phone=lead.phone,
        lead_source=lead.source,
        assigned_to_user_id=lead.assigned_to_user_id,
        status="active",
    )
    db.add(customer)
    db.flush()

    lead.status = "won"
    lead.converted_customer_id = customer.id
    db.commit()
    db.refresh(customer)
    return _customer_out(db, customer)


@router.delete("/leads/{lead_id}", status_code=204)
def delete_lead(
    lead_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = db.query(models.Lead).filter(
        models.Lead.id == lead_id, models.Lead.company_id == current_user.company_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return None


# ============================================================
# QUOTATIONS
# ============================================================
@router.get("/quotations", response_model=list[schemas.QuotationOut])
def list_quotations(
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Quotation).filter(models.Quotation.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        query = query.filter(models.Quotation.status == status_filter.lower())
    if customer_id:
        query = query.filter(models.Quotation.customer_id == customer_id)
    quotations = query.order_by(models.Quotation.id.desc()).all()
    return [_quotation_out(q) for q in quotations]


@router.post("/quotations", response_model=schemas.QuotationDetailOut, status_code=201)
def create_quotation(
    payload: schemas.QuotationCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_customer_or_404(db, current_user.company_id, payload.customer_id)
    if not payload.items:
        raise HTTPException(status_code=400, detail="A quotation needs at least one line item")

    subtotal, tax_amount, total, rows = _calc_line_items(payload.items)
    quotation = models.Quotation(
        company_id=current_user.company_id,
        branch_id=payload.branch_id,
        quotation_number=_next_document_number(db, current_user.company_id, models.Quotation, "quotation_number", "QT"),
        customer_id=payload.customer_id,
        lead_id=payload.lead_id,
        quotation_date=payload.quotation_date,
        valid_until=payload.valid_until,
        notes=payload.notes,
        subtotal=subtotal, tax_amount=tax_amount, total_amount=total,
        created_by_user_id=current_user.id,
    )
    db.add(quotation)
    db.flush()
    for it, line_total in rows:
        db.add(models.QuotationItem(
            quotation_id=quotation.id, product_name=it.product_name, description=it.description,
            quantity=it.quantity, unit=it.unit, unit_price=it.unit_price, tax_rate=it.tax_rate,
            line_total=line_total,
        ))
    db.commit()
    db.refresh(quotation)
    return schemas.QuotationDetailOut(**_quotation_out(quotation).model_dump(), notes=quotation.notes, items=quotation.items)


@router.get("/quotations/{quotation_id}", response_model=schemas.QuotationDetailOut)
def get_quotation(
    quotation_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Quotation).filter(
        models.Quotation.id == quotation_id, models.Quotation.company_id == current_user.company_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return schemas.QuotationDetailOut(**_quotation_out(q).model_dump(), notes=q.notes, items=q.items)


@router.put("/quotations/{quotation_id}", response_model=schemas.QuotationDetailOut)
def update_quotation(
    quotation_id: int,
    payload: schemas.QuotationUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Quotation).filter(
        models.Quotation.id == quotation_id, models.Quotation.company_id == current_user.company_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")

    if payload.items is not None:
        for existing in list(q.items):
            db.delete(existing)
        subtotal, tax_amount, total, rows = _calc_line_items(payload.items)
        q.subtotal, q.tax_amount, q.total_amount = subtotal, tax_amount, total
        db.flush()
        for it, line_total in rows:
            db.add(models.QuotationItem(
                quotation_id=q.id, product_name=it.product_name, description=it.description,
                quantity=it.quantity, unit=it.unit, unit_price=it.unit_price, tax_rate=it.tax_rate,
                line_total=line_total,
            ))

    if payload.status is not None:
        q.status = payload.status
    if payload.valid_until is not None:
        q.valid_until = payload.valid_until
    if payload.notes is not None:
        q.notes = payload.notes

    db.commit()
    db.refresh(q)
    return schemas.QuotationDetailOut(**_quotation_out(q).model_dump(), notes=q.notes, items=q.items)


@router.post("/quotations/{quotation_id}/convert-to-order", response_model=schemas.SalesOrderDetailOut)
def convert_quotation_to_order(
    quotation_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Quotation).filter(
        models.Quotation.id == quotation_id, models.Quotation.company_id == current_user.company_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")

    order = models.SalesOrder(
        company_id=current_user.company_id,
        branch_id=q.branch_id,
        order_number=_next_document_number(db, current_user.company_id, models.SalesOrder, "order_number", "SO"),
        customer_id=q.customer_id,
        quotation_id=q.id,
        order_date=date.today(),
        subtotal=q.subtotal, tax_amount=q.tax_amount, total_amount=q.total_amount,
        notes=q.notes,
        created_by_user_id=current_user.id,
    )
    db.add(order)
    db.flush()
    for item in q.items:
        db.add(models.SalesOrderItem(
            sales_order_id=order.id, product_name=item.product_name, description=item.description,
            quantity=item.quantity, unit=item.unit, unit_price=item.unit_price,
            tax_rate=item.tax_rate, line_total=item.line_total,
        ))
    q.status = "accepted"
    db.commit()
    db.refresh(order)
    return schemas.SalesOrderDetailOut(**_order_out(order).model_dump(), notes=order.notes, items=order.items)


@router.delete("/quotations/{quotation_id}", status_code=204)
def delete_quotation(
    quotation_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Quotation).filter(
        models.Quotation.id == quotation_id, models.Quotation.company_id == current_user.company_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    db.delete(q)
    db.commit()
    return None


# ============================================================
# SALES ORDERS
# ============================================================
@router.get("/orders", response_model=list[schemas.SalesOrderOut])
def list_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.SalesOrder).filter(models.SalesOrder.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        query = query.filter(models.SalesOrder.status == status_filter.lower())
    if customer_id:
        query = query.filter(models.SalesOrder.customer_id == customer_id)
    orders = query.order_by(models.SalesOrder.id.desc()).all()
    return [_order_out(o) for o in orders]


@router.post("/orders", response_model=schemas.SalesOrderDetailOut, status_code=201)
def create_order(
    payload: schemas.SalesOrderCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_customer_or_404(db, current_user.company_id, payload.customer_id)
    if not payload.items:
        raise HTTPException(status_code=400, detail="A sales order needs at least one line item")

    subtotal, tax_amount, total, rows = _calc_line_items(payload.items)
    order = models.SalesOrder(
        company_id=current_user.company_id,
        branch_id=payload.branch_id,
        order_number=_next_document_number(db, current_user.company_id, models.SalesOrder, "order_number", "SO"),
        customer_id=payload.customer_id,
        quotation_id=payload.quotation_id,
        order_date=payload.order_date,
        expected_delivery_date=payload.expected_delivery_date,
        notes=payload.notes,
        subtotal=subtotal, tax_amount=tax_amount, total_amount=total,
        created_by_user_id=current_user.id,
    )
    db.add(order)
    db.flush()
    for it, line_total in rows:
        db.add(models.SalesOrderItem(
            sales_order_id=order.id, product_name=it.product_name, description=it.description,
            quantity=it.quantity, unit=it.unit, unit_price=it.unit_price, tax_rate=it.tax_rate,
            line_total=line_total,
        ))
    db.commit()
    db.refresh(order)
    return schemas.SalesOrderDetailOut(**_order_out(order).model_dump(), notes=order.notes, items=order.items)


@router.get("/orders/{order_id}", response_model=schemas.SalesOrderDetailOut)
def get_order(
    order_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    o = db.query(models.SalesOrder).filter(
        models.SalesOrder.id == order_id, models.SalesOrder.company_id == current_user.company_id
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return schemas.SalesOrderDetailOut(**_order_out(o).model_dump(), notes=o.notes, items=o.items)


@router.put("/orders/{order_id}", response_model=schemas.SalesOrderDetailOut)
def update_order(
    order_id: int,
    payload: schemas.SalesOrderUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    o = db.query(models.SalesOrder).filter(
        models.SalesOrder.id == order_id, models.SalesOrder.company_id == current_user.company_id
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")

    if payload.items is not None:
        for existing in list(o.items):
            db.delete(existing)
        subtotal, tax_amount, total, rows = _calc_line_items(payload.items)
        o.subtotal, o.tax_amount, o.total_amount = subtotal, tax_amount, total
        db.flush()
        for it, line_total in rows:
            db.add(models.SalesOrderItem(
                sales_order_id=o.id, product_name=it.product_name, description=it.description,
                quantity=it.quantity, unit=it.unit, unit_price=it.unit_price, tax_rate=it.tax_rate,
                line_total=line_total,
            ))

    if payload.status is not None:
        o.status = payload.status
    if payload.expected_delivery_date is not None:
        o.expected_delivery_date = payload.expected_delivery_date
    if payload.notes is not None:
        o.notes = payload.notes

    db.commit()
    db.refresh(o)
    return schemas.SalesOrderDetailOut(**_order_out(o).model_dump(), notes=o.notes, items=o.items)


@router.delete("/orders/{order_id}", status_code=204)
def delete_order(
    order_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    o = db.query(models.SalesOrder).filter(
        models.SalesOrder.id == order_id, models.SalesOrder.company_id == current_user.company_id
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    db.delete(o)
    db.commit()
    return None


# ============================================================
# INVOICES
# ============================================================
def _refresh_invoice_status(inv: models.Invoice):
    if inv.status == "cancelled":
        return
    if inv.amount_paid <= 0:
        inv.status = "overdue" if inv.due_date and inv.due_date < date.today() else inv.status
    elif inv.amount_paid >= inv.total_amount:
        inv.status = "paid"
    else:
        inv.status = "partially_paid"


@router.get("/invoices", response_model=list[schemas.InvoiceOut])
def list_invoices(
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Invoice).filter(models.Invoice.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        query = query.filter(models.Invoice.status == status_filter.lower())
    if customer_id:
        query = query.filter(models.Invoice.customer_id == customer_id)
    invoices = query.order_by(models.Invoice.id.desc()).all()
    return [_invoice_out(i) for i in invoices]


@router.post("/invoices", response_model=schemas.InvoiceDetailOut, status_code=201)
def create_invoice(
    payload: schemas.InvoiceCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_customer_or_404(db, current_user.company_id, payload.customer_id)
    if not payload.items:
        raise HTTPException(status_code=400, detail="An invoice needs at least one line item")

    subtotal, tax_amount, total, rows = _calc_line_items(payload.items)
    invoice = models.Invoice(
        company_id=current_user.company_id,
        branch_id=payload.branch_id,
        invoice_number=_next_document_number(db, current_user.company_id, models.Invoice, "invoice_number", "INV"),
        customer_id=payload.customer_id,
        sales_order_id=payload.sales_order_id,
        invoice_date=payload.invoice_date,
        due_date=payload.due_date,
        notes=payload.notes,
        subtotal=subtotal, tax_amount=tax_amount, total_amount=total,
        created_by_user_id=current_user.id,
    )
    db.add(invoice)
    db.flush()
    for it, line_total in rows:
        db.add(models.InvoiceItem(
            invoice_id=invoice.id, product_name=it.product_name, description=it.description,
            quantity=it.quantity, unit=it.unit, unit_price=it.unit_price, tax_rate=it.tax_rate,
            line_total=line_total,
        ))

    # Auto-post a balanced journal entry (Debit Accounts Receivable / Credit Sales
    # Revenue) so this invoice actually shows up in Finance's P&L report, which only
    # reads posted journal entries. Without this, Sales revenue would never appear in
    # P&L no matter how many invoices are created. Skips gracefully if the company's
    # chart of accounts doesn't have suitable accounts configured yet.
    ar_account = (
        db.query(models.ChartOfAccount)
        .filter(
            models.ChartOfAccount.company_id == current_user.company_id,
            models.ChartOfAccount.account_type == "asset",
            models.ChartOfAccount.account_name.ilike("%receivable%"),
        )
        .first()
    )
    revenue_account = (
        db.query(models.ChartOfAccount)
        .filter(
            models.ChartOfAccount.company_id == current_user.company_id,
            models.ChartOfAccount.account_type == "income",
        )
        .order_by(models.ChartOfAccount.account_code)
        .first()
    )
    if ar_account and revenue_account:
        entry_number = _next_document_number(db, current_user.company_id, models.JournalEntry, "entry_number", "JE")
        je = models.JournalEntry(
            company_id=current_user.company_id, branch_id=payload.branch_id, entry_number=entry_number,
            entry_date=payload.invoice_date, reference=invoice.invoice_number,
            narration=f"Sales invoice {invoice.invoice_number}",
            status="posted", total_debit=total, total_credit=total,
            source_type="sales_invoice", source_id=invoice.id,
            posted_at=sqlfunc.now(), created_by_user_id=current_user.id,
        )
        db.add(je)
        db.flush()
        db.add(models.JournalEntryLine(
            journal_entry_id=je.id, account_id=ar_account.id, debit_amount=total, credit_amount=0,
            description=f"Invoice {invoice.invoice_number}",
        ))
        db.add(models.JournalEntryLine(
            journal_entry_id=je.id, account_id=revenue_account.id, debit_amount=0, credit_amount=total,
            description=f"Invoice {invoice.invoice_number}",
        ))

    db.commit()
    db.refresh(invoice)
    out = _invoice_out(invoice)
    return schemas.InvoiceDetailOut(**out.model_dump(), notes=invoice.notes, items=invoice.items, payments=invoice.payments)


@router.get("/invoices/{invoice_id}", response_model=schemas.InvoiceDetailOut)
def get_invoice(
    invoice_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id, models.Invoice.company_id == current_user.company_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    out = _invoice_out(inv)
    return schemas.InvoiceDetailOut(**out.model_dump(), notes=inv.notes, items=inv.items, payments=inv.payments)


@router.put("/invoices/{invoice_id}", response_model=schemas.InvoiceDetailOut)
def update_invoice(
    invoice_id: int,
    payload: schemas.InvoiceUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id, models.Invoice.company_id == current_user.company_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if payload.items is not None:
        for existing in list(inv.items):
            db.delete(existing)
        subtotal, tax_amount, total, rows = _calc_line_items(payload.items)
        inv.subtotal, inv.tax_amount, inv.total_amount = subtotal, tax_amount, total
        db.flush()
        for it, line_total in rows:
            db.add(models.InvoiceItem(
                invoice_id=inv.id, product_name=it.product_name, description=it.description,
                quantity=it.quantity, unit=it.unit, unit_price=it.unit_price, tax_rate=it.tax_rate,
                line_total=line_total,
            ))

    if payload.status is not None:
        inv.status = payload.status
    if payload.due_date is not None:
        inv.due_date = payload.due_date
    if payload.notes is not None:
        inv.notes = payload.notes

    db.commit()
    db.refresh(inv)
    out = _invoice_out(inv)
    return schemas.InvoiceDetailOut(**out.model_dump(), notes=inv.notes, items=inv.items, payments=inv.payments)


@router.post("/invoices/{invoice_id}/payments", response_model=schemas.InvoiceDetailOut, status_code=201)
def record_payment(
    invoice_id: int,
    payload: schemas.InvoicePaymentRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id, models.Invoice.company_id == current_user.company_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")
    remaining = inv.total_amount - inv.amount_paid
    if payload.amount > remaining:
        raise HTTPException(status_code=400, detail=f"Payment exceeds the outstanding balance of {remaining}")

    payment = models.InvoicePayment(
        invoice_id=inv.id, amount=payload.amount, payment_date=payload.payment_date,
        payment_method=payload.payment_method, reference_number=payload.reference_number,
        notes=payload.notes,
    )
    db.add(payment)
    inv.amount_paid = inv.amount_paid + payload.amount
    _refresh_invoice_status(inv)
    db.commit()
    db.refresh(inv)
    out = _invoice_out(inv)
    return schemas.InvoiceDetailOut(**out.model_dump(), notes=inv.notes, items=inv.items, payments=inv.payments)


@router.delete("/invoices/{invoice_id}", status_code=204)
def delete_invoice(
    invoice_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id, models.Invoice.company_id == current_user.company_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.amount_paid > 0:
        raise HTTPException(status_code=400, detail="Cannot delete an invoice that has recorded payments")
    db.delete(inv)
    db.commit()
    return None


# ============================================================
# PIPELINE SUMMARY (module dashboard strip)
# ============================================================
@router.get("/pipeline-summary", response_model=schemas.SalesPipelineSummaryOut)
def pipeline_summary(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    open_leads = db.query(models.Lead).filter(
        models.Lead.company_id == company_id, models.Lead.status.notin_(["won", "lost"])
    ).count()
    pipeline_value = db.query(sqlfunc.coalesce(sqlfunc.sum(models.Lead.estimated_value), 0)).filter(
        models.Lead.company_id == company_id, models.Lead.status.notin_(["won", "lost"])
    ).scalar() or Decimal("0")
    quotations_pending = db.query(models.Quotation).filter(
        models.Quotation.company_id == company_id, models.Quotation.status.in_(["draft", "sent"])
    ).count()
    orders_in_progress = db.query(models.SalesOrder).filter(
        models.SalesOrder.company_id == company_id,
        models.SalesOrder.status.notin_(["completed", "cancelled"]),
    ).count()
    invoices_outstanding = db.query(
        sqlfunc.coalesce(sqlfunc.sum(models.Invoice.total_amount - models.Invoice.amount_paid), 0)
    ).filter(
        models.Invoice.company_id == company_id, models.Invoice.status.notin_(["paid", "cancelled"]),
    ).scalar() or Decimal("0")

    return schemas.SalesPipelineSummaryOut(
        open_leads=open_leads, pipeline_value=pipeline_value,
        quotations_pending=quotations_pending, orders_in_progress=orders_in_progress,
        invoices_outstanding=invoices_outstanding,
    )
