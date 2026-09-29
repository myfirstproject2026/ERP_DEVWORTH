# Finance & GST Module — Integration Guide

Chart of Accounts, Bank Accounts, Journal Entries (double-entry), Expenses, GST
(computed live from real Sales and Purchase data), and a Profit & Loss report — wired
into everything you have so far.

**Important:** `models.py`, `schemas.py`, `main.py`, `App.jsx`, `services.js`, and
`AppLayout.jsx` in this package are complete replacements containing all six modules
together. Safe to overwrite what you have. `sales_crm.py` and `purchase.py` are also
replaced — see section 5, this is the most important part of this delivery.

## 1. Database — run the migration

Non-destructive, adds 6 new tables (chart_of_accounts, bank_accounts, journal_entries,
journal_entry_lines, expenses, gst_filings):

```bash
mysql -u root -p nexus_erp < database/migration_007_finance.sql
```

I tested this migration file specifically (not just the full schema) by applying it to
a database seeded with every other module but not Finance, confirming it produces the
identical table set as a from-scratch install.

Or if rebuilding from scratch, `database/schema.sql` is the full schema (all six
modules, 57 tables total).

## 2. Backend — copy into your `backend/` folder, overwriting existing files

```
backend/app/models.py               → replaces existing (adds ChartOfAccount,
                                        BankAccount, JournalEntry, JournalEntryLine,
                                        Expense, GstFiling)
backend/app/schemas.py              → replaces existing (adds Finance schemas)
backend/app/main.py                 → replaces existing (registers the finance router)
backend/app/routers/finance.py      → NEW file
backend/app/routers/sales_crm.py    → replaces existing — see section 5
backend/app/routers/purchase.py     → replaces existing — see section 5
backend/seed_db.py                  → replaces existing (adds chart of accounts, a
                                        bank account, journal entries, expenses, a
                                        filed GST return)
```

Re-seed (only if you're OK resetting demo data):
```bash
python3 seed_db.py
```

Restart the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

## 3. Frontend — copy into your `frontend/src/` folder

```
frontend/src/App.jsx                       → replaces existing (adds /finance routes)
frontend/src/api/services.js               → replaces existing (adds financeApi)
frontend/src/layouts/AppLayout.jsx         → replaces existing (Finance & GST is no
                                               longer "Soon" in the sidebar)
frontend/src/layouts/FinanceLayout.jsx     → NEW file (sub-nav + overview cards)
frontend/src/pages/finance/*.jsx           → NEW folder, 6 files (Overview, Chart of
                                               Accounts, Bank Accounts, Journal
                                               Entries, Expenses, GST)
```

Restart the frontend:
```bash
npm run dev
```

## 4. What you get

- **Chart of Accounts** — asset/liability/equity/income/expense accounts, with system
  accounts (Cash, Bank, Accounts Receivable, Accounts Payable, Sales Revenue, Cost of
  Goods Sold) pre-configured
- **Bank Accounts** — opening balance, live current balance, primary account flag
- **Journal Entries** — full double-entry: every entry must balance (total debits =
  total credits) or the API rejects it with a clear error naming the mismatch; draft
  entries can be edited, posting is a separate explicit action
- **Expenses** — category, vendor, tax, payment method; creating an expense
  auto-posts a balanced journal entry (Debit Expense / Credit Payable); marking it
  paid deducts from the linked bank account, with an insufficient-funds guard
- **GST** — output tax and input tax credit computed live from real, non-cancelled
  Sales invoices and Purchase bills for the selected period (not a stale snapshot),
  with a file/lock action that's protected against re-filing the same period twice
- **Profit & Loss report** — income and expense breakdown by account for any month

## 5. The most important thing I fixed in this delivery

**Sales invoices and Purchase bills never posted anything to the ledger.** Only
Expenses did. That meant the P&L report — which only reads posted journal entries —
would show **zero income forever**, no matter how much the business actually sold.
I found this by testing the interaction between Finance and the modules that came
before it, not by reviewing Finance in isolation: I created a real invoice, checked
P&L, and it showed nothing.

The chart of accounts already had `Accounts Receivable`, `Sales Revenue`, and
`Cost of Goods Sold` marked as system accounts, and `JournalEntry.source_type` already
had `sales_invoice`/`purchase_bill` as valid values — strong evidence this integration
was planned but never actually wired up before I picked up this module.

**Fixed** by adding the same auto-posting pattern already used for Expenses into both
`create_invoice` (Sales+CRM) and `create_bill` (Purchase):
- Sales invoice → Debit Accounts Receivable / Credit Sales Revenue
- Purchase bill → Debit Cost of Goods Sold / Credit Accounts Payable

Both skip gracefully (no error, just no posting) if a company's chart of accounts
doesn't have suitable accounts configured — this only activates automatically for
companies using the standard chart of accounts this seed data sets up.

**Verified twice:** first by reading the journal_entries table directly after
re-seeding, then — the test that actually matters — by creating a brand-new invoice
through the live API afterward and confirming `/api/finance/reports/profit-loss`
picked it up immediately, not just the seed data.

## 6. API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/finance/overview` | Overview cards |
| GET/POST | `/api/finance/accounts` | List / create chart of accounts entries |
| PUT/DELETE | `/api/finance/accounts/{id}` | Update / delete an account |
| GET/POST | `/api/finance/bank-accounts` | List / create bank accounts |
| PUT | `/api/finance/bank-accounts/{id}` | Update a bank account |
| GET/POST | `/api/finance/journal-entries` | List / create journal entries |
| GET/DELETE | `/api/finance/journal-entries/{id}` | Get / delete an entry |
| PUT | `/api/finance/journal-entries/{id}/post` | Post a draft entry |
| GET/POST | `/api/finance/expenses` | List / create expenses |
| GET | `/api/finance/expenses/stats` | Expense stat cards |
| PUT | `/api/finance/expenses/{id}` | Update an expense |
| PUT | `/api/finance/expenses/{id}/mark-paid` | Mark paid (deducts bank balance) |
| GET | `/api/finance/gst/summary` | Live GST summary for a month/year |
| POST | `/api/finance/gst/file` | File the GST return for a period |
| GET | `/api/finance/gst/filings` | List past filings |
| GET | `/api/finance/reports/profit-loss` | P&L for a month/year |

Full interactive docs at `http://localhost:8000/docs` once the backend is running.

## 7. Demo data included

Re-running `seed_db.py` adds: 12 chart of accounts entries, 1 bank account (₹15L
opening balance), 6 journal entries (capital introduction, a draft rent accrual, two
posted expenses, and — the fix above — one for the existing Sales invoice and one for
the existing Purchase bill), 3 expenses (2 pending, 1 paid), and a filed GST return
for June 2026 (July stays open, computed live).

Login: `ravi@sundarprecision.com` / `Password@123`
