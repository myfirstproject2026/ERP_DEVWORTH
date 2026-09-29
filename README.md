# Nexus ERP — Unified Multi-Company ERP / CRM / HRM Suite

One application, one login, one database. After signing in once you get a shared
dashboard, header and sidebar with every module you are permitted to use.

## Modules (all inside the same app)

| Sidebar entry | Frontend route | API prefix | Permission key |
|---|---|---|---|
| Dashboard / AI Assistant | `/dashboard`, `/ai-assistant` | `/api/dashboard`, `/api/ai` | `dashboard` |
| Company Profile, Branches, Users, Roles & Permissions | `/company-profile`, `/branches`, `/users`, `/roles` | `/api/company`, `/api/branches`, `/api/users`, `/api/roles` | `company_profile`, `branches`, `users`, `roles_permissions` |
| Sales + CRM (leads, customers, quotations, orders, invoices) | `/sales/*` | `/api/sales` | `sales_crm` |
| Inventory (products, stock, transfers, adjustments) | `/inventory/*` | `/api/inventory` | `inventory` |
| Purchase (suppliers, POs, receipts, bills) | `/purchase/*` | `/api/purchase` | `purchase` |
| Manufacturing (work orders, BOMs, work centres) | `/manufacturing/*` | `/api/manufacturing` | `manufacturing` |
| HR & Employee (employees, departments, leave, attendance, payroll) | `/hr/*` | `/api/hr` | `hr_employee` |
| Finance & GST (chart of accounts, banks, journals, expenses, GST, P&L) | `/finance/*` | `/api/finance` | `finance_gst` |
| Service Desk (tickets, categories, SLA) | `/service-desk/*` | `/api/service-desk` | `service_desk` |

Cross-module wiring: sales invoices and purchase bills auto-post journal entries to
Finance; stock, manufacturing and purchase receipts share the inventory ledger;
the dashboard aggregates HR, manufacturing and finance data.

## Structure

```
backend/    FastAPI app (app/main.py registers every module router), SQLAlchemy models, seed_db.py
frontend/   React + Vite + Tailwind single-page app (src/App.jsx holds every route)
database/   schema.sql (full 61-table schema) + migration_002..008 (incremental, per module)
docs/       Original per-module delivery notes and API details
.env.example, docker-compose.yml
```

## Technology

Backend: Python 3.11, FastAPI, SQLAlchemy 2, PyMySQL, JWT (python-jose), bcrypt.
Frontend: React 18, Vite 5, Tailwind 3, React Router 6, Axios, Recharts.
Database: MySQL 8.

## Setup

### 1. Database

```bash
mysql -u root -p -e "CREATE DATABASE nexus_erp CHARACTER SET utf8mb4; CREATE USER 'nexus_user'@'localhost' IDENTIFIED BY 'nexus_pass'; GRANT ALL ON nexus_erp.* TO 'nexus_user'@'localhost';"
```
Or `docker compose up -d db` (MySQL on port 3306 with the same names).

You do **not** need to run `database/schema.sql` — `seed_db.py` creates every table.
`schema.sql` / `migration_*.sql` are provided for DBAs who prefer plain SQL. Note that
`schema.sql` begins with `CREATE DATABASE/USE nexus_erp` and uses plain `CREATE TABLE`, so
run it only against an empty database. It is **not** compatible with the old 18-table schema
of the very first prototype; if you have such a database, use a new database name.

### 2. Backend (one command starts every module API)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env   — then edit DATABASE_URL / JWT_SECRET_KEY
python seed_db.py               # creates all tables + demo data (only runs on an empty DB)
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs · health: http://localhost:8000/api/health

### 3. Frontend (one command starts the whole UI)

```bash
cd frontend
npm install
copy .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm run dev                     # http://localhost:5173
```
Production build: `npm run build` (output in `frontend/dist`).

## Login

Demo data from `seed_db.py` (every seeded user has password `Password@123`):

| User | Role | Sees |
|---|---|---|
| `ravi@sundarprecision.com` | Owner | everything |
| `meena@sundarprecision.com` | Manager | all modules except company settings |
| `arjun@sundarprecision.com` | Sales Staff | Dashboard + Sales/CRM |
| `karthik@sundarprecision.com` | Accountant | Dashboard + Finance & GST |
| `divya@sundarprecision.com` | Production Staff | Dashboard, Manufacturing, Inventory |

**Change or delete these demo users before any real use**, and set a long random
`JWT_SECRET_KEY`. New companies can be created from `/register`.

## Roles & permissions

Roles are managed under *Roles & Permissions* (view / add / edit / delete / approve per
module). They are enforced in two places: the sidebar hides modules a role cannot view, and
the backend rejects requests with `403` — GET needs *view*, POST *add*, PUT/PATCH *edit*,
DELETE *delete*. Owners bypass the checks.

## Docker

`docker compose up -d db` starts MySQL only. (Backend/frontend Dockerfiles are not
provided; run them with the commands above.) The compose file was not exercised in the
integration testing environment.

## Troubleshooting

- **CORS error in browser** – add your frontend origin to `CORS_ORIGINS` in `backend/.env` (comma separated).
- **`Access denied` / cannot connect to MySQL** – check `DATABASE_URL` in `backend/.env`.
- **`Database already seeded`** – `seed_db.py` only seeds an empty database.
- **403 "Your role does not have permission"** – grant the module in *Roles & Permissions*.
- **Frontend shows blank/401 loop** – clear `localStorage` (`nexus_token`) and log in again.
- **Port in use** – change `--port` (backend) / `--port` for vite and update `VITE_API_BASE_URL`, `CORS_ORIGINS`.
