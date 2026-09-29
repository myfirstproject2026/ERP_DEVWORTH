from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=schemas.DashboardSummaryOut)
def get_summary(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    metric = (
        db.query(models.DailyMetric)
        .filter(models.DailyMetric.company_id == current_user.company_id)
        .order_by(models.DailyMetric.metric_date.desc())
        .first()
    )
    if not metric:
        return schemas.DashboardSummaryOut(
            todays_sales=0, sales_change_pct=0, todays_purchase=0, purchase_change_pct=0,
            pending_payments=0, overdue_invoice_count=0, stock_alert_count=0,
            below_reorder_count=0, ai_insight="No data available yet for this company.",
        )

    lowest_zone_due = (
        db.query(models.CustomerDue)
        .join(models.Customer)
        .filter(models.CustomerDue.company_id == current_user.company_id, models.CustomerDue.status == "overdue")
        .order_by(models.CustomerDue.days_overdue.desc())
        .first()
    )
    top_product = (
        db.query(models.Product)
        .filter(models.Product.company_id == current_user.company_id)
        .order_by(models.Product.change_pct.desc())
        .first()
    )

    insight_parts = []
    if lowest_zone_due:
        insight_parts.append(
            f"Payment pending: {lowest_zone_due.customer.customer_name} — "
            f"₹{lowest_zone_due.amount:,.0f}, {lowest_zone_due.days_overdue} days overdue"
        )
    if top_product:
        insight_parts.append(f"Fast-moving: {top_product.product_name}")
    ai_insight = " · ".join(insight_parts) if insight_parts else "All metrics are within normal range today."

    return schemas.DashboardSummaryOut(
        todays_sales=metric.todays_sales,
        sales_change_pct=metric.sales_change_pct,
        todays_purchase=metric.todays_purchase,
        purchase_change_pct=metric.purchase_change_pct,
        pending_payments=metric.pending_payments,
        overdue_invoice_count=metric.overdue_invoice_count,
        stock_alert_count=metric.stock_alert_count,
        below_reorder_count=metric.below_reorder_count,
        ai_insight=ai_insight,
    )


@router.get("/profit-loss", response_model=list[schemas.ProfitLossPointOut])
def get_profit_loss(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.ProfitLossMonthly)
        .filter(models.ProfitLossMonthly.company_id == current_user.company_id)
        .order_by(models.ProfitLossMonthly.month_order)
        .all()
    )
    return [
        schemas.ProfitLossPointOut(
            month_label=r.month_label, revenue_lakhs=r.revenue_lakhs, net_profit_lakhs=r.net_profit_lakhs
        )
        for r in rows
    ]


@router.get("/production", response_model=list[schemas.ProductionOrderOut])
def get_production(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Prefer live Manufacturing work orders now that the module exists; this keeps the
    # Dashboard in sync with real production activity instead of a static snapshot.
    work_orders = (
        db.query(models.WorkOrder)
        .filter(
            models.WorkOrder.company_id == current_user.company_id,
            models.WorkOrder.status.in_(["scheduled", "in_progress"]),
        )
        .order_by(models.WorkOrder.id.desc())
        .limit(5)
        .all()
    )
    if work_orders:
        return [
            schemas.ProductionOrderOut(
                wo_number=wo.wo_number,
                product_name=wo.product.product_name,
                units=int(wo.quantity_planned),
                stage=wo.current_stage,
                progress_pct=wo.progress_pct,
            )
            for wo in work_orders
        ]

    # Fallback for companies that haven't set up Manufacturing yet.
    orders = (
        db.query(models.ProductionOrder)
        .filter(models.ProductionOrder.company_id == current_user.company_id)
        .order_by(models.ProductionOrder.id)
        .all()
    )
    return orders


@router.get("/attendance", response_model=schemas.AttendanceOut)
def get_attendance(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Prefer live HR attendance records now that the module exists; falls back to the
    # static seed snapshot only for companies that haven't set up HR & Employee yet.
    # We use the most recent date (not later than today) that has any attendance
    # records rather than the literal calendar date, since demo/seed data won't
    # necessarily be dated as today — but we cap at today so that auto-created
    # 'on_leave' records for approved future leave requests don't get picked up as
    # if they were today's attendance.
    latest_date = (
        db.query(func.max(models.AttendanceRecord.attendance_date))
        .filter(
            models.AttendanceRecord.company_id == current_user.company_id,
            models.AttendanceRecord.attendance_date <= date.today(),
        )
        .scalar()
    )
    hr_records = (
        db.query(models.AttendanceRecord)
        .filter(
            models.AttendanceRecord.company_id == current_user.company_id,
            models.AttendanceRecord.attendance_date == latest_date,
        )
        .all()
        if latest_date
        else []
    )
    if hr_records:
        present = sum(1 for r in hr_records if r.status == "present")
        absent = sum(1 for r in hr_records if r.status == "absent")
        on_leave = sum(1 for r in hr_records if r.status in ("on_leave", "half_day"))
        total = len(hr_records)
        present_pct = round((present / total) * 100) if total else 0
        return schemas.AttendanceOut(
            present_count=present, on_leave_count=on_leave, absent_count=absent, present_pct=present_pct,
        )

    row = (
        db.query(models.AttendanceDaily)
        .filter(models.AttendanceDaily.company_id == current_user.company_id)
        .order_by(models.AttendanceDaily.attendance_date.desc())
        .first()
    )
    if not row:
        return schemas.AttendanceOut(present_count=0, on_leave_count=0, absent_count=0, present_pct=0)

    total = row.present_count + row.on_leave_count + row.absent_count
    present_pct = round((row.present_count / total) * 100) if total else 0
    return schemas.AttendanceOut(
        present_count=row.present_count, on_leave_count=row.on_leave_count,
        absent_count=row.absent_count, present_pct=present_pct,
    )


@router.get("/customer-followup", response_model=list[schemas.CustomerFollowUpOut])
def get_customer_followup(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.CustomerDue)
        .join(models.Customer)
        .filter(models.CustomerDue.company_id == current_user.company_id)
        .order_by(models.CustomerDue.id.desc())
        .limit(10)
        .all()
    )
    result = []
    for r in rows:
        result.append(schemas.CustomerFollowUpOut(
            customer_name=r.customer.customer_name,
            customer_type=r.customer.customer_type,
            city=r.customer.city,
            amount=r.amount,
            status=r.status,
            days_overdue=r.days_overdue,
        ))
    return result
