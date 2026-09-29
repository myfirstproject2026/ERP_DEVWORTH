# Service Desk Module — Integration Guide

Support Tickets, Categories, and SLA Policies — the final module, wired into
everything you have so far.

**Important:** `models.py`, `schemas.py`, `main.py`, `App.jsx`, `services.js`, and
`AppLayout.jsx` in this package are complete replacements containing all seven modules
together. Safe to overwrite what you have.

## 1. Database — run the migration

Non-destructive, adds 4 new tables (ticket_categories, sla_policies, tickets,
ticket_comments). I tested this migration file specifically in isolation — applied it
to a database with every other module but not Service Desk, confirmed it produces the
identical table set as a from-scratch install:

```bash
mysql -u root -p nexus_erp < database/migration_008_service_desk.sql
```

Or if rebuilding from scratch, `database/schema.sql` is the full schema (all seven
modules, 61 tables total).

## 2. Backend — copy into your `backend/` folder, overwriting existing files

```
backend/app/models.py                 → replaces existing (adds TicketCategory,
                                          SlaPolicy, Ticket, TicketComment)
backend/app/schemas.py                → replaces existing (adds Service Desk schemas)
backend/app/main.py                   → replaces existing (registers the
                                          service_desk router)
backend/app/routers/service_desk.py   → NEW file
backend/seed_db.py                    → replaces existing (adds ticket categories,
                                          4 SLA policies by priority, 4 sample tickets
                                          at different stages)
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
frontend/src/App.jsx                          → replaces existing (adds
                                                  /service-desk routes)
frontend/src/api/services.js                  → replaces existing (adds
                                                  serviceDeskApi)
frontend/src/layouts/AppLayout.jsx            → replaces existing (Service Desk is
                                                  no longer "Soon" — this was the
                                                  last module)
frontend/src/layouts/ServiceDeskLayout.jsx    → NEW file (sub-nav + overview cards)
frontend/src/pages/service-desk/*.jsx         → NEW folder, 4 files (Overview,
                                                  Tickets, Categories, SLA Policies)
```

Restart the frontend:
```bash
npm run dev
```

## 4. What you get

- **Tickets** — subject, description, priority, category, assignee, linked customer;
  full status lifecycle (open → in progress → on hold → resolved → closed), with
  reopening a resolved/closed ticket correctly clearing its resolved/closed timestamps
- **SLA breach detection** — computed live against real time, not a stored flag, so it's
  always accurate the moment you look at it rather than needing a background job to
  keep it in sync
- **Comments** — internal notes vs. customer-facing replies are tracked separately;
  the first customer-facing reply automatically marks the ticket's "first response"
  for SLA purposes, internal notes don't count
- **Categories** — organize tickets by issue type, with a live open-ticket count per
  category
- **SLA Policies** — one row per priority level (Urgent/High/Medium/Low) setting
  response and resolution hour targets; editable inline, changing a ticket's priority
  automatically recalculates its due dates against the new policy

## 5. What I found and fixed before shipping this

This module's backend was solid — genuinely the cleanest of all seven, with no date-
comparison bugs like the ones I had to fix in HR and the Dashboard, because SLA breach
status is computed against real current time on every request rather than stored and
compared to a snapshot date. That's the pattern I'd recommend for anything time-
sensitive going forward.

The frontend, however, was incomplete in a way I only found by actually clicking
through it:

- `App.jsx` had zero Service Desk wiring at all — no imports, no routes. Every
  `/service-desk/*` URL silently redirected to the Dashboard.
- The Overview page linked to `/service-desk/sla-policies`, but no page or route
  backed that link — a dead link pointing at a screen that didn't exist yet.

I wired the routes and built the missing SLA Policies page (inline-editable table,
one row per priority, calling the `upsertSlaPolicy` endpoint that already existed in
the API layer but had no UI in front of it). Verified by changing a value through the
actual page, reloading the browser, and confirming it persisted — not just checking
that the API call succeeded.

## 6. API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/service-desk/overview` | Overview cards |
| GET/POST | `/api/service-desk/categories` | List / create ticket categories |
| GET/POST | `/api/service-desk/sla-policies` | List / create-or-update SLA policies |
| GET | `/api/service-desk/tickets` | List tickets (filterable by status, priority, assignee, category, search) |
| GET | `/api/service-desk/tickets/stats` | Ticket stat cards |
| POST | `/api/service-desk/tickets` | Create a ticket (SLA due dates set automatically) |
| GET/PUT/DELETE | `/api/service-desk/tickets/{id}` | Get / update / delete a ticket |
| PUT | `/api/service-desk/tickets/{id}/status` | Change status |
| POST | `/api/service-desk/tickets/{id}/comments` | Add a comment (internal or customer-facing) |

Full interactive docs at `http://localhost:8000/docs` once the backend is running.

## 7. Demo data included

Re-running `seed_db.py` adds: 4 ticket categories, 4 SLA policies (one per priority),
and 4 tickets spanning the full lifecycle — one open and breached (urgent, no response
yet), one in progress within SLA, one resolved, and one fully closed with a complete
comment thread.

Login: `ravi@sundarprecision.com` / `Password@123`

---

## That's all seven modules

Login & Company Setup, Sales + CRM, Inventory, Purchase, Manufacturing, HR & Employee,
Finance & GST, and Service Desk are all built, integrated, and verified against each
other — including the cross-module fixes along the way (Dashboard reflecting real
Manufacturing and HR data instead of static snapshots, and Sales/Purchase actually
flowing into Finance's P&L). The full `nexus-erp.zip` from the start of this project
plus each module's delivery zip together make up the complete system.
