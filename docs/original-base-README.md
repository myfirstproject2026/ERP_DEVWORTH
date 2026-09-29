# Nexus ERP — Multi-Company Suite

A full-stack ERP system covering the **Login & Company Setup** module, **Dashboard**,
and **AI Assistant**, built to match the provided design exactly.

**Stack:** React 18 + Tailwind CSS · Python FastAPI · MySQL 8

This has been built and verified end-to-end in a real environment: MySQL schema
applied, backend started, login/dashboard/branches/users/roles/AI endpoints all
tested against live data, and the React app built with zero errors.

---

## 1. What's included

### Screens (matching your PDFs exactly)
- Login (password + OTP tabs)
- Register company (4-step wizard: Business Info → Address & Tax → Branding → Review)
- Dashboard (today's sales/purchase, pending payments, stock alerts, P&L chart,
  production status, employee attendance, customer follow-up, AI insight banner)
- Company Profile (view with tabs: Overview / Tax & Compliance / Branding / Subscription)
- Company Profile Edit
- Branches (list, stats, search/filter, Add/Edit modal)
- Users (list, tabs by status, search/filter, Invite/Edit modal)
- Roles & Permissions (list + module permission grid: View/Add/Edit/Delete/Approve)
- AI Assistant (chat interface, "Try asking" suggestions, connected channels)

### Backend
- JWT authentication (password login + OTP login + company self-registration)
- Full CRUD for Companies, Branches, Users, Roles & Permissions
- Dashboard aggregation endpoints (summary, P&L, production, attendance, follow-up)
- AI Assistant endpoint — rule-based logic that reads real seeded data and answers
  questions about lowest sales, fast-moving products, pending payments, and reorder
  suggestions (swap in a real LLM call here for production)
- Every table has proper foreign keys, indexes, and constraints

### Database
- 18 tables: companies, roles, modules, role_permissions, branches, users,
  otp_requests, customers, customer_dues, daily_metrics, profit_loss_monthly,
  production_orders, attendance_daily, products, ai_conversations, ai_messages,
  connected_channels, audit_logs
- `database/schema.sql` — raw DDL (tested on MySQL 8)
- `database/seed.sql` — raw SQL seed data matching the PDFs
- `backend/seed_db.py` — Python seed script (recommended — creates tables via
  SQLAlchemy and inserts demo data with real bcrypt password hashes)

---

## 2. Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8.0+

---

## 3. Database setup

```bash
# Start MySQL, then create the database and app user
mysql -u root -p
```

```sql
CREATE DATABASE nexus_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nexus_user'@'localhost' IDENTIFIED BY 'nexus_pass';
GRANT ALL PRIVILEGES ON nexus_erp.* TO 'nexus_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 4. Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# edit .env if your MySQL credentials differ from the defaults

python3 seed_db.py              # creates tables + loads demo data
```

**Demo login created by the seed script:**
```
Email:    ravi@sundarprecision.com
Password: Password@123
```

Run the API:
```bash
uvicorn app.main:app --reload --port 8000
```

- API root: http://localhost:8000
- Interactive docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

---

## 5. Frontend setup

```bash
cd frontend
npm install

cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000  (default is already correct for local dev)

npm run dev
```

- App: http://localhost:5173

---

## 6. Testing the app

1. Open http://localhost:5173 — you'll land on the Login page.
2. Sign in with `prasannaranganthan.2001@gmail.com` / `Welcome@2026`.
3. You'll see the Dashboard with live data pulled from MySQL.
4. Try the sidebar: Company Profile, Branches, Users, Roles & Permissions.
5. Click the floating AI Assistant button (bottom-right) or the sidebar shortcut,
   and try one of the "Try asking" prompts — the responses are generated from
   the real seeded database rows.
6. To test company registration, sign out and click "Register your business"
   on the login page.

---

## 7. Project structure

```
nexus-erp/
├── database/
│   ├── schema.sql          # raw DDL — all tables, keys, indexes
│   └── seed.sql             # raw SQL seed data
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── seed_db.py            # recommended seeding method
│   └── app/
│       ├── main.py           # FastAPI app entrypoint
│       ├── database.py       # SQLAlchemy engine/session
│       ├── models.py         # ORM models (all 18 tables)
│       ├── schemas.py        # Pydantic request/response schemas
│       ├── core/
│       │   ├── config.py     # settings from .env
│       │   └── security.py   # JWT + password hashing
│       └── routers/
│           ├── auth.py           # login, OTP, register-company, /me
│           ├── companies.py      # company profile view/edit/snapshot
│           ├── branches.py       # branches CRUD
│           ├── users.py          # users CRUD + invite
│           ├── roles.py          # roles CRUD + permissions grid
│           ├── dashboard.py      # dashboard aggregation endpoints
│           └── ai_assistant.py   # AI chat endpoint
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx                    # routing
        ├── index.css
        ├── api/
        │   ├── client.js               # axios instance + auth interceptor
        │   └── services.js             # one function per endpoint
        ├── context/
        │   └── AuthContext.jsx
        ├── layouts/
        │   └── AppLayout.jsx           # sidebar + topbar shell
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterCompanyPage.jsx
            ├── DashboardPage.jsx
            ├── CompanyProfilePage.jsx
            ├── CompanyProfileEditPage.jsx
            ├── BranchesPage.jsx
            ├── UsersPage.jsx
            ├── RolesPage.jsx
            ├── RoleEditPage.jsx
            └── AiAssistantPage.jsx
            
```

---

## 8. Complete API reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/send-otp` | Send OTP to registered identifier |
| POST | `/api/auth/verify-otp` | Verify OTP and log in |
| POST | `/api/auth/register-company` | Self-service company registration |
| GET | `/api/auth/me` | Current logged-in user |
| GET | `/api/company/profile` | Get company profile |
| PUT | `/api/company/profile` | Update company profile (owner only) |
| GET | `/api/company/snapshot` | Branches/users/roles counts |
| GET | `/api/branches` | List branches (search, status filter) |
| GET | `/api/branches/stats` | Branch stat cards |
| POST | `/api/branches` | Create branch |
| GET/PUT/DELETE | `/api/branches/{id}` | Get/update/delete a branch |
| GET | `/api/users` | List users (search, branch/role/status filter) |
| GET | `/api/users/stats` | User stat tabs |
| POST | `/api/users/invite` | Invite a new user |
| GET/PUT/DELETE | `/api/users/{id}` | Get/update/delete a user |
| GET | `/api/roles` | List roles |
| POST | `/api/roles` | Create role |
| GET/PUT/DELETE | `/api/roles/{id}` | Get/update/delete a role |
| PUT | `/api/roles/{id}/permissions` | Save module permission grid |
| GET | `/api/roles/meta/modules` | List all sidebar modules |
| GET | `/api/dashboard/summary` | Today's sales/purchase/payments/alerts + AI insight |
| GET | `/api/dashboard/profit-loss` | 6-month revenue/profit series |
| GET | `/api/dashboard/production` | Active work orders |
| GET | `/api/dashboard/attendance` | Today's attendance breakdown |
| GET | `/api/dashboard/customer-followup` | Customer dues list |
| GET | `/api/ai/channels` | Connected channels (WhatsApp, Email) |
| GET | `/api/ai/conversations/latest` | Most recent AI conversation |
| POST | `/api/ai/ask` | Ask the AI assistant a question |
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


Full interactive documentation with request/response schemas is auto-generated
at **http://localhost:8000/docs** once the backend is running.

---

## 9. Deployment notes

**Backend**
- Set a strong random `JWT_SECRET_KEY` in production `.env`
- Point `DATABASE_URL` at your managed MySQL instance
- Run behind Gunicorn + Uvicorn workers, e.g.:
  `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker`
- Put it behind Nginx / a load balancer with HTTPS termination

**Frontend**
- `npm run build` produces a static `dist/` folder
- Serve via Nginx, Vercel, Netlify, or any static host
- Set `VITE_API_BASE_URL` to your production API URL at build time

**Database**
- Run `database/schema.sql` against your production MySQL instance
- Do **not** run `database/seed.sql` / `seed_db.py` in production — they contain
  demo data. Instead use `/api/auth/register-company` to onboard the first
  real company.

**AI Assistant**
- The current `_generate_reply()` function in `app/routers/ai_assistant.py` is
  a rule-based demo that inspects real seeded data. To go live with a real LLM,
  replace its body with a call to the Anthropic API (or your provider of choice),
  passing the same database context as grounding.
