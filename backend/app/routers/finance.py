from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract, func as sqlfunc
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/api/finance", tags=["Finance & GST"])


# ============================================================
# NUMBERING HELPERS
# ============================================================
def _next_number(db: Session, company_id: int, model, field_name: str, prefix: str, pad: int = 5) -> str:
    field = getattr(model, field_name)
    last = (
        db.query(field)
        .filter(model.company_id == company_id, field.like(f"{prefix}-%"))
        .order_by(field.desc())
        .first()
    )
    if last:
        try:
            next_seq = int(last[0].split("-")[-1]) + 1
        except (ValueError, IndexError):
            next_seq = 1
    else:
        next_seq = 1
    return f"{prefix}-{str(next_seq).zfill(pad)}"


# ============================================================
# OVERVIEW
# ============================================================
@router.get("/overview", response_model=schemas.FinanceOverviewOut)
def get_overview(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    company_id = current_user.company_id

    cash_and_bank = (
        db.query(sqlfunc.coalesce(sqlfunc.sum(models.BankAccount.current_balance), 0))
        .filter(models.BankAccount.company_id == company_id, models.BankAccount.status == "active")
        .scalar()
    )

    receivables = (
        db.query(sqlfunc.coalesce(sqlfunc.sum(models.Invoice.total_amount - models.Invoice.amount_paid), 0))
        .filter(models.Invoice.company_id == company_id, models.Invoice.status.notin_(["paid", "cancelled", "draft"]))
        .scalar()
    )

    payables = (
        db.query(sqlfunc.coalesce(sqlfunc.sum(models.PurchaseBill.total_amount - models.PurchaseBill.amount_paid), 0))
        .filter(models.PurchaseBill.company_id == company_id, models.PurchaseBill.status.notin_(["paid", "cancelled", "draft"]))
        .scalar()
    )

    pending_expenses = (
        db.query(models.Expense)
        .filter(models.Expense.company_id == company_id, models.Expense.status == "pending")
        .count()
    )

    unposted = (
        db.query(models.JournalEntry)
        .filter(models.JournalEntry.company_id == company_id, models.JournalEntry.status == "draft")
        .count()
    )

    return schemas.FinanceOverviewOut(
        cash_and_bank_balance=cash_and_bank,
        outstanding_receivables=receivables,
        outstanding_payables=payables,
        pending_expenses=pending_expenses,
        unposted_journal_entries=unposted,
    )


# ============================================================
# CHART OF ACCOUNTS
# ============================================================
@router.get("/accounts", response_model=list[schemas.ChartOfAccountOut])
def list_accounts(
    account_type: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.ChartOfAccount).filter(models.ChartOfAccount.company_id == current_user.company_id)
    if account_type and account_type != "All":
        q = q.filter(models.ChartOfAccount.account_type == account_type)
    return q.order_by(models.ChartOfAccount.account_code).all()


@router.post("/accounts", response_model=schemas.ChartOfAccountOut, status_code=201)
def create_account(
    payload: schemas.ChartOfAccountCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.ChartOfAccount).filter(
        models.ChartOfAccount.company_id == current_user.company_id,
        models.ChartOfAccount.account_code == payload.account_code,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this code already exists")

    acc = models.ChartOfAccount(
        company_id=current_user.company_id, account_code=payload.account_code, account_name=payload.account_name,
        account_type=payload.account_type, parent_account_id=payload.parent_account_id,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.put("/accounts/{account_id}", response_model=schemas.ChartOfAccountOut)
def update_account(
    account_id: int,
    payload: schemas.ChartOfAccountUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acc = db.query(models.ChartOfAccount).filter(
        models.ChartOfAccount.id == account_id, models.ChartOfAccount.company_id == current_user.company_id
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    if acc.is_system:
        raise HTTPException(status_code=400, detail="Cannot modify a system account")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(acc, field, value)
    db.commit()
    db.refresh(acc)
    return acc


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acc = db.query(models.ChartOfAccount).filter(
        models.ChartOfAccount.id == account_id, models.ChartOfAccount.company_id == current_user.company_id
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    if acc.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete a system account")

    used = db.query(models.JournalEntryLine).filter(models.JournalEntryLine.account_id == account_id).count()
    if used:
        raise HTTPException(status_code=400, detail="Cannot delete an account that has journal entries posted to it")

    db.delete(acc)
    db.commit()
    return None


# ============================================================
# BANK ACCOUNTS
# ============================================================
@router.get("/bank-accounts", response_model=list[schemas.BankAccountOut])
def list_bank_accounts(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.BankAccount).filter(
        models.BankAccount.company_id == current_user.company_id
    ).order_by(models.BankAccount.is_primary.desc(), models.BankAccount.id).all()


@router.post("/bank-accounts", response_model=schemas.BankAccountOut, status_code=201)
def create_bank_account(
    payload: schemas.BankAccountCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.is_primary:
        db.query(models.BankAccount).filter(
            models.BankAccount.company_id == current_user.company_id
        ).update({"is_primary": False})

    acc = models.BankAccount(
        company_id=current_user.company_id, account_name=payload.account_name, bank_name=payload.bank_name,
        account_number=payload.account_number, ifsc_code=payload.ifsc_code, account_type=payload.account_type,
        opening_balance=payload.opening_balance, current_balance=payload.opening_balance,
        is_primary=payload.is_primary,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.put("/bank-accounts/{account_id}", response_model=schemas.BankAccountOut)
def update_bank_account(
    account_id: int,
    payload: schemas.BankAccountUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acc = db.query(models.BankAccount).filter(
        models.BankAccount.id == account_id, models.BankAccount.company_id == current_user.company_id
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Bank account not found")

    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("is_primary"):
        db.query(models.BankAccount).filter(
            models.BankAccount.company_id == current_user.company_id
        ).update({"is_primary": False})

    for field, value in update_data.items():
        setattr(acc, field, value)
    db.commit()
    db.refresh(acc)
    return acc


# ============================================================
# JOURNAL ENTRIES
# ============================================================
def _je_out(db: Session, je: models.JournalEntry) -> schemas.JournalEntryOut:
    return schemas.JournalEntryOut(
        id=je.id, entry_number=je.entry_number, branch_id=je.branch_id, branch_name=je.branch.branch_name,
        entry_date=je.entry_date, reference=je.reference, narration=je.narration, status=je.status,
        total_debit=je.total_debit, total_credit=je.total_credit, source_type=je.source_type,
    )


def _je_detail_out(je: models.JournalEntry) -> schemas.JournalEntryDetailOut:
    lines = [
        schemas.JournalLineOut(
            id=l.id, account_id=l.account_id, account_name=l.account.account_name,
            account_code=l.account.account_code, debit_amount=l.debit_amount,
            credit_amount=l.credit_amount, description=l.description,
        )
        for l in je.lines
    ]
    return schemas.JournalEntryDetailOut(
        id=je.id, entry_number=je.entry_number, branch_id=je.branch_id, branch_name=je.branch.branch_name,
        entry_date=je.entry_date, reference=je.reference, narration=je.narration, status=je.status,
        total_debit=je.total_debit, total_credit=je.total_credit, source_type=je.source_type, lines=lines,
    )


@router.get("/journal-entries", response_model=list[schemas.JournalEntryOut])
def list_journal_entries(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.JournalEntry).filter(models.JournalEntry.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        q = q.filter(models.JournalEntry.status == status_filter)
    entries = q.order_by(models.JournalEntry.id.desc()).all()
    return [_je_out(db, e) for e in entries]


@router.post("/journal-entries", response_model=schemas.JournalEntryDetailOut, status_code=201)
def create_journal_entry(
    payload: schemas.JournalEntryCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(payload.lines) < 2:
        raise HTTPException(status_code=400, detail="A journal entry needs at least two lines")

    total_debit = sum(l.debit_amount for l in payload.lines)
    total_credit = sum(l.credit_amount for l in payload.lines)
    if total_debit != total_credit:
        raise HTTPException(
            status_code=400,
            detail=f"Entry is not balanced: total debit {total_debit} does not equal total credit {total_credit}",
        )
    if total_debit == 0:
        raise HTTPException(status_code=400, detail="Entry has no amounts")

    branch = db.query(models.Branch).filter(
        models.Branch.id == payload.branch_id, models.Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    account_ids = {l.account_id for l in payload.lines}
    found_accounts = db.query(models.ChartOfAccount.id).filter(
        models.ChartOfAccount.id.in_(account_ids), models.ChartOfAccount.company_id == current_user.company_id
    ).count()
    if found_accounts != len(account_ids):
        raise HTTPException(status_code=404, detail="One or more accounts were not found")

    entry_number = _next_number(db, current_user.company_id, models.JournalEntry, "entry_number", "JE")
    je = models.JournalEntry(
        company_id=current_user.company_id, branch_id=payload.branch_id, entry_number=entry_number,
        entry_date=payload.entry_date, reference=payload.reference, narration=payload.narration,
        status="draft", total_debit=total_debit, total_credit=total_credit, source_type="manual",
        created_by_user_id=current_user.id,
    )
    db.add(je)
    db.flush()

    for l in payload.lines:
        db.add(models.JournalEntryLine(
            journal_entry_id=je.id, account_id=l.account_id, debit_amount=l.debit_amount,
            credit_amount=l.credit_amount, description=l.description,
        ))
    db.commit()
    db.refresh(je)
    return _je_detail_out(je)


@router.get("/journal-entries/{entry_id}", response_model=schemas.JournalEntryDetailOut)
def get_journal_entry(
    entry_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    je = db.query(models.JournalEntry).filter(
        models.JournalEntry.id == entry_id, models.JournalEntry.company_id == current_user.company_id
    ).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return _je_detail_out(je)


@router.put("/journal-entries/{entry_id}/post", response_model=schemas.JournalEntryOut)
def post_journal_entry(
    entry_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    je = db.query(models.JournalEntry).filter(
        models.JournalEntry.id == entry_id, models.JournalEntry.company_id == current_user.company_id
    ).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if je.status == "posted":
        raise HTTPException(status_code=400, detail="Entry is already posted")

    je.status = "posted"
    je.posted_at = sqlfunc.now()
    db.commit()
    db.refresh(je)
    return _je_out(db, je)


@router.delete("/journal-entries/{entry_id}", status_code=204)
def delete_journal_entry(
    entry_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    je = db.query(models.JournalEntry).filter(
        models.JournalEntry.id == entry_id, models.JournalEntry.company_id == current_user.company_id
    ).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if je.status == "posted":
        raise HTTPException(status_code=400, detail="Cannot delete a posted entry")

    db.delete(je)
    db.commit()
    return None


# ============================================================
# EXPENSES
# ============================================================
def _exp_out(e: models.Expense) -> schemas.ExpenseOut:
    return schemas.ExpenseOut(
        id=e.id, expense_number=e.expense_number, branch_id=e.branch_id, branch_name=e.branch.branch_name,
        expense_date=e.expense_date, category=e.category, account_id=e.account_id,
        account_name=e.account.account_name, vendor_name=e.vendor_name, description=e.description,
        amount=e.amount, tax_rate=e.tax_rate, tax_amount=e.tax_amount, total_amount=e.total_amount,
        payment_method=e.payment_method, status=e.status,
    )


@router.get("/expenses", response_model=list[schemas.ExpenseOut])
def list_expenses(
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Expense).filter(models.Expense.company_id == current_user.company_id)
    if status_filter and status_filter != "All":
        q = q.filter(models.Expense.status == status_filter)
    if category and category != "All":
        q = q.filter(models.Expense.category == category)
    expenses = q.order_by(models.Expense.expense_date.desc(), models.Expense.id.desc()).all()
    return [_exp_out(e) for e in expenses]


@router.get("/expenses/stats", response_model=schemas.ExpenseStatsOut)
def expense_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    base = db.query(models.Expense).filter(models.Expense.company_id == current_user.company_id)

    total_this_month = (
        base.filter(
            extract("year", models.Expense.expense_date) == today.year,
            extract("month", models.Expense.expense_date) == today.month,
        )
        .with_entities(sqlfunc.coalesce(sqlfunc.sum(models.Expense.total_amount), 0))
        .scalar()
    )
    pending_count = base.filter(models.Expense.status == "pending").count()
    paid_this_month = (
        base.filter(
            models.Expense.status == "paid",
            extract("year", models.Expense.expense_date) == today.year,
            extract("month", models.Expense.expense_date) == today.month,
        )
        .with_entities(sqlfunc.coalesce(sqlfunc.sum(models.Expense.total_amount), 0))
        .scalar()
    )
    top_category_row = (
        db.query(models.Expense.category, sqlfunc.sum(models.Expense.total_amount).label("total"))
        .filter(models.Expense.company_id == current_user.company_id)
        .group_by(models.Expense.category)
        .order_by(sqlfunc.sum(models.Expense.total_amount).desc())
        .first()
    )

    return schemas.ExpenseStatsOut(
        total_this_month=total_this_month, pending_count=pending_count, paid_this_month=paid_this_month,
        top_category=top_category_row[0] if top_category_row else None,
    )


@router.post("/expenses", response_model=schemas.ExpenseOut, status_code=201)
def create_expense(
    payload: schemas.ExpenseCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    branch = db.query(models.Branch).filter(
        models.Branch.id == payload.branch_id, models.Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    account = db.query(models.ChartOfAccount).filter(
        models.ChartOfAccount.id == payload.account_id, models.ChartOfAccount.company_id == current_user.company_id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Expense account not found")

    tax_amount = (payload.amount * payload.tax_rate / 100).quantize(Decimal("0.01"))
    total_amount = payload.amount + tax_amount

    expense_number = _next_number(db, current_user.company_id, models.Expense, "expense_number", "EXP")
    exp = models.Expense(
        company_id=current_user.company_id, branch_id=payload.branch_id, expense_number=expense_number,
        expense_date=payload.expense_date, category=payload.category, account_id=payload.account_id,
        vendor_name=payload.vendor_name, description=payload.description, amount=payload.amount,
        tax_rate=payload.tax_rate, tax_amount=tax_amount, total_amount=total_amount,
        payment_method=payload.payment_method, bank_account_id=payload.bank_account_id,
        created_by_user_id=current_user.id,
    )
    db.add(exp)
    db.flush()

    # Auto-post a balanced journal entry so this expense actually shows up in the P&L
    # report (which only reads posted journal entries). Debit the expense account for
    # the full amount incl. tax, credit Accounts Payable. If the company's chart of
    # accounts has no payable/liability account configured, skip this step rather than
    # blocking expense entry — the expense still records fine, just without a ledger tie.
    payable_account = (
        db.query(models.ChartOfAccount)
        .filter(
            models.ChartOfAccount.company_id == current_user.company_id,
            models.ChartOfAccount.account_type == "liability",
            models.ChartOfAccount.account_name.ilike("%payable%"),
        )
        .first()
        or db.query(models.ChartOfAccount)
        .filter(
            models.ChartOfAccount.company_id == current_user.company_id,
            models.ChartOfAccount.account_type == "liability",
        )
        .first()
    )
    if payable_account:
        entry_number = _next_number(db, current_user.company_id, models.JournalEntry, "entry_number", "JE")
        je = models.JournalEntry(
            company_id=current_user.company_id, branch_id=payload.branch_id, entry_number=entry_number,
            entry_date=payload.expense_date, reference=exp.expense_number,
            narration=f"Expense — {payload.vendor_name or payload.category}",
            status="posted", total_debit=total_amount, total_credit=total_amount,
            source_type="expense", posted_at=sqlfunc.now(), created_by_user_id=current_user.id,
        )
        db.add(je)
        db.flush()
        db.add(models.JournalEntryLine(
            journal_entry_id=je.id, account_id=payload.account_id, debit_amount=total_amount,
            credit_amount=0, description=payload.description,
        ))
        db.add(models.JournalEntryLine(
            journal_entry_id=je.id, account_id=payable_account.id, debit_amount=0,
            credit_amount=total_amount, description=f"Payable — {payload.vendor_name or exp.expense_number}",
        ))
        exp.journal_entry_id = je.id

    db.commit()
    db.refresh(exp)
    return _exp_out(exp)


@router.put("/expenses/{expense_id}", response_model=schemas.ExpenseOut)
def update_expense(
    expense_id: int,
    payload: schemas.ExpenseUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exp = db.query(models.Expense).filter(
        models.Expense.id == expense_id, models.Expense.company_id == current_user.company_id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    if exp.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot edit a paid expense")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(exp, field, value)
    db.commit()
    db.refresh(exp)
    return _exp_out(exp)


@router.put("/expenses/{expense_id}/mark-paid", response_model=schemas.ExpenseOut)
def mark_expense_paid(
    expense_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exp = db.query(models.Expense).filter(
        models.Expense.id == expense_id, models.Expense.company_id == current_user.company_id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    if exp.status == "paid":
        raise HTTPException(status_code=400, detail="Expense is already marked paid")

    if exp.bank_account_id:
        bank = db.query(models.BankAccount).filter(models.BankAccount.id == exp.bank_account_id).first()
        if bank:
            if bank.current_balance < exp.total_amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient balance in {bank.account_name}: need {exp.total_amount}, have {bank.current_balance}",
                )
            bank.current_balance -= exp.total_amount

    exp.status = "paid"
    db.commit()
    db.refresh(exp)
    return _exp_out(exp)


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exp = db.query(models.Expense).filter(
        models.Expense.id == expense_id, models.Expense.company_id == current_user.company_id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    if exp.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot delete a paid expense")

    db.delete(exp)
    db.commit()
    return None


# ============================================================
# GST — computed live from Sales invoices + Purchase bills so
# figures are never stale, plus a filing record to lock a period.
# ============================================================
_ACTIVE_INVOICE_STATUSES = ["sent", "partially_paid", "paid", "overdue"]
_ACTIVE_BILL_STATUSES = ["pending", "partially_paid", "paid", "overdue"]


@router.get("/gst/summary", response_model=schemas.GstReturnSummaryOut)
def gst_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id

    invoices_q = db.query(models.Invoice).filter(
        models.Invoice.company_id == company_id,
        models.Invoice.status.in_(_ACTIVE_INVOICE_STATUSES),
        extract("year", models.Invoice.invoice_date) == year,
        extract("month", models.Invoice.invoice_date) == month,
    )
    taxable_outward = invoices_q.with_entities(sqlfunc.coalesce(sqlfunc.sum(models.Invoice.subtotal), 0)).scalar()
    output_tax = invoices_q.with_entities(sqlfunc.coalesce(sqlfunc.sum(models.Invoice.tax_amount), 0)).scalar()
    invoice_count = invoices_q.count()

    bills_q = db.query(models.PurchaseBill).filter(
        models.PurchaseBill.company_id == company_id,
        models.PurchaseBill.status.in_(_ACTIVE_BILL_STATUSES),
        extract("year", models.PurchaseBill.bill_date) == year,
        extract("month", models.PurchaseBill.bill_date) == month,
    )
    taxable_inward = bills_q.with_entities(sqlfunc.coalesce(sqlfunc.sum(models.PurchaseBill.subtotal), 0)).scalar()
    input_tax_credit = bills_q.with_entities(sqlfunc.coalesce(sqlfunc.sum(models.PurchaseBill.tax_amount), 0)).scalar()
    bill_count = bills_q.count()

    net_payable = output_tax - input_tax_credit
    if net_payable < 0:
        net_payable = Decimal("0")

    filing = db.query(models.GstFiling).filter(
        models.GstFiling.company_id == company_id, models.GstFiling.return_year == year,
        models.GstFiling.return_month == month,
    ).first()

    return schemas.GstReturnSummaryOut(
        return_month=month, return_year=year, taxable_outward_supplies=taxable_outward, output_tax=output_tax,
        taxable_inward_supplies=taxable_inward, input_tax_credit=input_tax_credit, net_tax_payable=net_payable,
        invoice_count=invoice_count, bill_count=bill_count,
        filing_status=filing.status if filing else "draft",
        filed_on=filing.filed_on if filing else None,
        arn=filing.arn if filing else None,
    )


@router.post("/gst/file", response_model=schemas.GstFilingOut)
def file_gst_return(
    payload: schemas.GstFileRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.GstFiling).filter(
        models.GstFiling.company_id == current_user.company_id,
        models.GstFiling.return_year == payload.return_year,
        models.GstFiling.return_month == payload.return_month,
    ).first()
    if existing and existing.status == "filed":
        raise HTTPException(status_code=400, detail="This period has already been filed")

    # recompute the figures fresh at filing time so the locked record is accurate
    summary = gst_summary(payload.return_month, payload.return_year, current_user, db)

    if existing:
        filing = existing
    else:
        filing = models.GstFiling(
            company_id=current_user.company_id, return_month=payload.return_month, return_year=payload.return_year,
        )
        db.add(filing)

    filing.taxable_outward_supplies = summary.taxable_outward_supplies
    filing.output_tax = summary.output_tax
    filing.taxable_inward_supplies = summary.taxable_inward_supplies
    filing.input_tax_credit = summary.input_tax_credit
    filing.net_tax_payable = summary.net_tax_payable
    filing.status = "filed"
    filing.filed_on = date.today()
    filing.filed_by_user_id = current_user.id
    filing.arn = payload.arn

    db.commit()
    db.refresh(filing)
    return filing


@router.get("/gst/filings", response_model=list[schemas.GstFilingOut])
def list_gst_filings(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.GstFiling).filter(
        models.GstFiling.company_id == current_user.company_id
    ).order_by(models.GstFiling.return_year.desc(), models.GstFiling.return_month.desc()).all()


# ============================================================
# PROFIT & LOSS (computed from posted journal entries)
# ============================================================
@router.get("/reports/profit-loss", response_model=schemas.ProfitAndLossOut)
def profit_and_loss(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            models.ChartOfAccount.account_type,
            models.ChartOfAccount.account_name,
            sqlfunc.sum(models.JournalEntryLine.debit_amount).label("debit"),
            sqlfunc.sum(models.JournalEntryLine.credit_amount).label("credit"),
        )
        .join(models.JournalEntryLine, models.JournalEntryLine.account_id == models.ChartOfAccount.id)
        .join(models.JournalEntry, models.JournalEntry.id == models.JournalEntryLine.journal_entry_id)
        .filter(
            models.ChartOfAccount.company_id == current_user.company_id,
            models.JournalEntry.status == "posted",
            models.ChartOfAccount.account_type.in_(["income", "expense"]),
            extract("year", models.JournalEntry.entry_date) == year,
            extract("month", models.JournalEntry.entry_date) == month,
        )
        .group_by(models.ChartOfAccount.account_type, models.ChartOfAccount.account_name)
        .all()
    )

    income_breakdown, expense_breakdown = [], []
    total_income = Decimal("0")
    total_expense = Decimal("0")
    for account_type, account_name, debit, credit in rows:
        debit = debit or Decimal("0")
        credit = credit or Decimal("0")
        if account_type == "income":
            net = credit - debit  # income accounts grow on the credit side
            total_income += net
            income_breakdown.append({"account_name": account_name, "amount": float(net)})
        else:
            net = debit - credit  # expense accounts grow on the debit side
            total_expense += net
            expense_breakdown.append({"account_name": account_name, "amount": float(net)})

    return schemas.ProfitAndLossOut(
        period_label=f"{year}-{str(month).zfill(2)}", total_income=total_income, total_expense=total_expense,
        net_profit=total_income - total_expense, income_breakdown=income_breakdown, expense_breakdown=expense_breakdown,
    )
