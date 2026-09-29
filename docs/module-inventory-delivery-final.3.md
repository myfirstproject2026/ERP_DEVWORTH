# Inventory Module — Integration Guide

Built and fully tested (real MySQL, real API calls with actual stock mutations verified,
real browser rendering) on top of your existing project **including the Sales + CRM
module you already integrated**.

**Important:** `models.py`, `schemas.py`, `main.py`, `App.jsx`, `services.js`, and
`AppLayout.jsx` in this package are complete replacements that already contain your
Sales + CRM code plus the new Inventory code together. You can safely overwrite the
versions you got from the Sales+CRM delivery with these — nothing from that module is
lost.

## 1. Database — run the migration

Non-destructive, adds new tables + extends `products`:

```bash
mysql -u root -p nexus_erp < database/migration_003_inventory.sql
```

Or if rebuilding from scratch, `database/schema.sql` is the full updated schema (Login
& Company Setup + Sales & CRM + Inventory, 31 tables total).

## 2. Backend — copy into your `backend/` folder, overwriting existing files

```
backend/app/models.py              → replaces existing (adds StockLevel, StockMovement,
                                       StockTransfer, StockTransferItem, StockAdjustment,
                                       StockAdjustmentItem; extends Product with sku,
                                       category, cost/selling price, tax rate, reorder
                                       level, HSN code, barcode)
backend/app/schemas.py             → replaces existing (adds all Inventory schemas)
backend/app/main.py                → replaces existing (registers the inventory router)
backend/app/routers/inventory.py   → NEW file
backend/seed_db.py                 → replaces existing (adds sample products, stock
                                       levels, movements, one transfer, one adjustment)
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
frontend/src/App.jsx                            → replaces existing (adds nested
                                                    /inventory routes)
frontend/src/api/services.js                    → replaces existing (adds inventoryApi)
frontend/src/layouts/AppLayout.jsx              → replaces existing (Inventory is no
                                                    longer "Soon" in the sidebar)
frontend/src/layouts/InventoryLayout.jsx        → NEW file (sub-nav + overview cards)
frontend/src/pages/inventory/*.jsx              → NEW folder, 5 files (Overview,
                                                    Products, Stock Levels, Transfers,
                                                    Adjustments)
```

Restart the frontend:
```bash
npm run dev
```

## 4. What you get

- **Products** — SKU, category, HSN code, cost/selling price, tax rate, reorder level
  and quantity, primary branch, active/inactive status
- **Stock Levels** — on-hand vs. reserved vs. available quantity per product per branch,
  with a low-stock flag and branch filter
- **Stock Movements** — a live ledger of every purchase-in, sale-out, transfer, and
  adjustment, each one tied to the user who made it
- **Transfers** — move stock between branches with a pending → in-transit → completed
  workflow; completing a transfer automatically deducts from the source branch and adds
  to the destination
- **Adjustments** — record damage, loss, found stock, or manual corrections; completing
  an adjustment automatically updates stock levels and writes a movement record
- Overview cards (total products, low-stock count, total stock value, pending transfers)
  on every Inventory screen

I verified the stock-mutation logic specifically (not just that the screens load):
created a "found stock" adjustment for +30 units, completed it, and confirmed the stock
level actually moved from 2,100 → 2,130 with a corresponding movement record — not just
a UI change.

## 5. API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/inventory/overview` | Overview cards + recent movements feed |
| GET/POST | `/api/inventory/products` | List / create products |
| GET | `/api/inventory/products/stats` | Product stat cards |
| GET/PUT/DELETE | `/api/inventory/products/{id}` | Get / update / delete a product |
| GET | `/api/inventory/stock-levels` | Stock levels (filterable by branch, product, low-stock) |
| GET | `/api/inventory/movements` | Stock movement ledger (filterable by product) |
| GET/POST | `/api/inventory/transfers` | List / create branch-to-branch transfers |
| GET/PUT/DELETE | `/api/inventory/transfers/{id}` | Get / update status / delete a transfer |
| GET/POST | `/api/inventory/adjustments` | List / create stock adjustments |
| GET/DELETE | `/api/inventory/adjustments/{id}` | Get / delete an adjustment |
| PUT | `/api/inventory/adjustments/{id}/complete` | Complete an adjustment (mutates stock) |

Full interactive docs at `http://localhost:8000/docs` once the backend is running.

## 6. Demo data included

Re-running `seed_db.py` adds: 4 products (including the AI Assistant's "Hex Bolt M8
Series" now fully fleshed out with real inventory fields), 6 stock levels across
branches, 6 stock movements, 1 completed transfer, and 1 completed adjustment.

Login: `ravi@sundarprecision.com` / `Password@123`
