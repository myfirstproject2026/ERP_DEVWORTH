# Integration notes

## What the uploaded ZIP contained

* A git-tracked base project (`backend/`, `frontend/`, `database/`): Login/Company setup,
  Dashboard, AI Assistant, plus Sales+CRM and Inventory (flat `frontend/src/pages/*.jsx`).
* Eight cumulative "delivery" folders, each an overlay for one module:
  `sales-crm-delivery.1`, `inventory-delivery.2` / `inventory-delivery-final.3`,
  `hr-delivery-final.4`, `manufacturing-delivery-final.5`, `purchase-delivery-final.6`,
  `servicedesk-delivery-final.7`, `finance-delivery-final.8`.
* The base project's `main.py` only registered auth/company/branches/users/roles/dashboard/AI;
  the base tree had no Purchase, Manufacturing, HR, Finance or Service Desk code at all.
* `backend/venv`, `frontend/node_modules` and `.git` were inside the ZIP and were not carried over.

## How they were merged (newest complete version of each file wins)

| File(s) | Taken from | Why |
|---|---|---|
| `models.py`, `schemas.py`, `main.py`, `seed_db.py` | servicedesk-delivery-final.7 | strict superset of every earlier delivery (61 tables; verified finance-.8 has no class/schema that .7 lacks) |
| `routers/finance.py`, `purchase.py`, `sales_crm.py` | finance-delivery-final.8 | contains the fix that posts sales invoices / purchase bills to the ledger; `sales_crm.py`/`purchase.py` there are newer than the other deliveries' |
| `routers/hr.py`, `dashboard.py` | hr-delivery-final.4 | dashboard superset (HR attendance + manufacturing data) |
| `routers/manufacturing.py`, `inventory.py`, `service_desk.py` | their own deliveries | only source |
| `routers/auth, users, roles, branches, companies, ai_assistant`, `core/`, `database.py` | base project | unchanged (auth/permission changes below) |
| `frontend/src/App.jsx`, `api/services.js`, `layouts/AppLayout.jsx` | servicedesk-delivery-final.7 | contains all seven modules' routes, API clients, nav |
| module pages/layouts | each delivery (`pages/<module>/`) | base flat `pages/*Page.jsx` copies of sales/inventory were duplicates of these and were dropped |
| `components/LineItemsEditor.jsx` | purchase-delivery-final.6 | backwards-compatible superset (optional `products` prop) |
| `database/schema.sql` | servicedesk-delivery-final.7 | full schema; `migration_002..008` kept for incremental upgrades |

`database/seed.sql` from the base project targeted the original 18-table prototype schema
(different table set: `production_orders`, `customer_dues`, ...) and is not compatible
with the unified schema, so it is not shipped. `seed_db.py` is the seeding path.

## Changes made on top of the merge

1. **Role-based access enforced** (`backend/app/core/security.py::require_module`, wired in
   `main.py`). Previously roles/permissions could be edited but nothing used them.
   `/api/auth/login` and `/api/auth/me` now return `allowed_modules`; the sidebar filters by it.
2. Login now refreshes the full profile so the header shows the company name immediately.
3. Sidebar footer no longer shows a hard-coded "3 companies".

## Known limitations

* Permissions are enforced per module and HTTP method; the `can_approve` flag is stored but not
  separately enforced. Users/Roles/Branches/Company endpoints keep their original checks.
* A role without access to Inventory that uses a Purchase/Sales screen needing the product
  list will get a 403 for that dropdown.
* Workspace modules are flagged `is_active=False` in the seeded `modules` table (original seed
  data); this flag is not used by the app.
