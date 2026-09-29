# Manufacturing Module — Integration Guide

Work Centers, Bills of Materials (BOMs), and Work Orders — wired into your existing
Login/Sales+CRM/Inventory/Purchase setup, with full Inventory integration: issuing
materials deducts raw-material stock, completing a work order adds finished-goods stock.

**Important:** `models.py`, `schemas.py`, `main.py`, `App.jsx`, `services.js`, and
`AppLayout.jsx` in this package are complete replacements that already contain your
Sales+CRM, Inventory, and Purchase code together with the new Manufacturing code. Safe
to overwrite what you have — nothing from those modules is lost.

## 1. Database — run the migration

Non-destructive, adds 5 new tables (work_centers, bill_of_materials, bom_components,
work_orders, material_issues) and two new values on the existing stock movement type
enum (`production_consume`, `production_output` — already present if you took the
Inventory module from this delivery chain):

```bash
mysql -u root -p nexus_erp < database/migration_005_manufacturing.sql
```

Or if rebuilding from scratch, `database/schema.sql` is the full updated schema (Login
& Company Setup + Sales & CRM + Inventory + Purchase + Manufacturing, 45 tables total).

## 2. Backend — copy into your `backend/` folder, overwriting existing files

```
backend/app/models.py                 → replaces existing (adds WorkCenter,
                                          BillOfMaterials, BomComponent, WorkOrder,
                                          MaterialIssue)
backend/app/schemas.py                → replaces existing (adds Manufacturing schemas)
backend/app/main.py                   → replaces existing (registers the
                                          manufacturing router)
backend/app/routers/manufacturing.py  → NEW file
backend/app/routers/dashboard.py      → replaces existing (see note below — the
                                          Dashboard's "Production status" card now
                                          pulls from real Manufacturing work orders)
backend/seed_db.py                    → replaces existing (adds 2 work centers, 1 BOM,
                                          3 work orders)
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
frontend/src/App.jsx                            → replaces existing (adds
                                                    /manufacturing routes)
frontend/src/api/services.js                    → replaces existing (adds
                                                    manufacturingApi)
frontend/src/layouts/AppLayout.jsx              → replaces existing (Manufacturing is
                                                    no longer "Soon" in the sidebar)
frontend/src/layouts/ManufacturingLayout.jsx    → NEW file (sub-nav + overview cards)
frontend/src/pages/manufacturing/*.jsx          → NEW folder, 4 files (Overview, Work
                                                    Orders, BOMs, Work Centers)
```

Restart the frontend:
```bash
npm run dev
```

## 4. What you get

- **Work Centers** — name, code, branch, daily capacity, active/inactive/maintenance
  status, live count of active work orders assigned to each
- **Bills of Materials** — define what raw materials (and how much of each) go into
  producing one unit of a finished product; a product can have multiple BOM versions
- **Work Orders** — plan production of a quantity of a product, optionally against a
  specific BOM and work center, with priority and due date. Full lifecycle: draft →
  issue materials → in progress (with stage tracking: Raw Material Prep → Machining →
  Assembly → Quality Checking → Packaging → Completed) → complete → cancel
- **Issue Materials** — validates stock availability first and refuses cleanly if any
  component is short, otherwise deducts every BOM component's required quantity
  (`quantity_required × quantity_planned`) from the work order's branch stock, with a
  full movement ledger entry per component
- **Complete Work Order** — adds the finished quantity to stock at the work order's
  branch, also with a movement ledger entry
- Overview cards (total work orders, in-progress count, completed this month, work
  centers, active BOMs) on every Manufacturing screen

## 5. A cross-module bug I found and fixed: the Dashboard was disconnected from real production

Your Dashboard's "Production status" card (built in the very first module) reads from a
static `production_orders` table that was only ever seeded with 3 fixed rows — it had
no way to know Manufacturing would exist later. Now that real Work Orders exist, that
card would have kept showing the same frozen snapshot forever, completely ignoring
anything you actually do in Manufacturing. I caught this by testing the interaction
between modules, not just the module in isolation: I advanced a real work order's stage
through the API, then checked the Dashboard endpoint and saw it hadn't moved.

Fixed by changing `/api/dashboard/production` to query live `work_orders` (status
`in_progress` or `scheduled`, most recent 5) first, falling back to the old static table
only for companies that haven't set up Manufacturing yet. Verified: advanced WO-1043 to
"Assembly" at 60% via the Manufacturing API, then confirmed the Dashboard endpoint
immediately reflected it.

## 6. What I verified before shipping this

This module's backend was already mostly built when I picked it up. Rather than trust
it, I reviewed it line by line and then ran the full lifecycle against a real database:

- Applied the schema to real MySQL — 45 tables, zero constraint-name collisions (I
  checked proactively this time, having found one in the Purchase module last round)
- Created a BOM (Bracket Type-A needing 0.1 units of Flange Coupling each), created a
  work order for 50 units, issued materials, and confirmed stock actually moved:
  Flange Coupling 40 → 35 (exactly 50 × 0.1), and Bracket Type-A 0 → 50 on completion
- Confirmed the shortage guard works: tried issuing materials for a 100,000-unit work
  order against the same BOM and got a clean 400 error naming the exact shortfall,
  not a crash
- Confirmed stage advancement and the work order list/detail views reflect real state
- Built the frontend, zero compile errors, browser-tested all 4 pages with a real login
  session — table contents cross-checked against what the API actually returned,
  including the exact work orders and BOM I created via direct API calls beforehand

## 7. API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/manufacturing/overview` | Overview cards + recent work orders |
| GET | `/api/manufacturing/stages` | Valid production stage names, in order |
| GET/POST | `/api/manufacturing/work-centers` | List / create work centers |
| GET/PUT/DELETE | `/api/manufacturing/work-centers/{id}` | update / delete a work center |
| GET/POST | `/api/manufacturing/boms` | List / create BOMs |
| GET/PUT/DELETE | `/api/manufacturing/boms/{id}` | Get / update / delete a BOM |
| GET/POST | `/api/manufacturing/work-orders` | List / create work orders |
| GET/PUT/DELETE | `/api/manufacturing/work-orders/{id}` | Get / update / delete a work order |
| PUT | `/api/manufacturing/work-orders/{id}/issue-materials` | Issue BOM materials (mutates stock) |
| PUT | `/api/manufacturing/work-orders/{id}/advance-stage` | Move to next production stage |
| PUT | `/api/manufacturing/work-orders/{id}/complete` | Complete and produce finished stock |
| PUT | `/api/manufacturing/work-orders/{id}/cancel` | Cancel a work order |

Full interactive docs at `http://localhost:8000/docs` once the backend is running.

## 8. Demo data included

Re-running `seed_db.py` adds: 2 work centers (CNC Line 1, Assembly Line A), 1 BOM
(Standard Hex Bolt M8), and 3 work orders — WO-1042, WO-1043, WO-1044, covering the same
three products (Hex Bolt M8, Flange Coupling, Bracket Type-A) shown on your original
Dashboard mockup, though as a fresh, live sequence rather than a re-creation of that
exact static snapshot. Thanks to the fix above, your Dashboard's Production status card
will now show these — and update as you use Manufacturing for real.

Login: `ravi@sundarprecision.com` / `Password@123`
