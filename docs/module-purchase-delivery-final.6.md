# Purchase Module — Integration Guide

Suppliers, Purchase Orders, Goods Receipts (GRN), and Bills — fully wired into your
existing Login/Sales+CRM/Inventory setup, and integrated with Inventory so receiving
goods actually updates stock.

**Important:** `models.py`, `schemas.py`, `main.py`, `App.jsx`, `services.js`,
`AppLayout.jsx`, and `LineItemsEditor.jsx` in this package are complete replacements
that already contain your Sales+CRM and Inventory code together with the new Purchase
code. Safe to overwrite what you have — nothing from those modules is lost.

## 1. Database — run the migration

Non-destructive, adds 8 new tables (suppliers, purchase_orders, purchase_order_items,
purchase_receipts, purchase_receipt_items, purchase_bills, purchase_bill_items,
purchase_bill_payments):

```bash
mysql -u root -p nexus_erp < database/migration_004_purchase.sql
```

Or if rebuilding from scratch, `database/schema.sql` is the full updated schema (Login
& Company Setup + Sales & CRM + Inventory + Purchase, 40 tables total).

## 2. Backend — copy into your `backend/` folder, overwriting existing files

```
backend/app/models.py              → replaces existing (adds Supplier, PurchaseOrder,
                                       PurchaseOrderItem, PurchaseReceipt,
                                       PurchaseReceiptItem, PurchaseBill,
                                       PurchaseBillItem, PurchaseBillPayment)
backend/app/schemas.py             → replaces existing (adds Purchase schemas; also
                                       adds product_id + received_quantity to the
                                       shared LineItemIn/LineItemOut — see note below)
backend/app/main.py                → replaces existing (registers the purchase router)
backend/app/routers/purchase.py    → NEW file
backend/seed_db.py                 → replaces existing (adds 3 suppliers, 2 purchase
                                       orders, 1 completed goods receipt, 2 bills)
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
frontend/src/App.jsx                        → replaces existing (adds /purchase routes)
frontend/src/api/services.js                → replaces existing (adds purchaseApi)
frontend/src/layouts/AppLayout.jsx          → replaces existing (Purchase is no
                                                longer "Soon" in the sidebar)
frontend/src/layouts/PurchaseLayout.jsx     → NEW file (sub-nav + overview cards)
frontend/src/components/LineItemsEditor.jsx → replaces existing (now supports an
                                                optional product-picker dropdown,
                                                used by Purchase Orders; Sales pages
                                                keep working exactly as before)
frontend/src/pages/purchase/*.jsx           → NEW folder, 5 files (Overview,
                                                Suppliers, Purchase Orders, Goods
                                                Receipts, Bills)
```

Restart the frontend:
```bash
npm run dev
```

## 4. What you get

- **Suppliers** — contact info, GSTIN, category, payment terms, rating, open PO count,
  total spend
- **Purchase Orders** — line items linked to real Inventory products (required so they
  can later be received), draft → sent → confirmed workflow
- **Goods Receipts (GRN)** — pick a confirmed PO, enter received quantity per line
  (partial receiving supported), complete it to update stock
- **Bills** — line items, due dates, payment recording with running balance, auto
  status (pending → partially paid → paid / overdue)
- Overview cards (total suppliers, open POs, bills due, pending receipts) on every
  Purchase screen, plus a "receive goods" shortcut straight from the orders list that
  deep-links into a pre-filled receipt form

## 5. Two real bugs I found and fixed before shipping this

This module had backend code already partially built. Rather than trust it blindly, I
ran it against a real database and found:

1. **Un-receivable purchase orders.** The shared line-item schema had no `product_id`
   field, so every PO created through the normal API would fail when you tried to
   receive it — the receiving endpoint requires each line to be linked to an inventory
   product. Fixed by adding `product_id` to `LineItemIn`/`LineItemOut` and wiring it
   through order creation. Verified by creating a PO, confirming it, receiving it, and
   confirming stock actually moved (2,100 → 2,150 units).
2. **Duplicate database constraint name.** `purchase_orders` and the existing
   `production_orders` table (from the Dashboard module) both tried to name a foreign
   key `fk_po_company` — MySQL rejected the schema outright. Renamed the Purchase
   Orders constraints to `fk_purchord_*` in both `schema.sql` and the standalone
   migration file.

Both are things a quick "does it look right" review would likely have missed — they
only showed up when I actually ran the create → confirm → receive flow against a real
database.

## 6. API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/purchase/overview` | Overview cards + recent orders feed |
| GET/POST | `/api/purchase/suppliers` | List / create suppliers |
| GET | `/api/purchase/suppliers/stats` | Supplier stat cards |
| GET/PUT/DELETE | `/api/purchase/suppliers/{id}` | Get / update / delete a supplier |
| GET/POST | `/api/purchase/orders` | List / create purchase orders |
| GET/PUT/DELETE | `/api/purchase/orders/{id}` | Get / update (incl. status) / delete an order |
| GET/POST | `/api/purchase/receipts` | List / create goods receipts |
| GET | `/api/purchase/receipts/{id}` | Get a receipt |
| PUT | `/api/purchase/receipts/{id}/complete` | Complete a receipt (mutates stock) |
| GET/POST | `/api/purchase/bills` | List / create bills |
| GET/DELETE | `/api/purchase/bills/{id}` | Get / delete a bill |
| POST | `/api/purchase/bills/{id}/payments` | Record a payment |

Full interactive docs at `http://localhost:8000/docs` once the backend is running.

## 7. Demo data included

Re-running `seed_db.py` adds: 3 suppliers, 2 purchase orders (one fully received with a
completed GRN, one still confirmed/open), and 2 bills (one paid, one overdue).

Login: `ravi@sundarprecision.com` / `Password@123`
