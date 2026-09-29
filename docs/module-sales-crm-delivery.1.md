# Sales + CRM Module — Integration Guide

Built and fully tested (real MySQL, real API calls, real browser rendering) against your
existing Nexus ERP project. This adds Leads, Customers, Quotations, Sales Orders, and
Invoices — all wired into your existing login, branches, users, and roles system.

## 1. Database — run the migration

If your database already has data you want to keep, run the migration (adds new tables +
extends `customers`/adds CRM fields, non-destructive):

```bash
mysql -u root -p nexus_erp < database/migration_002_sales_crm.sql
```

If you're OK rebuilding from scratch, `database/schema.sql` is the full updated schema
(replaces your existing `database/schema.sql`).

## 2. Backend — copy these files into your `backend/` folder, overwriting the existing ones

```
backend/app/models.py              → replaces existing (adds Lead, Quotation, QuotationItem,
                                       SalesOrder, SalesOrderItem, Invoice, InvoiceItem,
                                       InvoicePayment; extends Customer with CRM fields)
backend/app/schemas.py             → replaces existing (adds all CRM request/response schemas)
backend/app/main.py                → replaces existing (registers the new sales_crm router)
backend/app/routers/sales_crm.py   → NEW file
backend/seed_db.py                 → replaces existing (adds sample leads/quotations/
                                       orders/invoices so the module isn't empty on first run)
```

After copying, re-run the seed script against a fresh database (or skip this if you already
have production data and just want the schema/code):

```bash
python3 seed_db.py
```

Restart the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

New API base: `/api/sales/...` — full list in the table below.

## 3. Frontend — copy these files into your `frontend/src/` folder

```
frontend/src/App.jsx                          → replaces existing (adds nested /sales routes)
frontend/src/layouts/AppLayout.jsx            → replaces existing (Sales+CRM is no longer
                                                  "Soon" in the sidebar)
frontend/src/layouts/SalesCrmLayout.jsx       → NEW file (sub-nav + pipeline summary cards)
frontend/src/api/services.js                  → replaces existing (adds salesCrmApi)
frontend/src/components/LineItemsEditor.jsx   → NEW file (shared line-item table used by
                                                  Quotations, Sales Orders, Invoices)
frontend/src/pages/sales/*.jsx                → NEW folder, 6 files (Overview, Leads,
                                                  Customers, Quotations, Sales Orders, Invoices)
```

Restart the frontend:
```bash
npm run dev
```

Sales + CRM is now live in the sidebar under Workspace Modules — no longer marked "Soon."

## 4. What you get

- **Leads** — pipeline by stage (New → Contacted → Qualified → Proposal → Won/Lost),
  convert a lead straight into a customer
- **Customers** — extended with email, GSTIN, billing/shipping address, credit limit,
  assigned owner, lifetime value
- **Quotations** — line-item builder with auto-calculated tax/subtotal/total, one-click
  "Convert to Order"
- **Sales Orders** — status tracking (pending → confirmed → processing → shipped → completed)
- **Invoices** — payment recording with running balance, auto status (draft → sent →
  partially paid → paid / overdue)
- A pipeline summary bar (open leads, pipeline value, quotations pending, orders in
  progress, invoices outstanding) on every CRM screen

## 5. API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sales/pipeline-summary` | Summary cards shown at top of every CRM screen |
| GET/POST | `/api/sales/leads` | List / create leads |
| GET/PUT/DELETE | `/api/sales/leads/{id}` | Get / update / delete a lead |
| POST | `/api/sales/leads/{id}/convert` | Convert a lead into a customer |
| GET/POST | `/api/sales/customers` | List / create customers |
| GET | `/api/sales/customers/stats` | Customer stat cards |
| GET/PUT/DELETE | `/api/sales/customers/{id}` | Get / update / delete a customer |
| GET/POST | `/api/sales/quotations` | List / create quotations (with line items) |
| GET/PUT/DELETE | `/api/sales/quotations/{id}` | Get / update / delete a quotation |
| POST | `/api/sales/quotations/{id}/convert-to-order` | Turn an accepted quotation into a sales order |
| GET/POST | `/api/sales/orders` | List / create sales orders |
| GET/PUT/DELETE | `/api/sales/orders/{id}` | Get / update / delete an order |
| GET/POST | `/api/sales/invoices` | List / create invoices |
| GET/PUT/DELETE | `/api/sales/invoices/{id}` | Get / update / delete an invoice |
| POST | `/api/sales/invoices/{id}/payments` | Record a payment (auto-updates status/balance) |

Full interactive docs at `http://localhost:8000/docs` once the backend is running.

## 6. Demo data included

Re-running `seed_db.py` adds: 3 leads, 2 quotations (one already accepted), 2 sales orders,
and 2 invoices (one paid, one overdue) — so you can see the module working immediately
without entering data by hand.

Login: `ravi@sundarprecision.com` / `Password@123`
