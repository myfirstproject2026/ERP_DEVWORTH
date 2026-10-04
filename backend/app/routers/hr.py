from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, extract

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/hr", tags=["HR & Employee"])


# ============================================================
# Helpers
# ============================================================
def _next_employee_code(db: Session, company_id: int) -> str:
    count = db.query(models.Employee).filter(models.Employee.company_id == company_id).count()
    return f"EMP-{1000 + count + 1}"


def _emp_out(emp: models.Employee) -> schemas.EmployeeOut:
    return schemas.EmployeeOut(
        id=emp.id, employee_code=emp.employee_code, full_name=emp.full_name,
        designation=emp.designation, branch_id=emp.branch_id, branch_name=emp.branch.branch_name,
        department_id=emp.department_id, department_name=emp.department.department_name if emp.department else None,
        employment_type=emp.employment_type, date_of_joining=emp.date_of_joining, status=emp.status,
        reporting_manager_id=emp.reporting_manager_id,
        reporting_manager_name=emp.reporting_manager.full_name if emp.reporting_manager else None,
        phone=emp.phone, personal_email=emp.personal_email,
    )


def _leave_balance_for(db: Session, employee_id: int, company_id: int, year: int) -> list[schemas.LeaveBalanceOut]:
    leave_types = db.query(models.LeaveType).filter(models.LeaveType.company_id == company_id).all()
    result = []
    for lt in leave_types:
        used = (
            db.query(sqlfunc.coalesce(sqlfunc.sum(models.LeaveRequest.total_days), 0))
            .filter(
                models.LeaveRequest.employee_id == employee_id,
                models.LeaveRequest.leave_type_id == lt.id,
                models.LeaveRequest.status == "approved",
                extract("year", models.LeaveRequest.start_date) == year,
            )
            .scalar()
        )
        used = Decimal(used or 0)
        result.append(schemas.LeaveBalanceOut(
            leave_type_id=lt.id, leave_type_name=lt.leave_type_name,
            annual_quota=lt.annual_quota, used_days=used, balance_days=lt.annual_quota - used,
        ))
    return result


def _days_between(start: date, end: date) -> Decimal:
    return Decimal((end - start).days + 1)


def _latest_attendance_date(db: Session, company_id: int):
    """Most recent date, not later than today, with any attendance records for this
    company. Capping at today matters because approving a future-dated leave request
    auto-creates 'on_leave' attendance records for those future dates — without the
    cap, MAX(attendance_date) would pick those up and make today's snapshot reflect
    a future leave instead of what's actually happening today."""
    return (
        db.query(sqlfunc.max(models.AttendanceRecord.attendance_date))
        .filter(
            models.AttendanceRecord.company_id == company_id,
            models.AttendanceRecord.attendance_date <= date.today(),
        )
        .scalar()
    )


# ============================================================
# OVERVIEW
# ============================================================
@router.get("/overview", response_model=schemas.HrOverviewOut)
def get_overview(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    company_id = current_user.company_id
    total = db.query(models.Employee).filter(models.Employee.company_id == company_id).count()
    active = db.query(models.Employee).filter(
        models.Employee.company_id == company_id, models.Employee.status == "active"
    ).count()
    pending_leaves = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.company_id == company_id, models.LeaveRequest.status == "pending"
    ).count()
    today = date.today()
    latest_attendance_date = _latest_attendance_date(db, company_id)
    on_leave_today = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.company_id == company_id,
        models.AttendanceRecord.attendance_date == latest_attendance_date,
        models.AttendanceRecord.status == "on_leave",
    ).count() if latest_attendance_date else 0
    departments = db.query(models.Department).filter(models.Department.company_id == company_id).count()

    return schemas.HrOverviewOut(
        total_employees=total, active_employees=active, pending_leave_requests=pending_leaves,
        on_leave_today=on_leave_today, open_departments=departments,
    )


# ============================================================
# DEPARTMENTS
# ============================================================
@router.get("/departments", response_model=list[schemas.DepartmentOut])
def list_departments(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    depts = db.query(models.Department).filter(models.Department.company_id == current_user.company_id).all()
    result = []
    for d in depts:
        count = db.query(models.Employee).filter(models.Employee.department_id == d.id).count()
        result.append(schemas.DepartmentOut(
            id=d.id, department_name=d.department_name, head_user_id=d.head_user_id,
            head_name=d.head.full_name if d.head else None, employee_count=count,
        ))
    return result


@router.post("/departments", response_model=schemas.DepartmentOut, status_code=201)
def create_department(
    payload: schemas.DepartmentCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.Department).filter(
        models.Department.company_id == current_user.company_id,
        models.Department.department_name == payload.department_name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A department with this name already exists")

    d = models.Department(company_id=current_user.company_id, department_name=payload.department_name,
                           head_user_id=payload.head_user_id)
    db.add(d)
    db.commit()
    db.refresh(d)
    return schemas.DepartmentOut(id=d.id, department_name=d.department_name, head_user_id=d.head_user_id,
                                  head_name=d.head.full_name if d.head else None, employee_count=0)


@router.put("/departments/{dept_id}", response_model=schemas.DepartmentOut)
def update_department(
    dept_id: int, payload: schemas.DepartmentUpdateRequest,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    d = db.query(models.Department).filter(
        models.Department.id == dept_id, models.Department.company_id == current_user.company_id
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Department not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(d, field, value)
    db.commit()
    db.refresh(d)
    count = db.query(models.Employee).filter(models.Employee.department_id == d.id).count()
    return schemas.DepartmentOut(id=d.id, department_name=d.department_name, head_user_id=d.head_user_id,
                                  head_name=d.head.full_name if d.head else None, employee_count=count)


@router.delete("/departments/{dept_id}", status_code=204)
def delete_department(
    dept_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    d = db.query(models.Department).filter(
        models.Department.id == dept_id, models.Department.company_id == current_user.company_id
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Department not found")
    has_employees = db.query(models.Employee).filter(models.Employee.department_id == dept_id).count()
    if has_employees:
        raise HTTPException(status_code=400, detail="Cannot delete a department that still has employees assigned")
    db.delete(d)
    db.commit()
    return None


# ============================================================
# EMPLOYEES
# ============================================================
@router.get("/employees", response_model=list[schemas.EmployeeOut])
def list_employees(
    search: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Employee).filter(models.Employee.company_id == current_user.company_id)
    if search:
        q = q.filter(
            (models.Employee.full_name.ilike(f"%{search}%")) | (models.Employee.employee_code.ilike(f"%{search}%"))
        )
    if department_id:
        q = q.filter(models.Employee.department_id == department_id)
    if branch_id:
        q = q.filter(models.Employee.branch_id == branch_id)
    if status_filter and status_filter != "All":
        q = q.filter(models.Employee.status == status_filter.lower())
    employees = q.order_by(models.Employee.id).all()
    return [_emp_out(e) for e in employees]


@router.get("/employees/stats", response_model=schemas.EmployeeStatsOut)
def employee_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    base = db.query(models.Employee).filter(models.Employee.company_id == current_user.company_id)
    total = base.count()
    active = base.filter(models.Employee.status == "active").count()

    today = date.today()
    latest_attendance_date = _latest_attendance_date(db, current_user.company_id)
    on_leave = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.company_id == current_user.company_id,
        models.AttendanceRecord.attendance_date == latest_attendance_date,
        models.AttendanceRecord.status == "on_leave",
    ).count() if latest_attendance_date else 0

    new_hires = base.filter(
        extract("year", models.Employee.date_of_joining) == today.year,
        extract("month", models.Employee.date_of_joining) == today.month,
    ).count()

    return schemas.EmployeeStatsOut(
        total_employees=total, active_employees=active, on_leave_today=on_leave, new_hires_this_month=new_hires,
    )


@router.post("/employees", response_model=schemas.EmployeeOut, status_code=201)
def create_employee(
    payload: schemas.EmployeeCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    branch = db.query(models.Branch).filter(
        models.Branch.id == payload.branch_id, models.Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    emp = models.Employee(
        company_id=current_user.company_id, user_id=payload.user_id, branch_id=payload.branch_id,
        department_id=payload.department_id, employee_code=_next_employee_code(db, current_user.company_id),
        full_name=payload.full_name, designation=payload.designation, employment_type=payload.employment_type,
        date_of_joining=payload.date_of_joining, date_of_birth=payload.date_of_birth, gender=payload.gender,
        personal_email=payload.personal_email, phone=payload.phone,
        emergency_contact_name=payload.emergency_contact_name, emergency_contact_phone=payload.emergency_contact_phone,
        reporting_manager_id=payload.reporting_manager_id, ctc_annual=payload.ctc_annual,
        bank_account_number=payload.bank_account_number, bank_ifsc=payload.bank_ifsc, pan=payload.pan,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _emp_out(emp)


@router.get("/employees/{employee_id}", response_model=schemas.EmployeeDetailOut)
def get_employee(
    employee_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    base = _emp_out(emp)
    balances = _leave_balance_for(db, emp.id, current_user.company_id, date.today().year)
    return schemas.EmployeeDetailOut(
        **base.model_dump(), date_of_birth=emp.date_of_birth, gender=emp.gender,
        emergency_contact_name=emp.emergency_contact_name, emergency_contact_phone=emp.emergency_contact_phone,
        ctc_annual=emp.ctc_annual, bank_account_number=emp.bank_account_number, bank_ifsc=emp.bank_ifsc,
        pan=emp.pan, exit_date=emp.exit_date, leave_balance_summary=balances,
    )


@router.put("/employees/{employee_id}", response_model=schemas.EmployeeOut)
def update_employee(
    employee_id: int, payload: schemas.EmployeeUpdateRequest,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(emp, field, value)
    db.commit()
    db.refresh(emp)
    return _emp_out(emp)


@router.delete("/employees/{employee_id}", status_code=204)
def delete_employee(
    employee_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(emp)
    db.commit()
    return None


# ============================================================
# LEAVE
# ============================================================
@router.get("/leave-types", response_model=list[schemas.LeaveTypeOut])
def list_leave_types(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.LeaveType).filter(models.LeaveType.company_id == current_user.company_id).all()


@router.post("/leave-types", response_model=schemas.LeaveTypeOut, status_code=201)
def create_leave_type(
    payload: schemas.LeaveTypeCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = payload.leave_type_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Leave type name is required")
    if payload.annual_quota < 0:
        raise HTTPException(status_code=400, detail="Annual quota cannot be negative")
    exists = db.query(models.LeaveType).filter(
        models.LeaveType.company_id == current_user.company_id,
        sqlfunc.lower(models.LeaveType.leave_type_name) == name.lower(),
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="A leave type with this name already exists")
    lt = models.LeaveType(
        company_id=current_user.company_id, leave_type_name=name,
        annual_quota=payload.annual_quota, is_paid=payload.is_paid,
    )
    db.add(lt)
    db.commit()
    db.refresh(lt)
    return lt


def _get_leave_type(db: Session, company_id: int, leave_type_id: int) -> models.LeaveType:
    lt = db.query(models.LeaveType).filter(
        models.LeaveType.id == leave_type_id, models.LeaveType.company_id == company_id
    ).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")
    return lt


@router.put("/leave-types/{leave_type_id}", response_model=schemas.LeaveTypeOut)
def update_leave_type(
    leave_type_id: int,
    payload: schemas.LeaveTypeCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lt = _get_leave_type(db, current_user.company_id, leave_type_id)
    name = payload.leave_type_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Leave type name is required")
    if payload.annual_quota < 0:
        raise HTTPException(status_code=400, detail="Annual quota cannot be negative")
    dup = db.query(models.LeaveType).filter(
        models.LeaveType.company_id == current_user.company_id,
        models.LeaveType.id != lt.id,
        sqlfunc.lower(models.LeaveType.leave_type_name) == name.lower(),
    ).first()
    if dup:
        raise HTTPException(status_code=400, detail="A leave type with this name already exists")
    lt.leave_type_name = name
    lt.annual_quota = payload.annual_quota
    lt.is_paid = payload.is_paid
    db.commit()
    db.refresh(lt)
    return lt


@router.delete("/leave-types/{leave_type_id}", status_code=204)
def delete_leave_type(
    leave_type_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lt = _get_leave_type(db, current_user.company_id, leave_type_id)
    used = db.query(models.LeaveRequest).filter(models.LeaveRequest.leave_type_id == lt.id).count()
    if used:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {used} leave request(s) use this leave type",
        )
    db.delete(lt)
    db.commit()
    return None


@router.get("/leave-requests", response_model=list[schemas.LeaveRequestOut])
def list_leave_requests(
    employee_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.LeaveRequest).filter(models.LeaveRequest.company_id == current_user.company_id)
    if employee_id:
        q = q.filter(models.LeaveRequest.employee_id == employee_id)
    if status_filter and status_filter != "All":
        q = q.filter(models.LeaveRequest.status == status_filter.lower())
    requests = q.order_by(models.LeaveRequest.id.desc()).all()
    return [
        schemas.LeaveRequestOut(
            id=r.id, employee_id=r.employee_id, employee_name=r.employee.full_name,
            leave_type_id=r.leave_type_id, leave_type_name=r.leave_type.leave_type_name,
            start_date=r.start_date, end_date=r.end_date, total_days=r.total_days,
            reason=r.reason, status=r.status, applied_at=r.applied_at,
        )
        for r in requests
    ]


@router.post("/leave-requests", response_model=schemas.LeaveRequestOut, status_code=201)
def create_leave_request(
    payload: schemas.LeaveRequestCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == payload.employee_id, models.Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    leave_type = db.query(models.LeaveType).filter(
        models.LeaveType.id == payload.leave_type_id, models.LeaveType.company_id == current_user.company_id
    ).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date")

    total_days = _days_between(payload.start_date, payload.end_date)

    balances = _leave_balance_for(db, emp.id, current_user.company_id, payload.start_date.year)
    matching = next((b for b in balances if b.leave_type_id == leave_type.id), None)
    if matching and matching.balance_days < total_days:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient {leave_type.leave_type_name} balance: requested {total_days}, "
                   f"only {matching.balance_days} remaining this year",
        )

    lr = models.LeaveRequest(
        company_id=current_user.company_id, employee_id=emp.id, leave_type_id=leave_type.id,
        start_date=payload.start_date, end_date=payload.end_date, total_days=total_days, reason=payload.reason,
    )
    db.add(lr)
    db.commit()
    db.refresh(lr)
    return schemas.LeaveRequestOut(
        id=lr.id, employee_id=lr.employee_id, employee_name=emp.full_name,
        leave_type_id=lr.leave_type_id, leave_type_name=leave_type.leave_type_name,
        start_date=lr.start_date, end_date=lr.end_date, total_days=lr.total_days,
        reason=lr.reason, status=lr.status, applied_at=lr.applied_at,
    )


@router.put("/leave-requests/{request_id}/decision", response_model=schemas.LeaveRequestOut)
def decide_leave_request(
    request_id: int, payload: schemas.LeaveRequestDecisionRequest,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    lr = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.id == request_id, models.LeaveRequest.company_id == current_user.company_id
    ).first()
    if not lr:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if lr.status != "pending":
        raise HTTPException(status_code=400, detail=f"This request has already been {lr.status}")
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    lr.status = payload.status
    lr.approved_by_user_id = current_user.id
    lr.decided_at = datetime.utcnow()

    if payload.status == "approved":
        # Mark the employee's attendance for each day of the leave as on_leave.
        current = lr.start_date
        while current <= lr.end_date:
            existing = db.query(models.AttendanceRecord).filter(
                models.AttendanceRecord.employee_id == lr.employee_id,
                models.AttendanceRecord.attendance_date == current,
            ).first()
            if existing:
                existing.status = "on_leave"
            else:
                db.add(models.AttendanceRecord(
                    company_id=current_user.company_id, employee_id=lr.employee_id,
                    branch_id=lr.employee.branch_id, attendance_date=current, status="on_leave",
                ))
            current += timedelta(days=1)

    db.commit()
    db.refresh(lr)
    return schemas.LeaveRequestOut(
        id=lr.id, employee_id=lr.employee_id, employee_name=lr.employee.full_name,
        leave_type_id=lr.leave_type_id, leave_type_name=lr.leave_type.leave_type_name,
        start_date=lr.start_date, end_date=lr.end_date, total_days=lr.total_days,
        reason=lr.reason, status=lr.status, applied_at=lr.applied_at,
    )


@router.get("/employees/{employee_id}/leave-balance", response_model=list[schemas.LeaveBalanceOut])
def get_leave_balance(
    employee_id: int, year: int = Query(default_factory=lambda: date.today().year),
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _leave_balance_for(db, employee_id, current_user.company_id, year)


# ============================================================
# ATTENDANCE
# ============================================================
@router.get("/attendance", response_model=list[schemas.AttendanceRecordOut])
def list_attendance(
    attendance_date: Optional[date] = Query(None),
    branch_id: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.company_id == current_user.company_id)
    if attendance_date:
        q = q.filter(models.AttendanceRecord.attendance_date == attendance_date)
    if branch_id:
        q = q.filter(models.AttendanceRecord.branch_id == branch_id)
    if employee_id:
        q = q.filter(models.AttendanceRecord.employee_id == employee_id)
    records = q.order_by(models.AttendanceRecord.attendance_date.desc()).all()
    return [
        schemas.AttendanceRecordOut(
            id=r.id, employee_id=r.employee_id, employee_name=r.employee.full_name, branch_id=r.branch_id,
            attendance_date=r.attendance_date, status=r.status,
            check_in_time=r.check_in_time, check_out_time=r.check_out_time,
        )
        for r in records
    ]


@router.get("/attendance/summary", response_model=schemas.AttendanceSummaryOut)
def attendance_summary(
    attendance_date: date = Query(default_factory=date.today),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.company_id == current_user.company_id,
        models.AttendanceRecord.attendance_date == attendance_date,
    ).all()
    present = sum(1 for r in records if r.status == "present")
    absent = sum(1 for r in records if r.status == "absent")
    on_leave = sum(1 for r in records if r.status == "on_leave")
    half_day = sum(1 for r in records if r.status == "half_day")
    total = len(records)
    present_pct = round((present / total) * 100) if total else 0

    return schemas.AttendanceSummaryOut(
        attendance_date=attendance_date, present_count=present, absent_count=absent,
        on_leave_count=on_leave, half_day_count=half_day, present_pct=present_pct,
    )


@router.post("/attendance/bulk-mark", response_model=list[schemas.AttendanceRecordOut])
def bulk_mark_attendance(
    payload: schemas.AttendanceBulkMarkRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = []
    for rec in payload.records:
        emp = db.query(models.Employee).filter(
            models.Employee.id == rec.employee_id, models.Employee.company_id == current_user.company_id
        ).first()
        if not emp:
            raise HTTPException(status_code=404, detail=f"Employee {rec.employee_id} not found")

        existing = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.employee_id == rec.employee_id,
            models.AttendanceRecord.attendance_date == rec.attendance_date,
        ).first()
        if existing:
            existing.status = rec.status
            existing.check_in_time = rec.check_in_time
            existing.check_out_time = rec.check_out_time
            existing.notes = rec.notes
            row = existing
        else:
            row = models.AttendanceRecord(
                company_id=current_user.company_id, employee_id=rec.employee_id, branch_id=payload.branch_id,
                attendance_date=rec.attendance_date, status=rec.status,
                check_in_time=rec.check_in_time, check_out_time=rec.check_out_time, notes=rec.notes,
            )
            db.add(row)
        db.flush()
        results.append(row)

    db.commit()
    return [
        schemas.AttendanceRecordOut(
            id=r.id, employee_id=r.employee_id, employee_name=r.employee.full_name, branch_id=r.branch_id,
            attendance_date=r.attendance_date, status=r.status,
            check_in_time=r.check_in_time, check_out_time=r.check_out_time,
        )
        for r in results
    ]


# ============================================================
# PAYSLIPS
# ============================================================
@router.get("/payslips", response_model=list[schemas.PayslipOut])
def list_payslips(
    employee_id: Optional[int] = Query(None),
    pay_month: Optional[int] = Query(None),
    pay_year: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Payslip).filter(models.Payslip.company_id == current_user.company_id)
    if employee_id:
        q = q.filter(models.Payslip.employee_id == employee_id)
    if pay_month:
        q = q.filter(models.Payslip.pay_month == pay_month)
    if pay_year:
        q = q.filter(models.Payslip.pay_year == pay_year)
    payslips = q.order_by(models.Payslip.pay_year.desc(), models.Payslip.pay_month.desc()).all()
    return [
        schemas.PayslipOut(
            id=p.id, employee_id=p.employee_id, employee_name=p.employee.full_name,
            pay_month=p.pay_month, pay_year=p.pay_year, basic=p.basic, hra=p.hra,
            other_allowances=p.other_allowances, deductions=p.deductions, net_pay=p.net_pay,
            status=p.status, paid_on=p.paid_on,
        )
        for p in payslips
    ]


@router.get("/payslips/{payslip_id}/detail", response_model=schemas.PayslipDetailOut)
def get_payslip_detail(
    payslip_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    p = db.query(models.Payslip).filter(
        models.Payslip.id == payslip_id, models.Payslip.company_id == current_user.company_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payslip not found")
    emp = p.employee

    period_start = date(p.pay_year, p.pay_month, 1)
    period_end = (date(p.pay_year + 1, 1, 1) if p.pay_month == 12 else date(p.pay_year, p.pay_month + 1, 1)) - timedelta(days=1)

    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.employee_id == emp.id,
        models.AttendanceRecord.attendance_date >= period_start,
        models.AttendanceRecord.attendance_date <= period_end,
    ).all()
    count = lambda s: sum(1 for r in records if r.status == s)

    leave_days: dict = {}
    approved = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.employee_id == emp.id,
        models.LeaveRequest.status == "approved",
        models.LeaveRequest.start_date <= period_end,
        models.LeaveRequest.end_date >= period_start,
    ).all()
    for lr in approved:
        days = _days_between(max(lr.start_date, period_start), min(lr.end_date, period_end))
        key = (lr.leave_type.leave_type_name, lr.leave_type.is_paid)
        leave_days[key] = leave_days.get(key, Decimal("0")) + days

    return schemas.PayslipDetailOut(
        id=p.id, employee_id=p.employee_id, employee_name=emp.full_name,
        pay_month=p.pay_month, pay_year=p.pay_year, basic=p.basic, hra=p.hra,
        other_allowances=p.other_allowances, deductions=p.deductions, net_pay=p.net_pay,
        status=p.status, paid_on=p.paid_on,
        employee_code=emp.employee_code, designation=emp.designation,
        department_name=emp.department.department_name if emp.department else None,
        branch_name=emp.branch.branch_name, employment_type=emp.employment_type,
        date_of_joining=emp.date_of_joining, pan=emp.pan,
        bank_account_number=emp.bank_account_number, bank_ifsc=emp.bank_ifsc,
        attendance_recorded=len(records), present_days=count("present"), half_days=count("half_day"),
        absent_days=count("absent"), on_leave_days=count("on_leave"),
        holiday_days=count("holiday"), week_off_days=count("week_off"),
        leave_lines=[
            schemas.PayslipLeaveLine(leave_type_name=n, is_paid=paid, days=d)
            for (n, paid), d in sorted(leave_days.items())
        ],
    )


@router.post("/payslips", response_model=schemas.PayslipOut, status_code=201)
def create_payslip(
    payload: schemas.PayslipCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == payload.employee_id, models.Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = db.query(models.Payslip).filter(
        models.Payslip.employee_id == payload.employee_id,
        models.Payslip.pay_month == payload.pay_month,
        models.Payslip.pay_year == payload.pay_year,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A payslip for this employee and period already exists")

    net_pay = payload.basic + payload.hra + payload.other_allowances - payload.deductions
    p = models.Payslip(
        company_id=current_user.company_id, employee_id=payload.employee_id, pay_month=payload.pay_month,
        pay_year=payload.pay_year, basic=payload.basic, hra=payload.hra,
        other_allowances=payload.other_allowances, deductions=payload.deductions, net_pay=net_pay,
        generated_by_user_id=current_user.id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return schemas.PayslipOut(
        id=p.id, employee_id=p.employee_id, employee_name=emp.full_name, pay_month=p.pay_month,
        pay_year=p.pay_year, basic=p.basic, hra=p.hra, other_allowances=p.other_allowances,
        deductions=p.deductions, net_pay=p.net_pay, status=p.status, paid_on=p.paid_on,
    )


@router.put("/payslips/{payslip_id}/mark-paid", response_model=schemas.PayslipOut)
def mark_payslip_paid(
    payslip_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    p = db.query(models.Payslip).filter(
        models.Payslip.id == payslip_id, models.Payslip.company_id == current_user.company_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payslip not found")
    p.status = "paid"
    p.paid_on = date.today()
    db.commit()
    db.refresh(p)
    return schemas.PayslipOut(
        id=p.id, employee_id=p.employee_id, employee_name=p.employee.full_name, pay_month=p.pay_month,
        pay_year=p.pay_year, basic=p.basic, hra=p.hra, other_allowances=p.other_allowances,
        deductions=p.deductions, net_pay=p.net_pay, status=p.status, paid_on=p.paid_on,
    )
