from sqlalchemy import (
    Column, BigInteger, String, Integer, DECIMAL, Boolean, Date, DateTime, Time,
    ForeignKey, Enum, Text, JSON, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class BusinessStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class Company(Base):
    __tablename__ = "companies"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_name = Column(String(150), nullable=False)
    business_type = Column(String(60), nullable=False)
    industry = Column(String(100), nullable=False)
    cin = Column(String(30))
    contact_number = Column(String(20), nullable=False)
    business_email = Column(String(150), nullable=False, unique=True)
    address_line = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    pin_code = Column(String(10), nullable=False)
    country = Column(String(80), nullable=False, default="India")
    gstin = Column(String(20), nullable=False, unique=True)
    pan = Column(String(15), nullable=False)
    default_gst_rate = Column(DECIMAL(5, 2), nullable=False, default=18.00)
    financial_year_start = Column(String(20), nullable=False, default="April")
    logo_url = Column(String(255))
    plan_name = Column(String(60), nullable=False, default="Business")
    plan_billing = Column(String(30), nullable=False, default="billed annually")
    status = Column(Enum(BusinessStatus), nullable=False, default=BusinessStatus.active)
    member_since = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    branches = relationship("Branch", back_populates="company", cascade="all, delete-orphan")
    users = relationship("User", back_populates="company", cascade="all, delete-orphan", foreign_keys="User.company_id")
    roles = relationship("Role", back_populates="company", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    role_name = Column(String(80), nullable=False)
    description = Column(String(255))
    access_level = Column(Enum("full", "high", "medium", "limited", name="access_level_enum"), nullable=False, default="limited")
    is_system_role = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    company = relationship("Company", back_populates="roles")
    users = relationship("User", back_populates="role")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "role_name", name="uq_role_per_company"),)


class Module(Base):
    __tablename__ = "modules"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    module_key = Column(String(60), nullable=False, unique=True)
    module_name = Column(String(100), nullable=False)
    category = Column(Enum("main", "login_setup", "workspace", name="module_category_enum"), nullable=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    role_id = Column(BigInteger, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(BigInteger, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    can_view = Column(Boolean, default=False)
    can_add = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    can_approve = Column(Boolean, default=False)

    role = relationship("Role", back_populates="permissions")
    module = relationship("Module")

    __table_args__ = (UniqueConstraint("role_id", "module_id", name="uq_role_module"),)


class Branch(Base):
    __tablename__ = "branches"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_name = Column(String(120), nullable=False)
    branch_type = Column(Enum("Head Office", "Warehouse", "Sales Office", "Plant", "Depot", "Other", name="branch_type_enum"), nullable=False, default="Warehouse")
    address = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    manager_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    gstin = Column(String(20), nullable=True)
    status = Column(Enum("active", "inactive", name="branch_status_enum"), nullable=False, default="active")
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    company = relationship("Company", back_populates="branches")
    manager = relationship("User", foreign_keys=[manager_user_id])
    users = relationship("User", back_populates="branch", foreign_keys="User.branch_id")


class User(Base):
    __tablename__ = "users"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    role_id = Column(BigInteger, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    full_name = Column(String(120), nullable=False)
    email = Column(String(150), nullable=False)
    mobile_number = Column(String(20))
    password_hash = Column(String(255), nullable=True)
    login_method = Column(Enum("password", "otp", "email_invite", name="login_method_enum"), nullable=False, default="email_invite")
    is_owner = Column(Boolean, default=False)
    status = Column(Enum("active", "invited", "suspended", name="user_status_enum"), nullable=False, default="invited")
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    company = relationship("Company", back_populates="users", foreign_keys=[company_id])
    branch = relationship("Branch", back_populates="users", foreign_keys=[branch_id])
    role = relationship("Role", back_populates="users")

    __table_args__ = (UniqueConstraint("company_id", "email", name="uq_users_email_company"),)


class OtpRequest(Base):
    __tablename__ = "otp_requests"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    otp_code = Column(String(6), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Customer(Base):
    __tablename__ = "customers"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    customer_name = Column(String(150), nullable=False)
    customer_type = Column(String(60))
    city = Column(String(100))
    zone = Column(String(100))
    phone = Column(String(20))
    email = Column(String(150), nullable=True)
    gstin = Column(String(20), nullable=True)
    billing_address = Column(String(255), nullable=True)
    shipping_address = Column(String(255), nullable=True)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    assigned_to_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    lead_source = Column(String(60), nullable=True)
    status = Column(Enum("active", "inactive", name="customer_status_enum"), nullable=False, default="active")
    credit_limit = Column(DECIMAL(14, 2), nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    dues = relationship("CustomerDue", back_populates="customer", cascade="all, delete-orphan")
    branch = relationship("Branch", foreign_keys=[branch_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])


class CustomerDue(Base):
    __tablename__ = "customer_dues"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    customer_id = Column(BigInteger, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(14, 2), nullable=False)
    status = Column(Enum("overdue", "due_soon", "received", name="due_status_enum"), nullable=False)
    days_overdue = Column(Integer, default=0)
    last_order_days_ago = Column(Integer, nullable=True)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    customer = relationship("Customer", back_populates="dues")


class DailyMetric(Base):
    __tablename__ = "daily_metrics"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    metric_date = Column(Date, nullable=False)
    todays_sales = Column(DECIMAL(14, 2), default=0)
    sales_change_pct = Column(DECIMAL(6, 2), default=0)
    todays_purchase = Column(DECIMAL(14, 2), default=0)
    purchase_change_pct = Column(DECIMAL(6, 2), default=0)
    pending_payments = Column(DECIMAL(14, 2), default=0)
    overdue_invoice_count = Column(Integer, default=0)
    stock_alert_count = Column(Integer, default=0)
    below_reorder_count = Column(Integer, default=0)

    __table_args__ = (UniqueConstraint("company_id", "metric_date", name="uq_dm_company_date"),)


class ProfitLossMonthly(Base):
    __tablename__ = "profit_loss_monthly"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    month_label = Column(String(10), nullable=False)
    month_order = Column(Integer, nullable=False)
    revenue_lakhs = Column(DECIMAL(10, 2), nullable=False)
    net_profit_lakhs = Column(DECIMAL(10, 2), nullable=False)


class ProductionOrder(Base):
    __tablename__ = "production_orders"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    wo_number = Column(String(30), nullable=False)
    product_name = Column(String(150), nullable=False)
    units = Column(Integer, nullable=False)
    stage = Column(String(80), nullable=False)
    progress_pct = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class AttendanceDaily(Base):
    __tablename__ = "attendance_daily"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    present_count = Column(Integer, default=0)
    on_leave_count = Column(Integer, default=0)
    absent_count = Column(Integer, default=0)

    __table_args__ = (UniqueConstraint("company_id", "attendance_date", name="uq_att_company_date"),)


class Product(Base):
    __tablename__ = "products"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(150), nullable=False)
    sku = Column(String(60), nullable=True)
    category = Column(String(80), nullable=True)
    unit_of_measure = Column(String(20), nullable=False, default="unit")
    hsn_code = Column(String(20), nullable=True)
    cost_price = Column(DECIMAL(12, 2), nullable=False, default=0)
    selling_price = Column(DECIMAL(12, 2), nullable=False, default=0)
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=18.00)
    reorder_level = Column(Integer, nullable=False, default=0)
    reorder_quantity = Column(Integer, nullable=False, default=0)
    barcode = Column(String(60), nullable=True)
    description = Column(String(255), nullable=True)
    primary_branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum("active", "inactive", name="product_status_enum"), nullable=False, default="active")
    # legacy AI/dashboard insight fields — kept for backward compatibility
    units_sold_month = Column(Integer, default=0)
    change_pct = Column(DECIMAL(6, 2), default=0)
    current_stock = Column(Integer, default=0)
    daily_run_rate = Column(DECIMAL(8, 2), default=0)
    supplier_price = Column(DECIMAL(10, 2), default=0)
    reorder_suggested_units = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    primary_branch = relationship("Branch", foreign_keys=[primary_branch_id])
    stock_levels = relationship("StockLevel", back_populates="product", cascade="all, delete-orphan")


class StockLevel(Base):
    __tablename__ = "stock_levels"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    quantity_on_hand = Column(DECIMAL(12, 2), nullable=False, default=0)
    quantity_reserved = Column(DECIMAL(12, 2), nullable=False, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="stock_levels")
    branch = relationship("Branch")

    __table_args__ = (UniqueConstraint("product_id", "branch_id", name="uq_stock_product_branch"),)


class StockMovement(Base):
    __tablename__ = "stock_movements"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    movement_type = Column(
        Enum("purchase_in", "sale_out", "transfer_in", "transfer_out", "adjustment_in", "adjustment_out",
             "production_consume", "production_output", name="stock_movement_type_enum"),
        nullable=False,
    )
    quantity = Column(DECIMAL(12, 2), nullable=False)
    reference_type = Column(String(40), nullable=True)
    reference_id = Column(BigInteger, nullable=True)
    balance_after = Column(DECIMAL(12, 2), nullable=False, default=0)
    notes = Column(String(255), nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    product = relationship("Product")
    branch = relationship("Branch")
    created_by = relationship("User", foreign_keys=[created_by_user_id])


class StockTransfer(Base):
    __tablename__ = "stock_transfers"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    transfer_number = Column(String(30), nullable=False)
    from_branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    to_branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    transfer_date = Column(Date, nullable=False)
    status = Column(
        Enum("pending", "in_transit", "completed", "cancelled", name="stock_transfer_status_enum"),
        nullable=False, default="pending",
    )
    notes = Column(String(255), nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    from_branch = relationship("Branch", foreign_keys=[from_branch_id])
    to_branch = relationship("Branch", foreign_keys=[to_branch_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    items = relationship("StockTransferItem", back_populates="transfer", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "transfer_number", name="uq_transfer_number"),)


class StockTransferItem(Base):
    __tablename__ = "stock_transfer_items"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    transfer_id = Column(BigInteger, ForeignKey("stock_transfers.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(DECIMAL(12, 2), nullable=False)
    received_quantity = Column(DECIMAL(12, 2), nullable=False, default=0)

    transfer = relationship("StockTransfer", back_populates="items")
    product = relationship("Product")


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    adjustment_number = Column(String(30), nullable=False)
    adjustment_date = Column(Date, nullable=False)
    reason = Column(
        Enum("damage", "loss", "found", "correction", "other", name="stock_adjustment_reason_enum"),
        nullable=False, default="correction",
    )
    status = Column(Enum("draft", "completed", name="stock_adjustment_status_enum"), nullable=False, default="draft")
    notes = Column(String(255), nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    branch = relationship("Branch")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    items = relationship("StockAdjustmentItem", back_populates="adjustment", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "adjustment_number", name="uq_adjustment_number"),)


class StockAdjustmentItem(Base):
    __tablename__ = "stock_adjustment_items"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    adjustment_id = Column(BigInteger, ForeignKey("stock_adjustments.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity_change = Column(DECIMAL(12, 2), nullable=False)
    reason_note = Column(String(255), nullable=True)

    adjustment = relationship("StockAdjustment", back_populates="items")
    product = relationship("Product")


class AiConversation(Base):
    __tablename__ = "ai_conversations"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False, default="New conversation")
    created_at = Column(DateTime, server_default=func.now())

    messages = relationship("AiMessage", back_populates="conversation", cascade="all, delete-orphan")


class AiMessage(Base):
    __tablename__ = "ai_messages"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    conversation_id = Column(BigInteger, ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False)
    sender = Column(Enum("user", "assistant", name="ai_sender_enum"), nullable=False)
    content = Column(Text, nullable=False)
    payload_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    conversation = relationship("AiConversation", back_populates="messages")


class ConnectedChannel(Base):
    __tablename__ = "connected_channels"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    channel_name = Column(String(60), nullable=False)
    status = Column(Enum("connected", "disconnected", name="channel_status_enum"), nullable=False, default="disconnected")

    __table_args__ = (UniqueConstraint("company_id", "channel_name", name="uq_cc_company_channel"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(120), nullable=False)
    entity_type = Column(String(60), nullable=False)
    entity_id = Column(BigInteger, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


# ============================================================
# SALES + CRM MODULE
# ============================================================

class Lead(Base):
    __tablename__ = "leads"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    lead_name = Column(String(150), nullable=False)
    company_name = Column(String(150), nullable=True)
    contact_person = Column(String(120), nullable=True)
    email = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=True)
    source = Column(
        Enum("website", "referral", "cold_call", "social_media", "trade_show", "other", name="lead_source_enum"),
        nullable=False, default="other",
    )
    status = Column(
        Enum("new", "contacted", "qualified", "proposal", "won", "lost", name="lead_status_enum"),
        nullable=False, default="new",
    )
    estimated_value = Column(DECIMAL(14, 2), nullable=False, default=0)
    assigned_to_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    converted_customer_id = Column(BigInteger, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    branch = relationship("Branch", foreign_keys=[branch_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])
    converted_customer = relationship("Customer", foreign_keys=[converted_customer_id])


class Quotation(Base):
    __tablename__ = "quotations"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    quotation_number = Column(String(30), nullable=False)
    customer_id = Column(BigInteger, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    lead_id = Column(BigInteger, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    quotation_date = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=True)
    status = Column(
        Enum("draft", "sent", "accepted", "rejected", "expired", name="quotation_status_enum"),
        nullable=False, default="draft",
    )
    subtotal = Column(DECIMAL(14, 2), nullable=False, default=0)
    tax_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    total_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    customer = relationship("Customer")
    branch = relationship("Branch")
    lead = relationship("Lead")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "quotation_number", name="uq_quotation_number"),)


class QuotationItem(Base):
    __tablename__ = "quotation_items"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    quotation_id = Column(BigInteger, ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    quantity = Column(DECIMAL(12, 2), nullable=False, default=1)
    unit = Column(String(20), nullable=False, default="unit")
    unit_price = Column(DECIMAL(12, 2), nullable=False, default=0)
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=0)
    line_total = Column(DECIMAL(14, 2), nullable=False, default=0)

    quotation = relationship("Quotation", back_populates="items")


class SalesOrder(Base):
    __tablename__ = "sales_orders"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    order_number = Column(String(30), nullable=False)
    customer_id = Column(BigInteger, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    quotation_id = Column(BigInteger, ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True)
    order_date = Column(Date, nullable=False)
    expected_delivery_date = Column(Date, nullable=True)
    status = Column(
        Enum("pending", "confirmed", "processing", "shipped", "completed", "cancelled", name="sales_order_status_enum"),
        nullable=False, default="pending",
    )
    subtotal = Column(DECIMAL(14, 2), nullable=False, default=0)
    tax_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    total_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    customer = relationship("Customer")
    branch = relationship("Branch")
    quotation = relationship("Quotation")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    items = relationship("SalesOrderItem", back_populates="sales_order", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "order_number", name="uq_order_number"),)


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sales_order_id = Column(BigInteger, ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    quantity = Column(DECIMAL(12, 2), nullable=False, default=1)
    unit = Column(String(20), nullable=False, default="unit")
    unit_price = Column(DECIMAL(12, 2), nullable=False, default=0)
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=0)
    line_total = Column(DECIMAL(14, 2), nullable=False, default=0)

    sales_order = relationship("SalesOrder", back_populates="items")


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    invoice_number = Column(String(30), nullable=False)
    customer_id = Column(BigInteger, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    sales_order_id = Column(BigInteger, ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    status = Column(
        Enum("draft", "sent", "partially_paid", "paid", "overdue", "cancelled", name="invoice_status_enum"),
        nullable=False, default="draft",
    )
    subtotal = Column(DECIMAL(14, 2), nullable=False, default=0)
    tax_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    total_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    amount_paid = Column(DECIMAL(14, 2), nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    customer = relationship("Customer")
    branch = relationship("Branch")
    sales_order = relationship("SalesOrder")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("InvoicePayment", back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "invoice_number", name="uq_invoice_number"),)


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    invoice_id = Column(BigInteger, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    quantity = Column(DECIMAL(12, 2), nullable=False, default=1)
    unit = Column(String(20), nullable=False, default="unit")
    unit_price = Column(DECIMAL(12, 2), nullable=False, default=0)
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=0)
    line_total = Column(DECIMAL(14, 2), nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="items")


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    invoice_id = Column(BigInteger, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(14, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_method = Column(
        Enum("cash", "bank_transfer", "upi", "cheque", "card", "other", name="payment_method_enum"),
        nullable=False, default="bank_transfer",
    )
    reference_number = Column(String(60), nullable=True)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    invoice = relationship("Invoice", back_populates="payments")


# ============================================================
# PURCHASE MODULE
# ============================================================
class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    supplier_name = Column(String(150), nullable=False)
    contact_person = Column(String(120), nullable=True)
    email = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=True)
    gstin = Column(String(20), nullable=True)
    billing_address = Column(String(255), nullable=True)
    category = Column(String(80), nullable=True)
    payment_terms = Column(String(60), nullable=False, default="Net 30")
    rating = Column(DECIMAL(2, 1), nullable=False, default=0)
    status = Column(Enum("active", "inactive", name="supplier_status_enum"), nullable=False, default="active")
    assigned_to_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    po_number = Column(String(30), nullable=False)
    supplier_id = Column(BigInteger, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False)
    po_date = Column(Date, nullable=False)
    expected_delivery_date = Column(Date, nullable=True)
    status = Column(
        Enum("draft", "sent", "confirmed", "partially_received", "received", "cancelled",
             name="po_status_enum"),
        nullable=False, default="draft",
    )
    subtotal = Column(DECIMAL(14, 2), nullable=False, default=0)
    tax_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    total_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    notes = Column(String(255), nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    branch = relationship("Branch")
    supplier = relationship("Supplier")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "po_number", name="uq_po_number"),)


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    purchase_order_id = Column(BigInteger, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    quantity = Column(DECIMAL(12, 2), nullable=False)
    unit = Column(String(20), nullable=False, default="unit")
    unit_price = Column(DECIMAL(12, 2), nullable=False, default=0)
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=0)
    line_total = Column(DECIMAL(14, 2), nullable=False, default=0)
    received_quantity = Column(DECIMAL(12, 2), nullable=False, default=0)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")


class PurchaseReceipt(Base):
    __tablename__ = "purchase_receipts"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    grn_number = Column(String(30), nullable=False)
    purchase_order_id = Column(BigInteger, ForeignKey("purchase_orders.id", ondelete="RESTRICT"), nullable=False)
    receipt_date = Column(Date, nullable=False)
    status = Column(Enum("draft", "completed", name="grn_status_enum"), nullable=False, default="draft")
    notes = Column(String(255), nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    branch = relationship("Branch")
    purchase_order = relationship("PurchaseOrder")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    items = relationship("PurchaseReceiptItem", back_populates="receipt", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "grn_number", name="uq_grn_number"),)


class PurchaseReceiptItem(Base):
    __tablename__ = "purchase_receipt_items"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    purchase_receipt_id = Column(BigInteger, ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False)
    purchase_order_item_id = Column(BigInteger, ForeignKey("purchase_order_items.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    product_name = Column(String(150), nullable=False)
    quantity_received = Column(DECIMAL(12, 2), nullable=False)
    unit = Column(String(20), nullable=False, default="unit")

    receipt = relationship("PurchaseReceipt", back_populates="items")
    purchase_order_item = relationship("PurchaseOrderItem")
    product = relationship("Product")


class PurchaseBill(Base):
    __tablename__ = "purchase_bills"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    bill_number = Column(String(30), nullable=False)
    supplier_id = Column(BigInteger, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False)
    purchase_order_id = Column(BigInteger, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    bill_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(
        Enum("draft", "pending", "partially_paid", "paid", "overdue", "cancelled", name="bill_status_enum"),
        nullable=False, default="pending",
    )
    subtotal = Column(DECIMAL(14, 2), nullable=False, default=0)
    tax_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    total_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    amount_paid = Column(DECIMAL(14, 2), nullable=False, default=0)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    branch = relationship("Branch")
    supplier = relationship("Supplier")
    purchase_order = relationship("PurchaseOrder")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    items = relationship("PurchaseBillItem", back_populates="bill", cascade="all, delete-orphan")
    payments = relationship("PurchaseBillPayment", back_populates="bill", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "bill_number", name="uq_bill_number"),)


class PurchaseBillItem(Base):
    __tablename__ = "purchase_bill_items"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    purchase_bill_id = Column(BigInteger, ForeignKey("purchase_bills.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    quantity = Column(DECIMAL(12, 2), nullable=False)
    unit = Column(String(20), nullable=False, default="unit")
    unit_price = Column(DECIMAL(12, 2), nullable=False, default=0)
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=0)
    line_total = Column(DECIMAL(14, 2), nullable=False, default=0)

    bill = relationship("PurchaseBill", back_populates="items")


class PurchaseBillPayment(Base):
    __tablename__ = "purchase_bill_payments"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    purchase_bill_id = Column(BigInteger, ForeignKey("purchase_bills.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(14, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_method = Column(
        Enum("bank_transfer", "upi", "cheque", "cash", "card", "other", name="purchase_payment_method_enum"),
        nullable=False, default="bank_transfer",
    )
    reference_number = Column(String(60), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    bill = relationship("PurchaseBill", back_populates="payments")


# ============================================================
# MANUFACTURING MODULE
# ============================================================
class WorkCenter(Base):
    __tablename__ = "work_centers"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(120), nullable=False)
    code = Column(String(30), nullable=False)
    description = Column(String(255), nullable=True)
    capacity_per_day = Column(Integer, nullable=False, default=0)
    status = Column(Enum("active", "inactive", "maintenance", name="work_center_status_enum"), nullable=False, default="active")
    created_at = Column(DateTime, server_default=func.now())

    branch = relationship("Branch")


class BillOfMaterials(Base):
    __tablename__ = "bill_of_materials"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    bom_name = Column(String(150), nullable=False)
    version = Column(String(20), nullable=False, default="v1")
    status = Column(Enum("draft", "active", "archived", name="bom_status_enum"), nullable=False, default="active")
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    product = relationship("Product", foreign_keys=[product_id])
    components = relationship("BomComponent", back_populates="bom", cascade="all, delete-orphan")


class BomComponent(Base):
    __tablename__ = "bom_components"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    bom_id = Column(BigInteger, ForeignKey("bill_of_materials.id", ondelete="CASCADE"), nullable=False)
    component_product_id = Column(BigInteger, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    quantity_required = Column(DECIMAL(12, 3), nullable=False)
    unit = Column(String(20), nullable=False, default="unit")

    bom = relationship("BillOfMaterials", back_populates="components")
    component_product = relationship("Product", foreign_keys=[component_product_id])


class WorkOrder(Base):
    __tablename__ = "work_orders"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    wo_number = Column(String(30), nullable=False)
    product_id = Column(BigInteger, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    bom_id = Column(BigInteger, ForeignKey("bill_of_materials.id", ondelete="SET NULL"), nullable=True)
    work_center_id = Column(BigInteger, ForeignKey("work_centers.id", ondelete="SET NULL"), nullable=True)
    quantity_planned = Column(DECIMAL(12, 2), nullable=False)
    quantity_completed = Column(DECIMAL(12, 2), nullable=False, default=0)
    status = Column(
        Enum("draft", "scheduled", "in_progress", "completed", "cancelled", name="wo_status_enum"),
        nullable=False, default="draft",
    )
    priority = Column(Enum("low", "medium", "high", "urgent", name="wo_priority_enum"), nullable=False, default="medium")
    current_stage = Column(String(80), nullable=False, default="Raw Material Prep")
    progress_pct = Column(Integer, nullable=False, default=0)
    materials_issued = Column(Boolean, nullable=False, default=False)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(String(255), nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    branch = relationship("Branch")
    product = relationship("Product", foreign_keys=[product_id])
    bom = relationship("BillOfMaterials")
    work_center = relationship("WorkCenter")
    material_issues = relationship("MaterialIssue", back_populates="work_order", cascade="all, delete-orphan")


class MaterialIssue(Base):
    __tablename__ = "material_issues"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    work_order_id = Column(BigInteger, ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    component_product_id = Column(BigInteger, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    quantity_issued = Column(DECIMAL(12, 3), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    issued_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    issued_at = Column(DateTime, server_default=func.now())

    work_order = relationship("WorkOrder", back_populates="material_issues")
    component_product = relationship("Product", foreign_keys=[component_product_id])


# ============================================================
# HR & EMPLOYEE MODULE
# ============================================================
class Department(Base):
    __tablename__ = "departments"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    department_name = Column(String(100), nullable=False)
    head_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    head = relationship("User", foreign_keys=[head_user_id])
    employees = relationship("Employee", back_populates="department")

    __table_args__ = (UniqueConstraint("company_id", "department_name", name="uq_dept_company_name"),)


class Employee(Base):
    __tablename__ = "employees"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    department_id = Column(BigInteger, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    employee_code = Column(String(30), nullable=False)
    full_name = Column(String(120), nullable=False)
    designation = Column(String(100), nullable=False)
    employment_type = Column(
        Enum("full_time", "part_time", "contract", "intern", name="employment_type_enum"),
        nullable=False, default="full_time",
    )
    date_of_joining = Column(Date, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(Enum("male", "female", "other", "prefer_not_to_say", name="gender_enum"), nullable=True)
    personal_email = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=True)
    emergency_contact_name = Column(String(120), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    reporting_manager_id = Column(BigInteger, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    ctc_annual = Column(DECIMAL(12, 2), nullable=True)
    bank_account_number = Column(String(30), nullable=True)
    bank_ifsc = Column(String(15), nullable=True)
    pan = Column(String(15), nullable=True)
    status = Column(
        Enum("active", "on_leave", "resigned", "terminated", name="employee_status_enum"),
        nullable=False, default="active",
    )
    exit_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    branch = relationship("Branch")
    department = relationship("Department", back_populates="employees")
    user = relationship("User", foreign_keys=[user_id])
    reporting_manager = relationship("Employee", remote_side=[id])
    leave_requests = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="employee", cascade="all, delete-orphan")
    payslips = relationship("Payslip", back_populates="employee", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "employee_code", name="uq_emp_company_code"),)


class LeaveType(Base):
    __tablename__ = "leave_types"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    leave_type_name = Column(String(60), nullable=False)
    annual_quota = Column(DECIMAL(5, 1), nullable=False, default=0)
    is_paid = Column(Boolean, nullable=False, default=True)

    __table_args__ = (UniqueConstraint("company_id", "leave_type_name", name="uq_lt_company_name"),)


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(BigInteger, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(BigInteger, ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(DECIMAL(5, 1), nullable=False)
    reason = Column(String(255), nullable=True)
    status = Column(
        Enum("pending", "approved", "rejected", "cancelled", name="leave_status_enum"),
        nullable=False, default="pending",
    )
    approved_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    applied_at = Column(DateTime, server_default=func.now())

    employee = relationship("Employee", back_populates="leave_requests")
    leave_type = relationship("LeaveType")
    approver = relationship("User", foreign_keys=[approved_by_user_id])


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(BigInteger, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    status = Column(
        Enum("present", "absent", "half_day", "on_leave", "holiday", "week_off", name="attendance_status_enum"),
        nullable=False,
    )
    check_in_time = Column(Time, nullable=True)
    check_out_time = Column(Time, nullable=True)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    employee = relationship("Employee", back_populates="attendance_records")
    branch = relationship("Branch")

    __table_args__ = (UniqueConstraint("employee_id", "attendance_date", name="uq_att_employee_date"),)


class Payslip(Base):
    __tablename__ = "payslips"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(BigInteger, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    pay_month = Column(Integer, nullable=False)
    pay_year = Column(Integer, nullable=False)
    basic = Column(DECIMAL(12, 2), nullable=False, default=0)
    hra = Column(DECIMAL(12, 2), nullable=False, default=0)
    other_allowances = Column(DECIMAL(12, 2), nullable=False, default=0)
    deductions = Column(DECIMAL(12, 2), nullable=False, default=0)
    net_pay = Column(DECIMAL(12, 2), nullable=False, default=0)
    status = Column(Enum("draft", "finalized", "paid", name="payslip_status_enum"), nullable=False, default="draft")
    paid_on = Column(Date, nullable=True)
    generated_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    employee = relationship("Employee", back_populates="payslips")

    __table_args__ = (UniqueConstraint("employee_id", "pay_month", "pay_year", name="uq_pay_employee_month"),)


# ============================================================
# FINANCE & GST
# ============================================================
class ChartOfAccount(Base):
    __tablename__ = "chart_of_accounts"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    account_code = Column(String(20), nullable=False)
    account_name = Column(String(150), nullable=False)
    account_type = Column(Enum("asset", "liability", "equity", "income", "expense", name="account_type_enum"), nullable=False)
    parent_account_id = Column(BigInteger, ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    parent = relationship("ChartOfAccount", remote_side=[id])

    __table_args__ = (UniqueConstraint("company_id", "account_code", name="uq_coa_code"),)


class BankAccount(Base):
    __tablename__ = "bank_accounts"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    account_name = Column(String(150), nullable=False)
    bank_name = Column(String(150), nullable=False)
    account_number = Column(String(40), nullable=False)
    ifsc_code = Column(String(15), nullable=True)
    account_type = Column(Enum("current", "savings", "cash", name="bank_account_type_enum"), nullable=False, default="current")
    opening_balance = Column(DECIMAL(14, 2), nullable=False, default=0)
    current_balance = Column(DECIMAL(14, 2), nullable=False, default=0)
    is_primary = Column(Boolean, default=False)
    status = Column(Enum("active", "inactive", name="bank_status_enum"), nullable=False, default="active")
    created_at = Column(DateTime, server_default=func.now())


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    entry_number = Column(String(30), nullable=False)
    entry_date = Column(Date, nullable=False)
    reference = Column(String(100), nullable=True)
    narration = Column(String(255), nullable=True)
    status = Column(Enum("draft", "posted", name="journal_status_enum"), nullable=False, default="draft")
    total_debit = Column(DECIMAL(14, 2), nullable=False, default=0)
    total_credit = Column(DECIMAL(14, 2), nullable=False, default=0)
    source_type = Column(
        Enum("manual", "sales_invoice", "purchase_bill", "expense", "payroll", name="journal_source_enum"),
        nullable=False, default="manual",
    )
    source_id = Column(BigInteger, nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    branch = relationship("Branch")
    lines = relationship("JournalEntryLine", back_populates="entry", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("company_id", "entry_number", name="uq_je_number"),)


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_lines"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    journal_entry_id = Column(BigInteger, ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(BigInteger, ForeignKey("chart_of_accounts.id", ondelete="RESTRICT"), nullable=False)
    debit_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    credit_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    description = Column(String(255), nullable=True)

    entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccount")


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    expense_number = Column(String(30), nullable=False)
    expense_date = Column(Date, nullable=False)
    category = Column(String(80), nullable=False)
    account_id = Column(BigInteger, ForeignKey("chart_of_accounts.id", ondelete="RESTRICT"), nullable=False)
    vendor_name = Column(String(150), nullable=True)
    description = Column(String(255), nullable=True)
    amount = Column(DECIMAL(14, 2), nullable=False)
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=0)
    tax_amount = Column(DECIMAL(14, 2), nullable=False, default=0)
    total_amount = Column(DECIMAL(14, 2), nullable=False)
    payment_method = Column(
        Enum("cash", "bank_transfer", "upi", "cheque", "card", "other", name="expense_payment_method_enum"),
        nullable=False, default="bank_transfer",
    )
    bank_account_id = Column(BigInteger, ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum("pending", "paid", name="expense_status_enum"), nullable=False, default="pending")
    journal_entry_id = Column(BigInteger, ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    branch = relationship("Branch")
    account = relationship("ChartOfAccount")
    bank_account = relationship("BankAccount")

    __table_args__ = (UniqueConstraint("company_id", "expense_number", name="uq_exp_number"),)


class GstFiling(Base):
    __tablename__ = "gst_filings"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    return_month = Column(Integer, nullable=False)
    return_year = Column(Integer, nullable=False)
    taxable_outward_supplies = Column(DECIMAL(14, 2), nullable=False, default=0)
    output_tax = Column(DECIMAL(14, 2), nullable=False, default=0)
    taxable_inward_supplies = Column(DECIMAL(14, 2), nullable=False, default=0)
    input_tax_credit = Column(DECIMAL(14, 2), nullable=False, default=0)
    net_tax_payable = Column(DECIMAL(14, 2), nullable=False, default=0)
    status = Column(Enum("draft", "filed", name="gst_status_enum"), nullable=False, default="draft")
    filed_on = Column(Date, nullable=True)
    filed_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    arn = Column(String(40), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("company_id", "return_year", "return_month", name="uq_gst_period"),)


# ============================================================
# SERVICE DESK
# ============================================================
class TicketCategory(Base):
    __tablename__ = "ticket_categories"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(80), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_tcat_name"),)


class SlaPolicy(Base):
    __tablename__ = "sla_policies"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    priority = Column(Enum("low", "medium", "high", "urgent", name="sla_priority_enum"), nullable=False)
    response_hours = Column(Integer, nullable=False)
    resolution_hours = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("company_id", "priority", name="uq_sla_priority"),)


class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(BigInteger, ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    ticket_number = Column(String(30), nullable=False)
    customer_id = Column(BigInteger, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(BigInteger, ForeignKey("ticket_categories.id", ondelete="SET NULL"), nullable=True)
    sla_policy_id = Column(BigInteger, ForeignKey("sla_policies.id", ondelete="SET NULL"), nullable=True)
    subject = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(Enum("low", "medium", "high", "urgent", name="ticket_priority_enum"), nullable=False, default="medium")
    status = Column(Enum("open", "in_progress", "on_hold", "resolved", "closed", name="ticket_status_enum"), nullable=False, default="open")
    assigned_to_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    response_due_at = Column(DateTime, nullable=True)
    resolution_due_at = Column(DateTime, nullable=True)
    first_responded_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    branch = relationship("Branch", foreign_keys=[branch_id])
    customer = relationship("Customer", foreign_keys=[customer_id])
    category = relationship("TicketCategory", foreign_keys=[category_id])
    sla_policy = relationship("SlaPolicy", foreign_keys=[sla_policy_id])
    assignee = relationship("User", foreign_keys=[assigned_to_user_id])
    creator = relationship("User", foreign_keys=[created_by_user_id])
    comments = relationship("TicketComment", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketComment.id")

    __table_args__ = (UniqueConstraint("company_id", "ticket_number", name="uq_ticket_number"),)


class TicketComment(Base):
    __tablename__ = "ticket_comments"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    ticket_id = Column(BigInteger, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    message = Column(Text, nullable=False)
    is_internal = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())

    ticket = relationship("Ticket", back_populates="comments")
    user = relationship("User", foreign_keys=[user_id])
