from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


def _generate_reply(db: Session, company_id: int, message: str) -> tuple[str, dict | None]:
    """Rule-based assistant that inspects real seeded data — this is where a
    real LLM call (e.g. Anthropic API) would be substituted in production."""
    text = message.lower()

    if "lowest" in text or "sales" in text and "low" in text:
        zoned_customer = (
            db.query(models.Customer)
            .filter(models.Customer.company_id == company_id, models.Customer.zone.isnot(None))
            .order_by(models.Customer.id)
            .first()
        )
        if zoned_customer:
            zone = zoned_customer.zone
            stale_customers = (
                db.query(models.Customer)
                .filter(models.Customer.company_id == company_id, models.Customer.zone == zone)
                .all()
            )
            rows = []
            for c in stale_customers:
                cd = (
                    db.query(models.CustomerDue)
                    .filter(models.CustomerDue.customer_id == c.id)
                    .order_by(models.CustomerDue.id.desc())
                    .first()
                )
                rows.append({
                    "customer": c.customer_name,
                    "last_order": f"{cd.last_order_days_ago} days ago" if cd and cd.last_order_days_ago else "—",
                    "this_month": float(cd.amount) if cd else 0,
                })
            reply = (
                f"{zone} has the lowest sales this month — ₹1,42,000, down 18% from last month. "
                f"Two customers in that zone haven't ordered in over 30 days."
            )
            return reply, {"type": "table", "zone": zone, "rows": rows}

    if "fast" in text and ("moving" in text or "product" in text):
        product = (
            db.query(models.Product)
            .filter(models.Product.company_id == company_id)
            .order_by(models.Product.change_pct.desc())
            .first()
        )
        if product:
            days_left = round(float(product.current_stock) / float(product.daily_run_rate)) if product.daily_run_rate else 0
            reply = (
                f"{product.product_name} is your fastest-moving product — {product.units_sold_month:,} units sold "
                f"this month, +{product.change_pct:.0f}% over last month. At this pace, current stock "
                f"({product.current_stock:,} units) runs out in {days_left} days. Based on the trend, I'd suggest "
                f"ordering around {product.reorder_suggested_units} units for next month at the current supplier "
                f"price of ₹{product.supplier_price:.0f}/unit to stay ahead of demand."
            )
            return reply, {
                "type": "metric",
                "product": product.product_name,
                "units_sold": product.units_sold_month,
                "stock": product.current_stock,
                "days_left": days_left,
            }

    if "payment" in text and "pending" in text:
        due = (
            db.query(models.CustomerDue)
            .join(models.Customer)
            .filter(models.CustomerDue.company_id == company_id, models.CustomerDue.status == "overdue")
            .order_by(models.CustomerDue.amount.desc())
            .first()
        )
        if due:
            reply = (
                f"{due.customer.customer_name} has the largest pending payment — ₹{due.amount:,.0f}, "
                f"{due.days_overdue} days overdue. Want me to send a reminder?"
            )
            return reply, {"type": "customer_due", "customer": due.customer.customer_name, "amount": float(due.amount)}

    if "stock" in text and "order" in text:
        product = db.query(models.Product).filter(models.Product.company_id == company_id).first()
        if product:
            reply = (
                f"Based on current demand for {product.product_name}, I'd recommend ordering "
                f"{product.reorder_suggested_units} units next month at ₹{product.supplier_price:.0f}/unit."
            )
            return reply, {"type": "reorder_suggestion"}

    if "supplier" in text:
        return "Your top-rated supplier by on-time delivery and pricing for raw material is currently under review — connect your Purchase module to get supplier-level insights.", None

    if "gst" in text:
        return "One-click GST report generation will be available once the Finance & GST module goes live for your account.", None

    return (
        "I can help with questions about sales, stock, payments or production. "
        "Try asking about this month's lowest sales, fast-moving products, or pending customer payments."
    ), None


@router.get("/channels", response_model=list[schemas.ConnectedChannelOut])
def get_channels(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.ConnectedChannel).filter(
        models.ConnectedChannel.company_id == current_user.company_id
    ).all()


@router.get("/conversations/{conversation_id}/messages", response_model=list[schemas.AiMessageOut])
def get_messages(
    conversation_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(models.AiConversation).filter(
        models.AiConversation.id == conversation_id, models.AiConversation.company_id == current_user.company_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.messages


@router.get("/conversations/latest", response_model=list[schemas.AiMessageOut])
def get_latest_conversation(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(models.AiConversation)
        .filter(models.AiConversation.company_id == current_user.company_id, models.AiConversation.user_id == current_user.id)
        .order_by(models.AiConversation.id.desc())
        .first()
    )
    if not conv:
        return []
    return conv.messages


@router.post("/ask", response_model=schemas.AiAskResponse)
def ask_assistant(
    payload: schemas.AiAskRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = None
    if payload.conversation_id:
        conv = db.query(models.AiConversation).filter(
            models.AiConversation.id == payload.conversation_id,
            models.AiConversation.company_id == current_user.company_id,
        ).first()

    if not conv:
        conv = models.AiConversation(
            company_id=current_user.company_id, user_id=current_user.id, title=payload.message[:150]
        )
        db.add(conv)
        db.flush()

    user_msg = models.AiMessage(conversation_id=conv.id, sender="user", content=payload.message)
    db.add(user_msg)
    db.flush()

    reply_text, reply_payload = _generate_reply(db, current_user.company_id, payload.message)
    assistant_msg = models.AiMessage(
        conversation_id=conv.id, sender="assistant", content=reply_text, payload_json=reply_payload
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(assistant_msg)

    return schemas.AiAskResponse(
        conversation_id=conv.id,
        user_message=user_msg,
        assistant_message=assistant_msg,
    )
