# HR & Employee Module — Integration Guide

Employees, Departments, Leave (types, requests, approvals, balances), Attendance
(daily marking + summary), and Payslips — wired into your existing Login/Sales+CRM/
Inventory/Purchase/Manufacturing setup.

**Important:** `models.py`, `schemas.py`, `main.py`, `App.jsx`, `services.js`, and
`AppLayout.jsx` in this package are complete replacements that already contain all
your previous modules together with the new HR code. Safe to overwrite what you have.

`dashboard.py` is also replaced — see section 5 below for why.

## 1. Database — run the migration

Non-destructive, adds 6 new tables (departments, employees, leave_types,
leave_requests, attendance_records, payslips):

```bash
mysql -u root -p nexus_erp < database/migration_006_hr.sql
```

Or if rebuilding from scratch, `database/schema.sql` is the full updated schema (all
six modules, 51 tables total).

## 2. Backend — copy into your `backend/` folder, overwriting existing files

```
backend/app/models.py              → replaces existing (adds Department, Employee,
                                       LeaveType, LeaveRequest, AttendanceRecord,
                                       Payslip)
backend/app/schemas.py             → replaces existing (adds HR schemas)
backend/app/main.py                → replaces existing (registers the hr router)
backend/app/routers/hr.py          → NEW file
backend/app/routers/dashboard.py   → replaces existing (see section 5 — the
                                       Dashboard's attendance widget now pulls from
                                       real HR attendance records)
backend/seed_db.py                 → replaces existing (adds 4 departments, 5
                                       employees, leave types/requests, today's
                                       attendance, 1 payslip)
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
frontend/src/App.jsx                    → replaces existing (adds /hr routes)
frontend/src/api/services.js            → replaces existing (adds hrApi)
frontend/src/layouts/AppLayout.jsx      → replaces existing (HR & Employee is no
                                            longer "Soon" in the sidebar)
frontend/src/layouts/HrLayout.jsx       → NEW file (sub-nav + overview cards)
frontend/src/pages/hr/*.jsx             → NEW folder, 6 files (Overview, Employees,
                                            Departments, Leave, Attendance, Payslips)
```

Restart the frontend:
```bash
npm run dev
```

## 4. What you get

- **Employees** — auto-numbered employee codes, designation, department, branch,
  employment type, joining date, contact details
- **Departments** — shown as cards with department head and live employee count
- **Leave** — configurable leave types with annual quotas (Casual/Sick/Earned/Unpaid
  by default), employees submit requests, managers approve/reject, and each
  employee's remaining balance per leave type is calculated live (quota − approved
  days used)
- **Attendance** — mark present/absent/half-day/on-leave/holiday/week-off per employee
  per day per branch, with a daily summary
- **Payslips** — basic + HRA + allowances − deductions = net pay, draft → paid
  workflow with a paid-on date
- Overview cards (total employees, active, pending leave requests, on leave today,
  departments) on every HR screen

## 5. Two real bugs I found and fixed

**Bug 1 — stale-date mismatch.** Both `hr.py` and `dashboard.py` originally filtered
attendance by literal `date.today()`. Since demo data was seeded with a hardcoded past
date, "on leave today" and the Dashboard's attendance widget would always silently
show wrong/empty numbers — not a crash, just quietly incorrect. I fixed this two ways:
the endpoints now look up the latest available attendance date instead of assuming
literal today, and the seed script now dates its "today" attendance row dynamically
(using whatever day you actually run it) so a fresh seed always looks right immediately.

**Bug 2 — found while verifying the first fix.** My first fix had a flaw: approving a
leave request auto-creates `on_leave` attendance records for the leave's future dates.
Since my "latest date" query had no upper bound, approving a leave scheduled for next
week would make it the "latest" date and corrupt today's attendance snapshot with
that future leave instead. I caught this by actually testing the interaction (approved
a leave, then watched "on leave today" jump for the wrong reason) rather than just
re-checking the same case that motivated the first fix. Fixed by capping the query at
"latest date that isn't after today."

I verified both fixes with a precise before/after check reading the exact rendered
numbers in a real browser session, not just the API response, and also patched the
same underlying issue into `dashboard.py`'s attendance widget (from the very first
module) so the Dashboard and HR overview agree with each other.

## 6. API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/hr/overview` | Overview cards |
| GET/POST | `/api/hr/departments` | List / create departments |
| GET/PUT/DELETE | `/api/hr/departments/{id}` | Get / update / delete a department |
| GET/POST | `/api/hr/employees` | List / create employees |
| GET | `/api/hr/employees/stats` | Employee stat cards |
| GET/PUT/DELETE | `/api/hr/employees/{id}` | Get / update / delete an employee |
| GET | `/api/hr/employees/{id}/leave-balance` | Per-leave-type balance for an employee |
| GET | `/api/hr/leave-types` | List leave types |
| GET/POST | `/api/hr/leave-requests` | List / submit leave requests |
| PUT | `/api/hr/leave-requests/{id}/decision` | Approve or reject a request |
| GET | `/api/hr/attendance` | List attendance (filterable by date) |
| POST | `/api/hr/attendance/bulk-mark` | Mark a whole branch's attendance for a day |
| GET | `/api/hr/attendance/summary` | Present/absent/on-leave/half-day counts for a date |
| GET/POST | `/api/hr/payslips` | List / create payslips |
| PUT | `/api/hr/payslips/{id}/mark-paid` | Mark a payslip as paid |

Full interactive docs at `http://localhost:8000/docs` once the backend is running.

## 7. Demo data included

Re-running `seed_db.py` adds: 4 departments, 5 employees, 4 leave types, 2 leave
requests (1 approved, 1 pending), today's attendance for all 5 employees, and 1 paid
payslip.

Login: `ravi@sundarprecision.com` / `Password@123`
