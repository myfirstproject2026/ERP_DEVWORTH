from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/service-desk", tags=["Service Desk"])


def _next_ticket_number(db: Session, company_id: int) -> str:
    count = db.query(models.Ticket).filter(models.Ticket.company_id == company_id).count()
    return f"TKT-{count + 1:05d}"


def _breach_flags(ticket: models.Ticket) -> tuple[bool, bool]:
    now = datetime.utcnow()
    response_breached = bool(
        ticket.response_due_at
        and not ticket.first_responded_at
        and now > ticket.response_due_at
    )
    resolution_breached = bool(
        ticket.resolution_due_at
        and ticket.status not in ("resolved", "closed")
        and now > ticket.resolution_due_at
    )
    return response_breached, resolution_breached


def _ticket_out(ticket: models.Ticket) -> schemas.TicketOut:
    response_breached, resolution_breached = _breach_flags(ticket)
    return schemas.TicketOut(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        branch_id=ticket.branch_id,
        branch_name=ticket.branch.branch_name if ticket.branch else "",
        customer_id=ticket.customer_id,
        customer_name=ticket.customer.customer_name if ticket.customer else None,
        category_id=ticket.category_id,
        category_name=ticket.category.name if ticket.category else None,
        subject=ticket.subject,
        priority=ticket.priority,
        status=ticket.status,
        assigned_to_user_id=ticket.assigned_to_user_id,
        assignee_name=ticket.assignee.full_name if ticket.assignee else None,
        response_due_at=ticket.response_due_at,
        resolution_due_at=ticket.resolution_due_at,
        is_response_breached=response_breached,
        is_resolution_breached=resolution_breached,
        created_at=ticket.created_at,
    )


def _ticket_detail_out(ticket: models.Ticket) -> schemas.TicketDetailOut:
    base = _ticket_out(ticket)
    comments = [
        schemas.TicketCommentOut(
            id=c.id, user_id=c.user_id, user_name=c.user.full_name if c.user else None,
            message=c.message, is_internal=c.is_internal, created_at=c.created_at,
        )
        for c in ticket.comments
    ]
    return schemas.TicketDetailOut(
        **base.model_dump(), description=ticket.description,
        first_responded_at=ticket.first_responded_at, resolved_at=ticket.resolved_at,
        closed_at=ticket.closed_at, comments=comments,
    )


# ============================================================
# OVERVIEW
# ============================================================
@router.get("/overview", response_model=schemas.ServiceDeskOverviewOut)
def get_overview(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    company_id = current_user.company_id
    open_statuses = ("open", "in_progress", "on_hold")

    open_tickets = db.query(models.Ticket).filter(
        models.Ticket.company_id == company_id, models.Ticket.status.in_(open_statuses)
    ).count()
    urgent_tickets = db.query(models.Ticket).filter(
        models.Ticket.company_id == company_id, models.Ticket.status.in_(open_statuses),
        models.Ticket.priority == "urgent",
    ).count()

    open_tickets_for_breach = db.query(models.Ticket).filter(
        models.Ticket.company_id == company_id, models.Ticket.status.in_(open_statuses),
    ).all()
    breached = sum(1 for t in open_tickets_for_breach if any(_breach_flags(t)))

    month_start = date.today().replace(day=1)
    resolved_this_month = db.query(models.Ticket).filter(
        models.Ticket.company_id == company_id,
        models.Ticket.resolved_at.isnot(None),
        models.Ticket.resolved_at >= month_start,
    ).count()

    return schemas.ServiceDeskOverviewOut(
        open_tickets=open_tickets, urgent_tickets=urgent_tickets,
        breached_sla=breached, resolved_this_month=resolved_this_month,
    )


# ============================================================
# CATEGORIES
# ============================================================
@router.get("/categories", response_model=list[schemas.TicketCategoryOut])
def list_categories(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    cats = db.query(models.TicketCategory).filter(
        models.TicketCategory.company_id == current_user.company_id
    ).order_by(models.TicketCategory.name).all()
    result = []
    for c in cats:
        open_count = db.query(models.Ticket).filter(
            models.Ticket.category_id == c.id,
            models.Ticket.status.in_(("open", "in_progress", "on_hold")),
        ).count()
        result.append(schemas.TicketCategoryOut(
            id=c.id, name=c.name, description=c.description, is_active=c.is_active,
            open_ticket_count=open_count,
        ))
    return result


@router.post("/categories", response_model=schemas.TicketCategoryOut, status_code=201)
def create_category(
    payload: schemas.TicketCategoryCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.TicketCategory).filter(
        models.TicketCategory.company_id == current_user.company_id,
        models.TicketCategory.name == payload.name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A category with this name already exists")
    cat = models.TicketCategory(company_id=current_user.company_id, name=payload.name, description=payload.description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return schemas.TicketCategoryOut(id=cat.id, name=cat.name, description=cat.description, is_active=cat.is_active, open_ticket_count=0)


# ============================================================
# SLA POLICIES
# ============================================================
@router.get("/sla-policies", response_model=list[schemas.SlaPolicyOut])
def list_sla_policies(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.SlaPolicy).filter(
        models.SlaPolicy.company_id == current_user.company_id
    ).order_by(models.SlaPolicy.id).all()


@router.post("/sla-policies", response_model=schemas.SlaPolicyOut, status_code=201)
def upsert_sla_policy(
    payload: schemas.SlaPolicyCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.SlaPolicy).filter(
        models.SlaPolicy.company_id == current_user.company_id,
        models.SlaPolicy.priority == payload.priority,
    ).first()
    if existing:
        existing.response_hours = payload.response_hours
        existing.resolution_hours = payload.resolution_hours
        db.commit()
        db.refresh(existing)
        return existing

    policy = models.SlaPolicy(
        company_id=current_user.company_id, priority=payload.priority,
        response_hours=payload.response_hours, resolution_hours=payload.resolution_hours,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


# ============================================================
# TICKETS
# ============================================================
@router.get("/tickets", response_model=list[schemas.TicketOut])
def list_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    assigned_to_user_id: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Ticket).filter(models.Ticket.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        q = q.filter(models.Ticket.status == status_filter)
    if priority and priority != "All":
        q = q.filter(models.Ticket.priority == priority)
    if assigned_to_user_id:
        q = q.filter(models.Ticket.assigned_to_user_id == assigned_to_user_id)
    if category_id:
        q = q.filter(models.Ticket.category_id == category_id)
    if search:
        q = q.filter(
            (models.Ticket.subject.ilike(f"%{search}%")) | (models.Ticket.ticket_number.ilike(f"%{search}%"))
        )
    tickets = q.order_by(models.Ticket.id.desc()).all()
    return [_ticket_out(t) for t in tickets]


@router.get("/tickets/stats", response_model=schemas.TicketStatsOut)
def ticket_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    company_id = current_user.company_id
    open_statuses = ("open", "in_progress", "on_hold")

    total_open = db.query(models.Ticket).filter(
        models.Ticket.company_id == company_id, models.Ticket.status.in_(open_statuses)
    ).count()
    unassigned = db.query(models.Ticket).filter(
        models.Ticket.company_id == company_id, models.Ticket.status.in_(open_statuses),
        models.Ticket.assigned_to_user_id.is_(None),
    ).count()

    open_tickets_for_breach = db.query(models.Ticket).filter(
        models.Ticket.company_id == company_id, models.Ticket.status.in_(open_statuses),
    ).all()
    breached = sum(1 for t in open_tickets_for_breach if any(_breach_flags(t)))

    month_start = date.today().replace(day=1)
    resolved_tickets = db.query(models.Ticket).filter(
        models.Ticket.company_id == company_id,
        models.Ticket.resolved_at.isnot(None),
        models.Ticket.resolved_at >= month_start,
    ).all()
    resolved_this_month = len(resolved_tickets)
    if resolved_tickets:
        total_hours = sum(
            (t.resolved_at - t.created_at).total_seconds() / 3600 for t in resolved_tickets
        )
        avg_hours = round(total_hours / len(resolved_tickets), 1)
    else:
        avg_hours = None

    return schemas.TicketStatsOut(
        total_open=total_open, unassigned=unassigned, breached_sla=breached,
        resolved_this_month=resolved_this_month, avg_resolution_hours=avg_hours,
    )


@router.post("/tickets", response_model=schemas.TicketDetailOut, status_code=201)
def create_ticket(
    payload: schemas.TicketCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.customer_id:
        customer = db.query(models.Customer).filter(
            models.Customer.id == payload.customer_id, models.Customer.company_id == current_user.company_id
        ).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

    branch = db.query(models.Branch).filter(
        models.Branch.id == payload.branch_id, models.Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    sla = db.query(models.SlaPolicy).filter(
        models.SlaPolicy.company_id == current_user.company_id,
        models.SlaPolicy.priority == payload.priority,
    ).first()

    now = datetime.utcnow()
    response_due = now + timedelta(hours=sla.response_hours) if sla else None
    resolution_due = now + timedelta(hours=sla.resolution_hours) if sla else None

    ticket = models.Ticket(
        company_id=current_user.company_id, branch_id=payload.branch_id,
        ticket_number=_next_ticket_number(db, current_user.company_id),
        customer_id=payload.customer_id, category_id=payload.category_id,
        sla_policy_id=sla.id if sla else None,
        subject=payload.subject, description=payload.description, priority=payload.priority,
        assigned_to_user_id=payload.assigned_to_user_id,
        response_due_at=response_due, resolution_due_at=resolution_due,
        created_by_user_id=current_user.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _ticket_detail_out(ticket)


@router.get("/tickets/{ticket_id}", response_model=schemas.TicketDetailOut)
def get_ticket(ticket_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(
        models.Ticket.id == ticket_id, models.Ticket.company_id == current_user.company_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _ticket_detail_out(ticket)


@router.put("/tickets/{ticket_id}", response_model=schemas.TicketDetailOut)
def update_ticket(
    ticket_id: int,
    payload: schemas.TicketUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(
        models.Ticket.id == ticket_id, models.Ticket.company_id == current_user.company_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update_data = payload.model_dump(exclude_unset=True)
    priority_changed = "priority" in update_data and update_data["priority"] != ticket.priority
    for field, value in update_data.items():
        setattr(ticket, field, value)

    if priority_changed:
        sla = db.query(models.SlaPolicy).filter(
            models.SlaPolicy.company_id == current_user.company_id,
            models.SlaPolicy.priority == ticket.priority,
        ).first()
        if sla:
            ticket.sla_policy_id = sla.id
            if not ticket.first_responded_at:
                ticket.response_due_at = ticket.created_at + timedelta(hours=sla.response_hours)
            if ticket.status not in ("resolved", "closed"):
                ticket.resolution_due_at = ticket.created_at + timedelta(hours=sla.resolution_hours)

    db.commit()
    db.refresh(ticket)
    return _ticket_detail_out(ticket)


@router.put("/tickets/{ticket_id}/status", response_model=schemas.TicketDetailOut)
def update_ticket_status(
    ticket_id: int,
    payload: schemas.TicketStatusUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(
        models.Ticket.id == ticket_id, models.Ticket.company_id == current_user.company_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    valid_statuses = ("open", "in_progress", "on_hold", "resolved", "closed")
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    now = datetime.utcnow()
    ticket.status = payload.status
    if payload.status == "resolved" and not ticket.resolved_at:
        ticket.resolved_at = now
    if payload.status == "closed" and not ticket.closed_at:
        ticket.closed_at = now
        if not ticket.resolved_at:
            ticket.resolved_at = now
    if payload.status in ("open", "in_progress", "on_hold"):
        ticket.resolved_at = None
        ticket.closed_at = None

    db.commit()
    db.refresh(ticket)
    return _ticket_detail_out(ticket)


@router.delete("/tickets/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(
        models.Ticket.id == ticket_id, models.Ticket.company_id == current_user.company_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()
    return None


# ============================================================
# TICKET COMMENTS
# ============================================================
@router.post("/tickets/{ticket_id}/comments", response_model=schemas.TicketCommentOut, status_code=201)
def add_comment(
    ticket_id: int,
    payload: schemas.TicketCommentCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(
        models.Ticket.id == ticket_id, models.Ticket.company_id == current_user.company_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    comment = models.TicketComment(
        ticket_id=ticket.id, user_id=current_user.id, message=payload.message, is_internal=payload.is_internal,
    )
    db.add(comment)

    # A non-internal (customer-facing) reply counts as the first response for SLA purposes.
    if not payload.is_internal and not ticket.first_responded_at:
        ticket.first_responded_at = datetime.utcnow()

    db.commit()
    db.refresh(comment)
    return schemas.TicketCommentOut(
        id=comment.id, user_id=comment.user_id, user_name=current_user.full_name,
        message=comment.message, is_internal=comment.is_internal, created_at=comment.created_at,
    )
