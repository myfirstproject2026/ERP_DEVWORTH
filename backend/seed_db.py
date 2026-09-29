"""
Run once after configuring .env and creating the MySQL database:

    python seed_db.py

This creates all tables (if not already created via database/schema.sql)
and inserts demo data identical to the PDF mockups, with real bcrypt
password hashes so you can log in immediately.

Demo login: ravi@sundarprecision.com / Password@123
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from app.database import Base, engine, SessionLocal
from app import models
from app.core.security import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

DEMO_PASSWORD = "Password@123"

try:
    if db.query(models.Company).count() > 0:
        print("Database already seeded. Exiting.")
        raise SystemExit(0)

    # ---------------- MODULES ----------------
    modules_data = [
        ("dashboard", "Dashboard", "main", 1, True),
        ("company_profile", "Company Profile", "login_setup", 2, True),
        ("branches", "Branches", "login_setup", 3, True),
        ("users", "Users", "login_setup", 4, True),
        ("roles_permissions", "Roles & Permissions", "login_setup", 5, True),
        ("sales_crm", "Sales + CRM", "workspace", 6, False),
        ("inventory", "Inventory", "workspace", 7, False),
        ("purchase", "Purchase", "workspace", 8, False),
        ("manufacturing", "Manufacturing", "workspace", 9, False),
        ("hr_employee", "HR & Employee", "workspace", 10, False),
        ("finance_gst", "Finance & GST", "workspace", 11, False),
        ("service_desk", "Service Desk", "workspace", 12, False),
        ("company_settings", "Company Settings", "login_setup", 13, True),
    ]
    modules = {}
    for key, name, cat, order, active in modules_data:
        m = models.Module(module_key=key, module_name=name, category=cat, sort_order=order, is_active=active)
        db.add(m)
        db.flush()
        modules[key] = m

    # ---------------- COMPANY ----------------
    company = models.Company(
        company_name="Sundar Precision Pvt Ltd",
        business_type="Private Limited Company",
        industry="Manufacturing — Precision Tooling",
        cin="U29100TN2015PTC098234",
        contact_number="+91 98410 22456",
        business_email="accounts@sundarprecision.com",
        address_line="Plot 14, SIDCO Industrial Estate, Ambattur",
        city="Chennai",
        state="Tamil Nadu",
        pin_code="600058",
        country="India",
        gstin="33AAECS1234F1Z5",
        pan="AAECS1234F",
        default_gst_rate=18.00,
        financial_year_start="April",
        plan_name="Business",
        plan_billing="billed annually",
        status="active",
        member_since=date(2022, 3, 1),
    )
    db.add(company)
    db.flush()

    # ---------------- ROLES ----------------
    role_defs = [
        ("Owner", "Full access to all modules and settings", "full", True),
        ("Manager", "Access to all modules, no billing/settings", "high", False),
        ("Branch Manager", "Manage assigned branch operations", "medium", False),
        ("Sales Staff", "Sales, CRM and quotations only", "limited", False),
        ("Accountant", "Finance, GST and payment modules", "limited", False),
        ("Production Staff", "Manufacturing and inventory only", "limited", False),
    ]
    roles = {}
    for name, desc, level, is_sys in role_defs:
        r = models.Role(company_id=company.id, role_name=name, description=desc,
                         access_level=level, is_system_role=is_sys)
        db.add(r)
        db.flush()
        roles[name] = r

    # Owner: full access everywhere
    for m in modules.values():
        db.add(models.RolePermission(role_id=roles["Owner"].id, module_id=m.id,
                                      can_view=True, can_add=True, can_edit=True,
                                      can_delete=True, can_approve=True))

    # Manager: all except company_settings
    for m in modules.values():
        allow = m.module_key != "company_settings"
        db.add(models.RolePermission(role_id=roles["Manager"].id, module_id=m.id,
                                      can_view=allow, can_add=allow, can_edit=allow,
                                      can_delete=False, can_approve=allow))

    # Branch Manager grid — exactly matches the PDF screenshot
    branch_mgr_grid = {
        "dashboard":      dict(v=1, a=0, e=0, d=0, ap=0),
        "sales_crm":      dict(v=1, a=1, e=1, d=0, ap=1),
        "inventory":      dict(v=1, a=1, e=1, d=0, ap=0),
        "purchase":       dict(v=1, a=1, e=0, d=0, ap=0),
        "manufacturing":  dict(v=1, a=0, e=0, d=0, ap=0),
        "hr_employee":    dict(v=0, a=0, e=0, d=0, ap=0),
        "finance_gst":    dict(v=1, a=0, e=0, d=0, ap=0),
        "service_desk":   dict(v=1, a=1, e=1, d=0, ap=0),
        "company_settings": dict(v=0, a=0, e=0, d=0, ap=0),
        "company_profile": dict(v=1, a=0, e=0, d=0, ap=0),
        "branches": dict(v=1, a=0, e=0, d=0, ap=0),
        "users": dict(v=1, a=0, e=0, d=0, ap=0),
        "roles_permissions": dict(v=0, a=0, e=0, d=0, ap=0),
    }
    for key, perm in branch_mgr_grid.items():
        m = modules[key]
        db.add(models.RolePermission(role_id=roles["Branch Manager"].id, module_id=m.id,
                                      can_view=bool(perm["v"]), can_add=bool(perm["a"]),
                                      can_edit=bool(perm["e"]), can_delete=bool(perm["d"]),
                                      can_approve=bool(perm["ap"])))

    # Sales Staff
    for m in modules.values():
        allow = m.module_key in ("dashboard", "sales_crm")
        edit_allow = m.module_key == "sales_crm"
        db.add(models.RolePermission(role_id=roles["Sales Staff"].id, module_id=m.id,
                                      can_view=allow, can_add=edit_allow, can_edit=edit_allow,
                                      can_delete=False, can_approve=False))

    # Accountant
    for m in modules.values():
        allow = m.module_key in ("dashboard", "finance_gst")
        edit_allow = m.module_key == "finance_gst"
        db.add(models.RolePermission(role_id=roles["Accountant"].id, module_id=m.id,
                                      can_view=allow, can_add=edit_allow, can_edit=edit_allow,
                                      can_delete=False, can_approve=edit_allow))

    # Production Staff
    for m in modules.values():
        allow = m.module_key in ("dashboard", "manufacturing", "inventory")
        edit_allow = m.module_key in ("manufacturing", "inventory")
        db.add(models.RolePermission(role_id=roles["Production Staff"].id, module_id=m.id,
                                      can_view=allow, can_add=edit_allow, can_edit=(m.module_key == "manufacturing"),
                                      can_delete=False, can_approve=False))

    db.flush()

    # ---------------- BRANCHES ----------------
    branch_defs = [
        ("Chennai HQ (Head Office)", "Head Office", "Plot 14, SIDCO Industrial Estate, Ambattur", "Chennai", "Tamil Nadu", "active", True),
        ("Coimbatore Plant", "Plant", "44/2, SIPCOT Industrial Park, Coimbatore", "Coimbatore", "Tamil Nadu", "active", False),
        ("Bengaluru Sales Office", "Sales Office", "No.9, Residency Road, Bengaluru", "Bengaluru", "Karnataka", "active", False),
        ("Hyderabad Depot", "Depot", "Plot 7, Kukatpally Industrial Area", "Hyderabad", "Telangana", "inactive", False),
    ]
    branches = {}
    for name, btype, addr, city, state, status, is_default in branch_defs:
        b = models.Branch(company_id=company.id, branch_name=name, branch_type=btype,
                           address=addr, city=city, state=state, status=status, is_default=is_default)
        db.add(b)
        db.flush()
        branches[name] = b

    # ---------------- USERS ----------------
    pw_hash = hash_password(DEMO_PASSWORD)
    user_defs = [
        ("Ravi Kumar", "ravi@sundarprecision.com", "+91 98410 22456", "Chennai HQ (Head Office)", "Owner", True, "active", "password"),
        ("Meena Iyer", "meena@sundarprecision.com", "+91 90000 11111", "Coimbatore Plant", "Manager", False, "active", "password"),
        ("Arjun Das", "arjun@sundarprecision.com", "+91 90000 22222", "Bengaluru Sales Office", "Sales Staff", False, "active", "password"),
        ("Priya Reddy", "priya@sundarprecision.com", "+91 90000 33333", "Hyderabad Depot", "Branch Manager", False, "invited", "email_invite"),
        ("Karthik S", "karthik@sundarprecision.com", "+91 90000 44444", "Chennai HQ (Head Office)", "Accountant", False, "active", "password"),
        ("Divya Menon", "divya@sundarprecision.com", "+91 90000 55555", "Coimbatore Plant", "Production Staff", False, "suspended", "password"),
        ("Deepak Nair", "deepak@sundarprecision.com", "+91 90000 66666", "Chennai HQ (Head Office)", "Sales Staff", False, "active", "password"),
        ("Sneha Rao", "sneha@sundarprecision.com", "+91 90000 77777", "Chennai HQ (Head Office)", "Sales Staff", False, "active", "password"),
        ("Farhan Sheikh", "farhan@sundarprecision.com", "+91 90000 88888", "Bengaluru Sales Office", "Sales Staff", False, "active", "password"),
        ("Anita George", "anita@sundarprecision.com", "+91 90000 99999", "Coimbatore Plant", "Sales Staff", False, "active", "password"),
        ("Vikram Shah", "vikram@sundarprecision.com", "+91 90001 11111", "Bengaluru Sales Office", "Sales Staff", False, "active", "password"),
        ("Lakshmi Prasad", "lakshmi@sundarprecision.com", "+91 90001 22222", "Chennai HQ (Head Office)", "Accountant", False, "active", "password"),
        ("Suresh Babu", "suresh@sundarprecision.com", "+91 90001 33333", "Coimbatore Plant", "Production Staff", False, "active", "password"),
        ("Ramesh Pillai", "ramesh@sundarprecision.com", "+91 90001 44444", "Coimbatore Plant", "Branch Manager", False, "active", "password"),
        ("Kavya Menon", "kavya@sundarprecision.com", "+91 90001 55555", "Bengaluru Sales Office", "Branch Manager", False, "active", "password"),
        ("Naveen Kumar", "naveen@sundarprecision.com", "+91 90001 66666", "Hyderabad Depot", "Branch Manager", False, "active", "password"),
        ("Geetha Krishnan", "geetha@sundarprecision.com", "+91 90001 77777", "Chennai HQ (Head Office)", "Manager", False, "active", "password"),
        ("Ashok Reddy", "ashok@sundarprecision.com", "+91 90001 88888", "Coimbatore Plant", "Manager", False, "active", "password"),
    ]
    users = {}
    for name, email, mobile, branch_name, role_name, is_owner, status, login_method in user_defs:
        u = models.User(
            company_id=company.id,
            branch_id=branches[branch_name].id,
            role_id=roles[role_name].id,
            full_name=name,
            email=email,
            mobile_number=mobile,
            password_hash=pw_hash if login_method == "password" else None,
            login_method=login_method,
            is_owner=is_owner,
            status=status,
        )
        db.add(u)
        db.flush()
        users[email] = u

    branches["Chennai HQ (Head Office)"].manager_user_id = users["ravi@sundarprecision.com"].id
    branches["Coimbatore Plant"].manager_user_id = users["meena@sundarprecision.com"].id
    branches["Bengaluru Sales Office"].manager_user_id = users["arjun@sundarprecision.com"].id
    branches["Hyderabad Depot"].manager_user_id = users["priya@sundarprecision.com"].id

    # ---------------- DASHBOARD DATA ----------------
    db.add(models.DailyMetric(
        company_id=company.id, metric_date=date(2026, 7, 7),
        todays_sales=642800, sales_change_pct=12.4,
        todays_purchase=218300, purchase_change_pct=-4.1,
        pending_payments=986200, overdue_invoice_count=14,
        stock_alert_count=7, below_reorder_count=3,
    ))

    pl_data = [("Feb", 1, 32.0, 14.0), ("Mar", 2, 34.5, 16.2), ("Apr", 3, 33.8, 15.5),
               ("May", 4, 36.2, 17.8), ("Jun", 5, 38.0, 19.4), ("Jul", 6, 40.1, 20.6)]
    for label, order, rev, profit in pl_data:
        db.add(models.ProfitLossMonthly(company_id=company.id, month_label=label, month_order=order,
                                         revenue_lakhs=rev, net_profit_lakhs=profit))

    prod_orders = [
        ("WO-1042", "Hex Bolt M8", 5000, "Quality Checking", 78),
        ("WO-1045", "Flange Coupling", 1200, "Machining", 42),
        ("WO-1046", "Bracket Type-A", 3000, "Raw Material Prep", 15),
    ]
    for wo, name, units, stage, pct in prod_orders:
        db.add(models.ProductionOrder(company_id=company.id, wo_number=wo, product_name=name,
                                       units=units, stage=stage, progress_pct=pct))

    db.add(models.AttendanceDaily(company_id=company.id, attendance_date=date(2026, 7, 7),
                                   present_count=42, on_leave_count=5, absent_count=3))

    # ---------------- CUSTOMERS + DUES ----------------
    cust_defs = [
        ("Om Traders", "Retail", "Bengaluru", None),
        ("Shree Fasteners", "Distributor", "Coimbatore", None),
        ("Vasan Autoparts", "OEM", "Chennai", None),
        ("Lakshmi Hardware", "Retail", "Madurai", None),
        ("Sri Ganesh Traders", "Retail", "Kolar", "Kolar Retail Zone"),
        ("New Balaji Stores", "Retail", "Kolar", "Kolar Retail Zone"),
        ("Kolar Hardware Mart", "Retail", "Kolar", "Kolar Retail Zone"),
    ]
    customers = {}
    for name, ctype, city, zone in cust_defs:
        c = models.Customer(company_id=company.id, customer_name=name, customer_type=ctype, city=city, zone=zone)
        db.add(c)
        db.flush()
        customers[name] = c

    due_defs = [
        ("Om Traders", 184500, "overdue", 22, None),
        ("Shree Fasteners", 62000, "due_soon", 0, None),
        ("Vasan Autoparts", 310200, "overdue", 9, None),
        ("Lakshmi Hardware", 28750, "received", 0, None),
        ("Sri Ganesh Traders", 0, "received", 0, 38),
        ("New Balaji Stores", 0, "received", 0, 33),
        ("Kolar Hardware Mart", 142000, "received", 0, 6),
    ]
    for name, amount, status, overdue_days, last_order in due_defs:
        db.add(models.CustomerDue(customer_id=customers[name].id, company_id=company.id, amount=amount,
                                   status=status, days_overdue=overdue_days, last_order_days_ago=last_order))

    # ---------------- PRODUCTS (item master) ----------------
    product_defs = [
        # name, sku, category, uom, hsn, cost, sell, tax, reorder_lvl, reorder_qty, ai-insight fields...
        ("Hex Bolt M8 Series", "HB-M8-001", "Fasteners", "pcs", "7318", 28.00, 42.00, 18.00, 800, 2000,
         4820, 34.0, 2100, 161.5, 42.00, 500),
        ("Flange Coupling", "FC-STD-002", "Couplings", "pcs", "8483", 620.00, 850.00, 18.00, 30, 100,
         210, 8.0, 145, 6.2, 620.00, 60),
        ("Bracket Type-A", "BR-A-003", "Brackets", "pcs", "7326", 140.00, 210.00, 18.00, 200, 500,
         980, 12.0, 640, 28.5, 140.00, 400),
    ]
    products = {}
    for (name, sku, category, uom, hsn, cost, sell, tax, reorder_lvl, reorder_qty,
         units_sold, change_pct, cur_stock, run_rate, supplier_price, reorder_sugg) in product_defs:
        prod = models.Product(
            company_id=company.id, product_name=name, sku=sku, category=category,
            unit_of_measure=uom, hsn_code=hsn, cost_price=cost, selling_price=sell, tax_rate=tax,
            reorder_level=reorder_lvl, reorder_quantity=reorder_qty,
            primary_branch_id=branches["Chennai HQ (Head Office)"].id, status="active",
            units_sold_month=units_sold, change_pct=change_pct, current_stock=cur_stock,
            daily_run_rate=run_rate, supplier_price=supplier_price, reorder_suggested_units=reorder_sugg,
        )
        db.add(prod)
        db.flush()
        products[name] = prod

    # ---------------- STOCK LEVELS (per product per branch) ----------------
    stock_defs = [
        ("Hex Bolt M8 Series", "Chennai HQ (Head Office)", 2100, 150),
        ("Hex Bolt M8 Series", "Coimbatore Plant", 1350, 0),
        ("Flange Coupling", "Coimbatore Plant", 145, 20),
        ("Flange Coupling", "Chennai HQ (Head Office)", 40, 0),
        ("Bracket Type-A", "Coimbatore Plant", 640, 0),
        ("Bracket Type-A", "Bengaluru Sales Office", 85, 0),
    ]
    stock_levels = {}
    for prod_name, branch_name, on_hand, reserved in stock_defs:
        sl = models.StockLevel(
            company_id=company.id, product_id=products[prod_name].id, branch_id=branches[branch_name].id,
            quantity_on_hand=on_hand, quantity_reserved=reserved,
        )
        db.add(sl)
        db.flush()
        stock_levels[(prod_name, branch_name)] = sl

    # ---------------- STOCK MOVEMENTS (ledger history) ----------------
    movement_defs = [
        ("Hex Bolt M8 Series", "Chennai HQ (Head Office)", "purchase_in", 2500, 2500, "karthik@sundarprecision.com", "Initial stock — PO-0091"),
        ("Hex Bolt M8 Series", "Chennai HQ (Head Office)", "sale_out", 400, 2100, "arjun@sundarprecision.com", "Sold via SO-00002"),
        ("Flange Coupling", "Coimbatore Plant", "purchase_in", 200, 200, "meena@sundarprecision.com", "Initial stock — PO-0088"),
        ("Flange Coupling", "Coimbatore Plant", "sale_out", 55, 145, "deepak@sundarprecision.com", "Sold via SO-00001"),
        ("Bracket Type-A", "Coimbatore Plant", "purchase_in", 700, 700, "meena@sundarprecision.com", "Initial stock — PO-0095"),
        ("Bracket Type-A", "Coimbatore Plant", "adjustment_out", 60, 640, "suresh@sundarprecision.com", "Damaged in handling"),
    ]
    for prod_name, branch_name, mtype, qty, balance, user_email, note in movement_defs:
        db.add(models.StockMovement(
            company_id=company.id, product_id=products[prod_name].id, branch_id=branches[branch_name].id,
            movement_type=mtype, quantity=qty, balance_after=balance,
            created_by_user_id=users[user_email].id, notes=note,
        ))

    # ---------------- STOCK TRANSFER (Chennai -> Bengaluru, completed) ----------------
    transfer = models.StockTransfer(
        company_id=company.id, transfer_number="TR-00001",
        from_branch_id=branches["Coimbatore Plant"].id, to_branch_id=branches["Bengaluru Sales Office"].id,
        transfer_date=date(2026, 7, 8), status="completed", notes="Restocking Bengaluru showroom",
        created_by_user_id=users["meena@sundarprecision.com"].id,
    )
    db.add(transfer)
    db.flush()
    db.add(models.StockTransferItem(
        transfer_id=transfer.id, product_id=products["Bracket Type-A"].id, quantity=85, received_quantity=85,
    ))

    # ---------------- STOCK ADJUSTMENT (completed, matches the adjustment_out movement above) ----------------
    adjustment = models.StockAdjustment(
        company_id=company.id, branch_id=branches["Coimbatore Plant"].id, adjustment_number="ADJ-00001",
        adjustment_date=date(2026, 7, 9), reason="damage", status="completed",
        notes="Forklift damage during unloading", created_by_user_id=users["suresh@sundarprecision.com"].id,
    )
    db.add(adjustment)
    db.flush()
    db.add(models.StockAdjustmentItem(
        adjustment_id=adjustment.id, product_id=products["Bracket Type-A"].id,
        quantity_change=-60, reason_note="6 cartons damaged, written off",
    ))

    # ---------------- CONNECTED CHANNELS ----------------
    db.add(models.ConnectedChannel(company_id=company.id, channel_name="WhatsApp Business", status="connected"))
    db.add(models.ConnectedChannel(company_id=company.id, channel_name="Email", status="connected"))

    # ---------------- AI CONVERSATION SEED ----------------
    conv = models.AiConversation(company_id=company.id, user_id=users["ravi@sundarprecision.com"].id,
                                  title="This month sales lowest — tell me")
    db.add(conv)
    db.flush()
    db.add(models.AiMessage(conversation_id=conv.id, sender="user", content="This month sales lowest — tell me"))
    db.add(models.AiMessage(conversation_id=conv.id, sender="assistant",
        content=("Kolar Retail Zone has the lowest sales this month — ₹1,42,000, down 18% from last month. "
                 "Two customers in that zone haven't ordered in over 30 days.")))
    db.add(models.AiMessage(conversation_id=conv.id, sender="user", content="Which product is fast moving right now?"))
    db.add(models.AiMessage(conversation_id=conv.id, sender="assistant",
        content=("Hex Bolt M8 Series is your fastest-moving product — 4,820 units sold this month, +34% over "
                 "last month. At this pace, current stock (2,100 units) runs out in 13 days. Based on the trend, "
                 "I'd suggest ordering around 500 units for next month at the current supplier price of ₹42/unit "
                 "to stay ahead of demand.")))

    # ---------------- SALES + CRM DEMO DATA ----------------
    from datetime import date as _date, timedelta as _timedelta

    sales_customers = {n: c for n, c in customers.items()}  # reuse dashboard customers as CRM customers too
    om_traders = sales_customers["Om Traders"]
    vasan_autoparts = sales_customers["Vasan Autoparts"]
    shree_fasteners = sales_customers["Shree Fasteners"]

    # enrich a couple of customers with CRM-specific fields
    om_traders.email = "purchase@omtraders.in"
    om_traders.gstin = "29AACOT1234F1Z8"
    om_traders.billing_address = "12 MG Road, Bengaluru, Karnataka 560001"
    om_traders.status = "active"
    om_traders.assigned_to_user_id = users["arjun@sundarprecision.com"].id

    vasan_autoparts.email = "accounts@vasanauto.in"
    vasan_autoparts.gstin = "33AAVAP5678K1Z2"
    vasan_autoparts.billing_address = "45 Anna Salai, Chennai, Tamil Nadu 600002"
    vasan_autoparts.status = "active"
    vasan_autoparts.assigned_to_user_id = users["deepak@sundarprecision.com"].id

    # ---- Leads ----
    lead_defs = [
        ("Nandhini Castings", "Nandhini Industries", "Suresh Nandhini", "suresh@nandhinicastings.in",
         "+91 90200 12121", "referral", "qualified", 350000, "arjun@sundarprecision.com"),
        ("Coastal Traders", "Coastal Traders Pvt Ltd", "Meera Pillai", "meera@coastaltraders.in",
         "+91 90200 34343", "website", "new", 120000, "deepak@sundarprecision.com"),
        ("Bharat Fittings Co.", "Bharat Fittings", "Ajay Kumar", "ajay@bharatfittings.in",
         "+91 90200 56565", "trade_show", "proposal", 480000, "sneha@sundarprecision.com"),
    ]
    leads = {}
    for lead_name, company_name, contact, email, phone, source, status, est_val, owner_email in lead_defs:
        ld = models.Lead(
            company_id=company.id, lead_name=lead_name, company_name=company_name,
            contact_person=contact, email=email, phone=phone, source=source, status=status,
            estimated_value=est_val, assigned_to_user_id=users[owner_email].id,
        )
        db.add(ld)
        db.flush()
        leads[lead_name] = ld

    # ---- Quotations ----
    def _line_total(qty, price, tax_rate):
        base = qty * price
        return base + (base * tax_rate / 100)

    quotations = {}
    q1_items = [
        ("Hex Bolt M8 Series", "Grade 8.8, zinc plated", 2000, "pcs", 42.00, 18),
        ("Flange Coupling", "Standard duty", 50, "pcs", 850.00, 18),
    ]
    q1_subtotal = sum(qty * price for _, _, qty, _, price, _ in q1_items)
    q1_tax = sum(qty * price * tax / 100 for _, _, qty, _, price, tax in q1_items)
    q1 = models.Quotation(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        quotation_number="QT-00001", customer_id=om_traders.id, quotation_date=_date(2026, 7, 2),
        valid_until=_date(2026, 7, 22), status="sent",
        subtotal=q1_subtotal, tax_amount=q1_tax, total_amount=q1_subtotal + q1_tax,
        created_by_user_id=users["arjun@sundarprecision.com"].id,
    )
    db.add(q1)
    db.flush()
    for name, desc, qty, unit, price, tax in q1_items:
        db.add(models.QuotationItem(quotation_id=q1.id, product_name=name, description=desc,
                                     quantity=qty, unit=unit, unit_price=price, tax_rate=tax,
                                     line_total=_line_total(qty, price, tax)))
    quotations["QT-00001"] = q1

    q2_items = [("Bracket Type-A", "Powder coated", 800, "pcs", 210.00, 18)]
    q2_subtotal = sum(qty * price for _, _, qty, _, price, _ in q2_items)
    q2_tax = sum(qty * price * tax / 100 for _, _, qty, _, price, tax in q2_items)
    q2 = models.Quotation(
        company_id=company.id, branch_id=branches["Coimbatore Plant"].id,
        quotation_number="QT-00002", customer_id=vasan_autoparts.id, quotation_date=_date(2026, 7, 10),
        valid_until=_date(2026, 7, 30), status="accepted",
        subtotal=q2_subtotal, tax_amount=q2_tax, total_amount=q2_subtotal + q2_tax,
        created_by_user_id=users["deepak@sundarprecision.com"].id,
    )
    db.add(q2)
    db.flush()
    for name, desc, qty, unit, price, tax in q2_items:
        db.add(models.QuotationItem(quotation_id=q2.id, product_name=name, description=desc,
                                     quantity=qty, unit=unit, unit_price=price, tax_rate=tax,
                                     line_total=_line_total(qty, price, tax)))
    quotations["QT-00002"] = q2

    # ---- Sales Orders (one converted from the accepted quotation) ----
    so1_items = q2_items
    so1 = models.SalesOrder(
        company_id=company.id, branch_id=branches["Coimbatore Plant"].id,
        order_number="SO-00001", customer_id=vasan_autoparts.id, quotation_id=q2.id,
        order_date=_date(2026, 7, 11), expected_delivery_date=_date(2026, 7, 25), status="processing",
        subtotal=q2_subtotal, tax_amount=q2_tax, total_amount=q2_subtotal + q2_tax,
        created_by_user_id=users["deepak@sundarprecision.com"].id,
    )
    db.add(so1)
    db.flush()
    for name, desc, qty, unit, price, tax in so1_items:
        db.add(models.SalesOrderItem(sales_order_id=so1.id, product_name=name, description=desc,
                                      quantity=qty, unit=unit, unit_price=price, tax_rate=tax,
                                      line_total=_line_total(qty, price, tax)))

    so2_items = [("Hex Bolt M8 Series", "Grade 8.8, zinc plated", 1200, "pcs", 42.00, 18)]
    so2_subtotal = sum(qty * price for _, _, qty, _, price, _ in so2_items)
    so2_tax = sum(qty * price * tax / 100 for _, _, qty, _, price, tax in so2_items)
    so2 = models.SalesOrder(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        order_number="SO-00002", customer_id=shree_fasteners.id, quotation_id=None,
        order_date=_date(2026, 7, 5), expected_delivery_date=_date(2026, 7, 15), status="completed",
        subtotal=so2_subtotal, tax_amount=so2_tax, total_amount=so2_subtotal + so2_tax,
        created_by_user_id=users["arjun@sundarprecision.com"].id,
    )
    db.add(so2)
    db.flush()
    for name, desc, qty, unit, price, tax in so2_items:
        db.add(models.SalesOrderItem(sales_order_id=so2.id, product_name=name, description=desc,
                                      quantity=qty, unit=unit, unit_price=price, tax_rate=tax,
                                      line_total=_line_total(qty, price, tax)))

    # ---- Invoices ----
    inv1_total = so2_subtotal + so2_tax
    inv1 = models.Invoice(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        invoice_number="INV-00001", customer_id=shree_fasteners.id, sales_order_id=so2.id,
        invoice_date=_date(2026, 7, 16), due_date=_date(2026, 7, 26), status="paid",
        subtotal=so2_subtotal, tax_amount=so2_tax, total_amount=inv1_total, amount_paid=inv1_total,
        created_by_user_id=users["karthik@sundarprecision.com"].id,
    )
    db.add(inv1)
    db.flush()
    for name, desc, qty, unit, price, tax in so2_items:
        db.add(models.InvoiceItem(invoice_id=inv1.id, product_name=name, description=desc,
                                   quantity=qty, unit=unit, unit_price=price, tax_rate=tax,
                                   line_total=_line_total(qty, price, tax)))
    db.add(models.InvoicePayment(invoice_id=inv1.id, amount=inv1_total, payment_date=_date(2026, 7, 18),
                                  payment_method="bank_transfer", reference_number="UTR2607180234"))

    inv2_total = q1_subtotal + q1_tax
    inv2 = models.Invoice(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        invoice_number="INV-00002", customer_id=om_traders.id, sales_order_id=None,
        invoice_date=_date(2026, 6, 26), due_date=_date(2026, 7, 6), status="overdue",
        subtotal=q1_subtotal, tax_amount=q1_tax, total_amount=inv2_total, amount_paid=0,
        created_by_user_id=users["karthik@sundarprecision.com"].id,
    )
    db.add(inv2)
    db.flush()
    for name, desc, qty, unit, price, tax in q1_items:
        db.add(models.InvoiceItem(invoice_id=inv2.id, product_name=name, description=desc,
                                   quantity=qty, unit=unit, unit_price=price, tax_rate=tax,
                                   line_total=_line_total(qty, price, tax)))

    # ---------------- PURCHASE MODULE DEMO DATA ----------------
    supplier_defs = [
        ("Sundaram Steel & Alloys", "Ravikumar Nair", "sales@sundaramsteel.in", "+91 90300 12121",
         "33AASST9876K1Z4", "Plot 22, Guindy Industrial Estate, Chennai", "Raw Material", "Net 30", 4, "active"),
        ("Chennai Fasteners Supply Co.", "Lakshmi Narayan", "orders@chennaifasteners.in", "+91 90300 34343",
         "33AACFS4321L1Z9", "14 Ambattur Industrial Estate, Chennai", "Fasteners", "Net 15", 5, "active"),
        ("Coimbatore Precision Castings", "Murugan S", "info@cbecastings.in", "+91 90300 56565",
         "33AACPC6789M1Z2", "SIPCOT Industrial Park, Coimbatore", "Castings", "Net 45", 3, "active"),
    ]
    suppliers = {}
    for name, contact, email, phone, gstin, addr, category, terms, rating, status in supplier_defs:
        s = models.Supplier(
            company_id=company.id, supplier_name=name, contact_person=contact, email=email, phone=phone,
            gstin=gstin, billing_address=addr, category=category, payment_terms=terms, rating=rating,
            status=status, assigned_to_user_id=users["meena@sundarprecision.com"].id,
        )
        db.add(s)
        db.flush()
        suppliers[name] = s

    # ---- Purchase Order 1: fully received (so we can show a completed GRN) ----
    po1_items = [
        ("Hex Bolt M8 Series", "Grade 8.8, zinc plated", 2500, "pcs", 28.00, 18, products["Hex Bolt M8 Series"].id),
    ]
    po1_subtotal = sum(qty * price for _, _, qty, _, price, _, _ in po1_items)
    po1_tax = sum(qty * price * tax / 100 for _, _, qty, _, price, tax, _ in po1_items)
    po1 = models.PurchaseOrder(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        po_number="PO-00001", supplier_id=suppliers["Chennai Fasteners Supply Co."].id,
        po_date=_date(2026, 7, 1), expected_delivery_date=_date(2026, 7, 8), status="received",
        subtotal=po1_subtotal, tax_amount=po1_tax, total_amount=po1_subtotal + po1_tax,
        notes="Monthly restock — Chennai HQ", created_by_user_id=users["karthik@sundarprecision.com"].id,
    )
    db.add(po1)
    db.flush()
    po1_item_objs = []
    for name, desc, qty, unit, price, tax, prod_id in po1_items:
        poi = models.PurchaseOrderItem(purchase_order_id=po1.id, product_id=prod_id, product_name=name,
                                        description=desc, quantity=qty, unit=unit, unit_price=price,
                                        tax_rate=tax, line_total=_line_total(qty, price, tax),
                                        received_quantity=qty)
        db.add(poi)
        po1_item_objs.append(poi)
    db.flush()

    grn1 = models.PurchaseReceipt(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        grn_number="GRN-00001", purchase_order_id=po1.id, receipt_date=_date(2026, 7, 8),
        status="completed", notes="Received in full, no damage",
        created_by_user_id=users["karthik@sundarprecision.com"].id,
    )
    db.add(grn1)
    db.flush()
    for poi in po1_item_objs:
        db.add(models.PurchaseReceiptItem(purchase_receipt_id=grn1.id, purchase_order_item_id=poi.id,
                                           product_id=poi.product_id, product_name=poi.product_name,
                                           quantity_received=poi.quantity, unit=poi.unit))

    # ---- Purchase Order 2: partially received, still open ----
    po2_items = [
        ("Bracket Type-A", "Powder coated", 500, "pcs", 140.00, 18, products["Bracket Type-A"].id),
    ]
    po2_subtotal = sum(qty * price for _, _, qty, _, price, _, _ in po2_items)
    po2_tax = sum(qty * price * tax / 100 for _, _, qty, _, price, tax, _ in po2_items)
    po2 = models.PurchaseOrder(
        company_id=company.id, branch_id=branches["Coimbatore Plant"].id,
        po_number="PO-00002", supplier_id=suppliers["Coimbatore Precision Castings"].id,
        po_date=_date(2026, 7, 20), expected_delivery_date=_date(2026, 8, 3), status="confirmed",
        subtotal=po2_subtotal, tax_amount=po2_tax, total_amount=po2_subtotal + po2_tax,
        notes="Coimbatore plant restock", created_by_user_id=users["meena@sundarprecision.com"].id,
    )
    db.add(po2)
    db.flush()
    for name, desc, qty, unit, price, tax, prod_id in po2_items:
        db.add(models.PurchaseOrderItem(purchase_order_id=po2.id, product_id=prod_id, product_name=name,
                                         description=desc, quantity=qty, unit=unit, unit_price=price,
                                         tax_rate=tax, line_total=_line_total(qty, price, tax)))

    # ---- Purchase Bills ----
    bill1_total = po1_subtotal + po1_tax
    bill1 = models.PurchaseBill(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        bill_number="BILL-00001", supplier_id=suppliers["Chennai Fasteners Supply Co."].id,
        purchase_order_id=po1.id, bill_date=_date(2026, 7, 9), due_date=_date(2026, 7, 24),
        status="paid", subtotal=po1_subtotal, tax_amount=po1_tax, total_amount=bill1_total,
        amount_paid=bill1_total, created_by_user_id=users["karthik@sundarprecision.com"].id,
    )
    db.add(bill1)
    db.flush()
    for name, desc, qty, unit, price, tax, _ in po1_items:
        db.add(models.PurchaseBillItem(purchase_bill_id=bill1.id, product_name=name, description=desc,
                                        quantity=qty, unit=unit, unit_price=price, tax_rate=tax,
                                        line_total=_line_total(qty, price, tax)))
    db.add(models.PurchaseBillPayment(purchase_bill_id=bill1.id, company_id=company.id, amount=bill1_total,
                                       payment_date=_date(2026, 7, 20), payment_method="bank_transfer",
                                       reference_number="UTR2607200456"))

    bill2_items = [("Raw M8 Steel Rod (6m)", "For in-house bolt production", 400, "pcs", 95.00, 18, None)]
    bill2_subtotal = sum(qty * price for _, _, qty, _, price, _, _ in bill2_items)
    bill2_tax = sum(qty * price * tax / 100 for _, _, qty, _, price, tax, _ in bill2_items)
    bill2_total = bill2_subtotal + bill2_tax
    bill2 = models.PurchaseBill(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        bill_number="BILL-00002", supplier_id=suppliers["Sundaram Steel & Alloys"].id,
        purchase_order_id=None, bill_date=_date(2026, 6, 25), due_date=_date(2026, 7, 10),
        status="overdue", subtotal=bill2_subtotal, tax_amount=bill2_tax, total_amount=bill2_total,
        amount_paid=0, created_by_user_id=users["karthik@sundarprecision.com"].id,
    )
    db.add(bill2)
    db.flush()
    for name, desc, qty, unit, price, tax, _ in bill2_items:
        db.add(models.PurchaseBillItem(purchase_bill_id=bill2.id, product_name=name, description=desc,
                                        quantity=qty, unit=unit, unit_price=price, tax_rate=tax,
                                        line_total=_line_total(qty, price, tax)))

    # ---------------- MANUFACTURING MODULE DEMO DATA ----------------
    raw_material_defs = [
        ("M8 Steel Rod (6m)", "RM-STEEL-M8", "Raw Material", "pcs", "7213", 95.00, 0, 0.00,
         100, 500, 0, 0, 900, 0, 95.00, 0),
        ("Zinc Coating Compound (kg)", "RM-ZINC-01", "Raw Material", "kg", "3212", 180.00, 0, 0.00,
         20, 100, 0, 0, 140, 0, 180.00, 0),
    ]
    for (name, sku, category, uom, hsn, cost, sell, tax, reorder_lvl, reorder_qty,
         units_sold, change_pct, cur_stock, run_rate, supplier_price, reorder_sugg) in raw_material_defs:
        rm = models.Product(
            company_id=company.id, product_name=name, sku=sku, category=category,
            unit_of_measure=uom, hsn_code=hsn, cost_price=cost, selling_price=sell or cost, tax_rate=tax,
            reorder_level=reorder_lvl, reorder_quantity=reorder_qty,
            primary_branch_id=branches["Chennai HQ (Head Office)"].id, status="active",
            units_sold_month=units_sold, change_pct=change_pct, current_stock=cur_stock,
            daily_run_rate=run_rate, supplier_price=supplier_price, reorder_suggested_units=reorder_sugg,
        )
        db.add(rm)
        db.flush()
        products[name] = rm
        db.add(models.StockLevel(company_id=company.id, product_id=rm.id,
                                  branch_id=branches["Chennai HQ (Head Office)"].id,
                                  quantity_on_hand=cur_stock, quantity_reserved=0))

    # ---- Work Centers ----
    wc1 = models.WorkCenter(company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
                             name="CNC Line 1", code="CNC-01", description="Precision turning & threading",
                             capacity_per_day=1200, status="active")
    wc2 = models.WorkCenter(company_id=company.id, branch_id=branches["Coimbatore Plant"].id,
                             name="Assembly Line A", code="ASM-A", description="Manual assembly and QC",
                             capacity_per_day=600, status="active")
    db.add_all([wc1, wc2])
    db.flush()

    # ---- Bill of Materials: Hex Bolt M8 Series ----
    bom1 = models.BillOfMaterials(company_id=company.id, product_id=products["Hex Bolt M8 Series"].id,
                                   bom_name="Standard Hex Bolt M8", version="v1", status="active",
                                   notes="Zinc-plated, grade 8.8")
    db.add(bom1)
    db.flush()
    db.add_all([
        models.BomComponent(bom_id=bom1.id, component_product_id=products["M8 Steel Rod (6m)"].id,
                             quantity_required=0.05, unit="pcs"),
        models.BomComponent(bom_id=bom1.id, component_product_id=products["Zinc Coating Compound (kg)"].id,
                             quantity_required=0.01, unit="kg"),
    ])

    # ---- Work Orders ----
    wo1 = models.WorkOrder(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id, wo_number="WO-1042",
        product_id=products["Hex Bolt M8 Series"].id, bom_id=bom1.id, work_center_id=wc1.id,
        quantity_planned=5000, quantity_completed=0, status="in_progress", priority="high",
        current_stage="Quality Checking", progress_pct=78, materials_issued=True,
        start_date=_date(2026, 7, 20), due_date=_date(2026, 8, 1),
        created_by_user_id=users["meena@sundarprecision.com"].id,
    )
    wo2 = models.WorkOrder(
        company_id=company.id, branch_id=branches["Coimbatore Plant"].id, wo_number="WO-1043",
        product_id=products["Flange Coupling"].id, bom_id=None, work_center_id=wc2.id,
        quantity_planned=1200, quantity_completed=0, status="in_progress", priority="medium",
        current_stage="Machining", progress_pct=42, materials_issued=True,
        start_date=_date(2026, 7, 22), due_date=_date(2026, 8, 5),
        created_by_user_id=users["meena@sundarprecision.com"].id,
    )
    wo3 = models.WorkOrder(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id, wo_number="WO-1044",
        product_id=products["Bracket Type-A"].id, bom_id=None, work_center_id=None,
        quantity_planned=3000, quantity_completed=0, status="draft", priority="low",
        current_stage="Raw Material Prep", progress_pct=0, materials_issued=False,
        due_date=_date(2026, 8, 10), created_by_user_id=users["ravi@sundarprecision.com"].id,
    )
    db.add_all([wo1, wo2, wo3])
    db.flush()

    db.add(models.MaterialIssue(work_order_id=wo1.id, company_id=company.id,
                                 component_product_id=products["M8 Steel Rod (6m)"].id, quantity_issued=250,
                                 branch_id=branches["Chennai HQ (Head Office)"].id,
                                 issued_by_user_id=users["meena@sundarprecision.com"].id))
    db.add(models.MaterialIssue(work_order_id=wo1.id, company_id=company.id,
                                 component_product_id=products["Zinc Coating Compound (kg)"].id, quantity_issued=50,
                                 branch_id=branches["Chennai HQ (Head Office)"].id,
                                 issued_by_user_id=users["meena@sundarprecision.com"].id))

    # ---------------- HR & EMPLOYEE MODULE DEMO DATA ----------------
    dept_defs = [
        ("Production", "meena@sundarprecision.com"),
        ("Sales", "arjun@sundarprecision.com"),
        ("Finance", "karthik@sundarprecision.com"),
        ("Administration", "ravi@sundarprecision.com"),
    ]
    departments = {}
    for name, head_email in dept_defs:
        dept = models.Department(company_id=company.id, department_name=name,
                                  head_user_id=users[head_email].id)
        db.add(dept)
        db.flush()
        departments[name] = dept

    leave_type_defs = [("Casual Leave", 12, True), ("Sick Leave", 8, True), ("Earned Leave", 15, True), ("Unpaid Leave", 0, False)]
    leave_types = {}
    for name, quota, paid in leave_type_defs:
        lt = models.LeaveType(company_id=company.id, leave_type_name=name, annual_quota=quota, is_paid=paid)
        db.add(lt)
        db.flush()
        leave_types[name] = lt

    employee_defs = [
        ("EMP-1001", "Suresh Babu", "Production Operator", "Production", "Coimbatore Plant", "suresh@sundarprecision.com", date(2022, 6, 1), "active"),
        ("EMP-1002", "Divya Menon", "Production Supervisor", "Production", "Coimbatore Plant", "divya@sundarprecision.com", date(2021, 3, 15), "active"),
        ("EMP-1003", "Arjun Das", "Sales Executive", "Sales", "Bengaluru Sales Office", "arjun@sundarprecision.com", date(2023, 1, 10), "active"),
        ("EMP-1004", "Karthik S", "Accountant", "Finance", "Chennai HQ (Head Office)", "karthik@sundarprecision.com", date(2020, 8, 20), "active"),
        ("EMP-1005", "Meena Iyer", "Plant Manager", "Production", "Coimbatore Plant", "meena@sundarprecision.com", date(2019, 11, 5), "active"),
    ]
    employees = {}
    for code, name, designation, dept_name, branch_name, user_email, doj, status in employee_defs:
        emp = models.Employee(
            company_id=company.id, user_id=users[user_email].id, branch_id=branches[branch_name].id,
            department_id=departments[dept_name].id, employee_code=code, full_name=name,
            designation=designation, employment_type="full_time", date_of_joining=doj,
            phone=users[user_email].mobile_number, personal_email=user_email, status=status,
        )
        db.add(emp)
        db.flush()
        employees[code] = emp

    # a couple of leave requests — one pending, one approved
    db.add(models.LeaveRequest(
        company_id=company.id, employee_id=employees["EMP-1001"].id, leave_type_id=leave_types["Sick Leave"].id,
        start_date=date(2026, 7, 29), end_date=date(2026, 7, 30), total_days=2,
        reason="Fever", status="pending",
    ))
    approved_leave = models.LeaveRequest(
        company_id=company.id, employee_id=employees["EMP-1003"].id, leave_type_id=leave_types["Casual Leave"].id,
        start_date=date(2026, 7, 20), end_date=date(2026, 7, 20), total_days=1,
        reason="Personal work", status="approved", approved_by_user_id=users["ravi@sundarprecision.com"].id,
    )
    db.add(approved_leave)

    # today's attendance for all 5 seeded employees
    today_attendance = [
        ("EMP-1001", "present"), ("EMP-1002", "present"), ("EMP-1003", "present"),
        ("EMP-1004", "half_day"), ("EMP-1005", "present"),
    ]
    for code, status in today_attendance:
        emp = employees[code]
        db.add(models.AttendanceRecord(
            company_id=company.id, employee_id=emp.id, branch_id=emp.branch_id,
            attendance_date=date.today(), status=status,
        ))

    # one finalized payslip
    basic, hra, allowances, deductions = 35000, 14000, 5000, 4200
    db.add(models.Payslip(
        company_id=company.id, employee_id=employees["EMP-1004"].id, pay_month=6, pay_year=2026,
        basic=basic, hra=hra, other_allowances=allowances, deductions=deductions,
        net_pay=basic + hra + allowances - deductions, status="paid", paid_on=date(2026, 7, 1),
        generated_by_user_id=users["karthik@sundarprecision.com"].id,
    ))

    # ---------------- FINANCE & GST DEMO DATA ----------------
    coa_defs = [
        ("1000", "Cash", "asset", True),
        ("1010", "Bank — HDFC Current A/C", "asset", True),
        ("1200", "Accounts Receivable", "asset", True),
        ("2000", "Accounts Payable", "liability", True),
        ("2100", "GST Payable", "liability", True),
        ("3000", "Owner's Equity", "equity", True),
        ("4000", "Sales Revenue", "income", True),
        ("5000", "Cost of Goods Sold", "expense", True),
        ("5100", "Rent Expense", "expense", False),
        ("5200", "Utilities Expense", "expense", False),
        ("5300", "Office Supplies Expense", "expense", False),
        ("5400", "Travel & Conveyance", "expense", False),
    ]
    accounts = {}
    for code, name, atype, is_sys in coa_defs:
        a = models.ChartOfAccount(company_id=company.id, account_code=code, account_name=name,
                                   account_type=atype, is_system=is_sys)
        db.add(a)
        db.flush()
        accounts[code] = a

    bank = models.BankAccount(
        company_id=company.id, account_name="Sundar Precision — Current Account", bank_name="HDFC Bank",
        account_number="50100234567890", ifsc_code="HDFC0001234", account_type="current",
        opening_balance=1500000, current_balance=1500000, is_primary=True, status="active",
    )
    db.add(bank)
    db.flush()

    # posted journal entry: owner's capital introduction
    je1 = models.JournalEntry(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id, entry_number="JE-00001",
        entry_date=date(2026, 4, 1), reference="Capital", narration="Owner's capital introduced",
        status="posted", total_debit=1500000, total_credit=1500000, source_type="manual",
        created_by_user_id=users["karthik@sundarprecision.com"].id, posted_at=datetime(2026, 4, 1, 10, 0, 0),
    )
    db.add(je1)
    db.flush()
    db.add(models.JournalEntryLine(journal_entry_id=je1.id, account_id=accounts["1010"].id,
                                    debit_amount=1500000, credit_amount=0, description="Capital deposited"))
    db.add(models.JournalEntryLine(journal_entry_id=je1.id, account_id=accounts["3000"].id,
                                    debit_amount=0, credit_amount=1500000, description="Owner's equity"))

    # draft journal entry: rent accrual not yet posted
    je2 = models.JournalEntry(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id, entry_number="JE-00002",
        entry_date=date(2026, 7, 30), reference="Rent", narration="July rent accrual — pending review",
        status="draft", total_debit=45000, total_credit=45000, source_type="manual",
        created_by_user_id=users["karthik@sundarprecision.com"].id,
    )
    db.add(je2)
    db.flush()
    db.add(models.JournalEntryLine(journal_entry_id=je2.id, account_id=accounts["5100"].id,
                                    debit_amount=45000, credit_amount=0, description="Chennai HQ rent — July"))
    db.add(models.JournalEntryLine(journal_entry_id=je2.id, account_id=accounts["2000"].id,
                                    debit_amount=0, credit_amount=45000, description="Payable to landlord"))

    # a paid expense (deducted from bank) and a pending one
    exp1_amount, exp1_tax = 8500, Decimal("1530.00")
    exp1 = models.Expense(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id, expense_number="EXP-00001",
        expense_date=date(2026, 7, 15), category="Utilities", account_id=accounts["5200"].id,
        vendor_name="Tamil Nadu Electricity Board", description="July electricity bill — Chennai HQ",
        amount=exp1_amount, tax_rate=18, tax_amount=exp1_tax, total_amount=exp1_amount + exp1_tax,
        payment_method="bank_transfer", bank_account_id=bank.id, status="paid",
        created_by_user_id=users["karthik@sundarprecision.com"].id,
    )
    db.add(exp1)
    db.flush()
    bank.current_balance -= (exp1_amount + exp1_tax)
    je_exp1 = models.JournalEntry(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id, entry_number="JE-00003",
        entry_date=date(2026, 7, 15), reference="EXP-00001", narration="Expense — Tamil Nadu Electricity Board",
        status="posted", total_debit=exp1_amount + exp1_tax, total_credit=exp1_amount + exp1_tax,
        source_type="expense", created_by_user_id=users["karthik@sundarprecision.com"].id,
        posted_at=datetime(2026, 7, 15, 11, 0, 0),
    )
    db.add(je_exp1)
    db.flush()
    db.add(models.JournalEntryLine(journal_entry_id=je_exp1.id, account_id=accounts["5200"].id,
                                    debit_amount=exp1_amount + exp1_tax, credit_amount=0, description="July electricity bill"))
    db.add(models.JournalEntryLine(journal_entry_id=je_exp1.id, account_id=accounts["2000"].id,
                                    debit_amount=0, credit_amount=exp1_amount + exp1_tax, description="Payable — Tamil Nadu Electricity Board"))
    exp1.journal_entry_id = je_exp1.id

    exp2_amount, exp2_tax = 3200, Decimal("576.00")
    exp2 = models.Expense(
        company_id=company.id, branch_id=branches["Coimbatore Plant"].id, expense_number="EXP-00002",
        expense_date=date(2026, 7, 26), category="Travel", account_id=accounts["5400"].id,
        vendor_name="Ola Cabs", description="Site visit — supplier audit", amount=exp2_amount, tax_rate=18,
        tax_amount=exp2_tax, total_amount=exp2_amount + exp2_tax, payment_method="upi", status="pending",
        created_by_user_id=users["meena@sundarprecision.com"].id,
    )
    db.add(exp2)
    db.flush()
    je_exp2 = models.JournalEntry(
        company_id=company.id, branch_id=branches["Coimbatore Plant"].id, entry_number="JE-00004",
        entry_date=date(2026, 7, 26), reference="EXP-00002", narration="Expense — Ola Cabs",
        status="posted", total_debit=exp2_amount + exp2_tax, total_credit=exp2_amount + exp2_tax,
        source_type="expense", created_by_user_id=users["meena@sundarprecision.com"].id,
        posted_at=datetime(2026, 7, 26, 9, 30, 0),
    )
    db.add(je_exp2)
    db.flush()
    db.add(models.JournalEntryLine(journal_entry_id=je_exp2.id, account_id=accounts["5400"].id,
                                    debit_amount=exp2_amount + exp2_tax, credit_amount=0, description="Site visit — supplier audit"))
    db.add(models.JournalEntryLine(journal_entry_id=je_exp2.id, account_id=accounts["2000"].id,
                                    debit_amount=0, credit_amount=exp2_amount + exp2_tax, description="Payable — Ola Cabs"))
    exp2.journal_entry_id = je_exp2.id

    # a third expense dated "today" (whenever the seed actually runs) so the Expenses
    # page's "Total this month" / "Paid this month" cards aren't empty on first look.
    exp3_amount, exp3_tax = 5400, Decimal("972.00")
    db.add(models.Expense(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id, expense_number="EXP-00003",
        expense_date=date.today(), category="Office Supplies", account_id=accounts["5300"].id,
        vendor_name="Staples India", description="Stationery and printer consumables", amount=exp3_amount,
        tax_rate=18, tax_amount=exp3_tax, total_amount=exp3_amount + exp3_tax, payment_method="card",
        status="pending", created_by_user_id=users["karthik@sundarprecision.com"].id,
    ))

    # a filed GST return for June (prior period) — July stays unfiled/draft, computed live
    db.add(models.GstFiling(
        company_id=company.id, return_month=6, return_year=2026,
        taxable_outward_supplies=3040000, output_tax=547200,
        taxable_inward_supplies=1850000, input_tax_credit=333000,
        net_tax_payable=214200, status="filed", filed_on=date(2026, 7, 18),
        filed_by_user_id=users["karthik@sundarprecision.com"].id, arn="AA331226ARN0001",
    ))

    # Journal entries for the Sales invoice and Purchase bill seeded earlier, matching
    # the auto-posting that now happens for real when these are created through the
    # API (see create_invoice / create_bill) — without these, the demo P&L report
    # would show income/COGS only for transactions created after the seed runs.
    je5 = models.JournalEntry(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id, entry_number="JE-00005",
        entry_date=inv1.invoice_date, reference=inv1.invoice_number, narration=f"Sales invoice {inv1.invoice_number}",
        status="posted", total_debit=inv1_total, total_credit=inv1_total, source_type="sales_invoice",
        source_id=inv1.id, created_by_user_id=users["karthik@sundarprecision.com"].id,
        posted_at=datetime(2026, 7, 16, 12, 0, 0),
    )
    db.add(je5)
    db.flush()
    db.add(models.JournalEntryLine(journal_entry_id=je5.id, account_id=accounts["1200"].id,
                                    debit_amount=inv1_total, credit_amount=0, description=f"Invoice {inv1.invoice_number}"))
    db.add(models.JournalEntryLine(journal_entry_id=je5.id, account_id=accounts["4000"].id,
                                    debit_amount=0, credit_amount=inv1_total, description=f"Invoice {inv1.invoice_number}"))

    je6 = models.JournalEntry(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id, entry_number="JE-00006",
        entry_date=bill1.bill_date, reference=bill1.bill_number,
        narration=f"Purchase bill {bill1.bill_number} — Chennai Fasteners Supply Co.",
        status="posted", total_debit=bill1_total, total_credit=bill1_total, source_type="purchase_bill",
        source_id=bill1.id, created_by_user_id=users["karthik@sundarprecision.com"].id,
        posted_at=datetime(2026, 7, 9, 15, 0, 0),
    )
    db.add(je6)
    db.flush()
    db.add(models.JournalEntryLine(journal_entry_id=je6.id, account_id=accounts["5000"].id,
                                    debit_amount=bill1_total, credit_amount=0, description=f"Bill {bill1.bill_number}"))
    db.add(models.JournalEntryLine(journal_entry_id=je6.id, account_id=accounts["2000"].id,
                                    debit_amount=0, credit_amount=bill1_total, description=f"Bill {bill1.bill_number}"))

    # ---------------- SERVICE DESK DEMO DATA ----------------
    sd_cat_defs = ["Product Issue", "Billing Query", "Delivery Delay", "Feature Request"]
    sd_categories = {}
    for name in sd_cat_defs:
        c = models.TicketCategory(company_id=company.id, name=name)
        db.add(c)
        db.flush()
        sd_categories[name] = c

    sla_defs = [
        ("urgent", 1, 8),
        ("high", 4, 24),
        ("medium", 8, 48),
        ("low", 24, 96),
    ]
    sla_policies = {}
    for priority, resp_hrs, res_hrs in sla_defs:
        p = models.SlaPolicy(company_id=company.id, priority=priority, response_hours=resp_hrs, resolution_hours=res_hrs)
        db.add(p)
        db.flush()
        sla_policies[priority] = p

    now = datetime.utcnow()

    # Ticket 1: open, urgent, response SLA already breached (created far enough in the
    # past relative to its 1-hour response SLA) — demonstrates the breach indicator.
    t1 = models.Ticket(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        ticket_number="TKT-00001", customer_id=om_traders.id, category_id=sd_categories["Delivery Delay"].id,
        sla_policy_id=sla_policies["urgent"].id, subject="Order OT-2216 hasn't arrived — 3 days late",
        description="Customer says the delivery promised for Monday still hasn't shown up.",
        priority="urgent", status="open", assigned_to_user_id=users["arjun@sundarprecision.com"].id,
        created_by_user_id=users["arjun@sundarprecision.com"].id,
    )
    db.add(t1)
    db.flush()
    # backdate creation and SLA due times to actually be breached, since SLA due times
    # are computed relative to "now" at creation and we want this one visibly overdue
    t1.created_at = now - timedelta(hours=6)
    t1.response_due_at = t1.created_at + timedelta(hours=1)
    t1.resolution_due_at = t1.created_at + timedelta(hours=8)
    db.add(models.TicketComment(ticket_id=t1.id, user_id=users["arjun@sundarprecision.com"].id,
                                 message="Checked with logistics — courier says it's stuck at the Kolar hub. Escalating.",
                                 is_internal=True))

    # Ticket 2: in_progress, high priority, first response already logged (not breached)
    t2 = models.Ticket(
        company_id=company.id, branch_id=branches["Chennai HQ (Head Office)"].id,
        ticket_number="TKT-00002", customer_id=vasan_autoparts.id, category_id=sd_categories["Billing Query"].id,
        sla_policy_id=sla_policies["high"].id, subject="GST amount mismatch on invoice INV-00001",
        description="Customer's accounts team flagged a discrepancy between the PO and the invoiced GST.",
        priority="high", status="in_progress", assigned_to_user_id=users["karthik@sundarprecision.com"].id,
        created_by_user_id=users["karthik@sundarprecision.com"].id,
    )
    db.add(t2)
    db.flush()
    t2.created_at = now - timedelta(hours=10)
    t2.response_due_at = t2.created_at + timedelta(hours=4)
    t2.resolution_due_at = t2.created_at + timedelta(hours=24)
    t2.first_responded_at = t2.created_at + timedelta(hours=2)
    db.add(models.TicketComment(ticket_id=t2.id, user_id=users["karthik@sundarprecision.com"].id,
                                 message="Thanks for flagging — pulling the invoice breakdown now, will confirm shortly.",
                                 is_internal=False))
    db.add(models.TicketComment(ticket_id=t2.id, user_id=users["karthik@sundarprecision.com"].id,
                                 message="Confirmed the GST was correctly applied at 18% on the taxable value; difference is rounding. Drafting explanation for customer.",
                                 is_internal=True))

    # Ticket 3: resolved today, so "resolved this month" isn't 0 on first look
    t3 = models.Ticket(
        company_id=company.id, branch_id=branches["Coimbatore Plant"].id,
        ticket_number="TKT-00003", customer_id=shree_fasteners.id, category_id=sd_categories["Product Issue"].id,
        sla_policy_id=sla_policies["medium"].id, subject="Received wrong bolt grade in last shipment",
        description="Shipment had Grade 5 bolts instead of the Grade 8.8 that was ordered.",
        priority="medium", status="resolved", assigned_to_user_id=users["meena@sundarprecision.com"].id,
        created_by_user_id=users["meena@sundarprecision.com"].id,
    )
    db.add(t3)
    db.flush()
    t3.created_at = now - timedelta(days=1)
    t3.response_due_at = t3.created_at + timedelta(hours=8)
    t3.resolution_due_at = t3.created_at + timedelta(hours=48)
    t3.first_responded_at = t3.created_at + timedelta(hours=1)
    t3.resolved_at = now
    db.add(models.TicketComment(ticket_id=t3.id, user_id=users["meena@sundarprecision.com"].id,
                                 message="Apologies for the mix-up — replacement Grade 8.8 batch has been dispatched free of charge.",
                                 is_internal=False))

    # Ticket 4: closed, low priority
    t4 = models.Ticket(
        company_id=company.id, branch_id=branches["Bengaluru Sales Office"].id,
        ticket_number="TKT-00004", customer_id=None, category_id=sd_categories["Feature Request"].id,
        sla_policy_id=sla_policies["low"].id, subject="Add bulk CSV export to Customers list",
        description="Internal request from the sales team for a CSV export button.",
        priority="low", status="closed", assigned_to_user_id=None,
        created_by_user_id=users["farhan@sundarprecision.com"].id,
    )
    db.add(t4)
    db.flush()
    t4.created_at = now - timedelta(days=10)
    t4.response_due_at = t4.created_at + timedelta(hours=24)
    t4.resolution_due_at = t4.created_at + timedelta(hours=96)
    t4.first_responded_at = t4.created_at + timedelta(hours=5)
    t4.resolved_at = t4.created_at + timedelta(days=3)
    t4.closed_at = t4.created_at + timedelta(days=4)

    db.commit()
    print("Database seeded successfully.")
    print(f"Login with: ravi@sundarprecision.com / {DEMO_PASSWORD}")

except Exception as exc:
    db.rollback()
    print(f"Seeding failed: {exc}")
    raise
finally:
    db.close()
