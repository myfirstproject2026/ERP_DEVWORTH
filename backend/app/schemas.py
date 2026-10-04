from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, datetime, time
from decimal import Decimal


# ============================================================
# AUTH
# ============================================================
class LoginRequest(BaseModel):
    identifier: str = Field(..., description="User ID or email")
    password: str
    keep_signed_in: bool = True


class OtpSendRequest(BaseModel):
    identifier: str


class OtpVerifyRequest(BaseModel):
    identifier: str
    otp_code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class MeOut(BaseModel):
    id: int
    full_name: str
    email: str
    role_name: str
    is_owner: bool
    company_id: int
    company_name: str
    branch_name: Optional[str] = None
    allowed_modules: List[str] = []

    class Config:
        from_attributes = True


# ============================================================
# COMPANY REGISTRATION (multi-step wizard)
# ============================================================
class CompanyRegisterRequest(BaseModel):
    # Step 1 - Business info
    company_name: str
    business_type: str
    industry: str
    cin: Optional[str] = None
    contact_number: str
    business_email: EmailStr
    # Step 2 - Address & Tax
    address_line: str
    city: str
    state: str
    pin_code: str
    country: str = "India"
    gstin: str
    pan: str
    default_gst_rate: Decimal = Decimal("18.00")
    financial_year_start: str = "April"
    # Step 4 - owner login credentials
    owner_full_name: str
    owner_password: str


class CompanyOut(BaseModel):
    id: int
    company_name: str
    business_type: str
    industry: str
    cin: Optional[str]
    contact_number: str
    business_email: str
    address_line: str
    city: str
    state: str
    pin_code: str
    country: str
    gstin: str
    pan: str
    default_gst_rate: Decimal
    financial_year_start: str
    logo_url: Optional[str]
    plan_name: str
    plan_billing: str
    status: str
    member_since: date

    class Config:
        from_attributes = True


class CompanyUpdateRequest(BaseModel):
    company_name: Optional[str] = None
    business_type: Optional[str] = None
    industry: Optional[str] = None
    cin: Optional[str] = None
    contact_number: Optional[str] = None
    business_email: Optional[EmailStr] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    default_gst_rate: Optional[Decimal] = None
    financial_year_start: Optional[str] = None
    logo_url: Optional[str] = None


class CompanySnapshotOut(BaseModel):
    branches: int
    active_users: int
    roles_configured: int
    member_since: str


# ============================================================
# BRANCHES
# ============================================================
class BranchCreateRequest(BaseModel):
    branch_name: str
    branch_type: str = "Warehouse"
    address: str
    city: str
    state: str
    manager_user_id: Optional[int] = None
    gstin: Optional[str] = None
    is_default: bool = False


class BranchUpdateRequest(BaseModel):
    branch_name: Optional[str] = None
    branch_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    manager_user_id: Optional[int] = None
    gstin: Optional[str] = None
    status: Optional[str] = None
    is_default: Optional[bool] = None


class BranchOut(BaseModel):
    id: int
    branch_name: str
    branch_type: str
    address: str
    city: str
    state: str
    manager_name: Optional[str] = None
    manager_user_id: Optional[int] = None
    gstin: Optional[str]
    status: str
    users_count: int = 0
    is_default: bool

    class Config:
        from_attributes = True


class BranchStatsOut(BaseModel):
    total_branches: int
    active_branches: int
    inactive_branches: int
    total_staff: int


# ============================================================
# USERS
# ============================================================
class UserInviteRequest(BaseModel):
    full_name: str
    mobile_number: Optional[str] = None
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role_id: int
    branch_id: int
    login_method: str = "email_invite"
    send_whatsapp_notification: bool = True


class UserUpdateRequest(BaseModel):
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[EmailStr] = None
    role_id: Optional[int] = None
    branch_id: Optional[int] = None
    status: Optional[str] = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    mobile_number: Optional[str]
    role_id: int
    role_name: str
    branch_id: Optional[int]
    branch_name: Optional[str]
    status: str
    is_owner: bool
    allowed_modules: List[str] = []

    class Config:
        from_attributes = True


class UserStatsOut(BaseModel):
    total_users: int
    active_users: int
    invited_users: int
    suspended_users: int


# ============================================================
# ROLES & PERMISSIONS
# ============================================================
class ModulePermissionItem(BaseModel):
    module_id: int
    module_key: str
    module_name: str
    can_view: bool
    can_add: bool
    can_edit: bool
    can_delete: bool
    can_approve: bool


class RoleCreateRequest(BaseModel):
    role_name: str
    description: Optional[str] = None
    access_level: str = "limited"


class RoleUpdateRequest(BaseModel):
    role_name: Optional[str] = None
    description: Optional[str] = None
    access_level: Optional[str] = None


class RolePermissionsUpdateRequest(BaseModel):
    permissions: List[ModulePermissionItem]


class RoleOut(BaseModel):
    id: int
    role_name: str
    description: Optional[str]
    access_level: str
    assigned_users: int = 0

    class Config:
        from_attributes = True


class RoleDetailOut(RoleOut):
    permissions: List[ModulePermissionItem]


# ============================================================
# DASHBOARD
# ============================================================
class DashboardSummaryOut(BaseModel):
    todays_sales: Decimal
    sales_change_pct: Decimal
    todays_purchase: Decimal
    purchase_change_pct: Decimal
    pending_payments: Decimal
    overdue_invoice_count: int
    stock_alert_count: int
    below_reorder_count: int
    ai_insight: str


class ProfitLossPointOut(BaseModel):
    month_label: str
    revenue_lakhs: Decimal
    net_profit_lakhs: Decimal


class ProductionOrderOut(BaseModel):
    wo_number: str
    product_name: str
    units: int
    stage: str
    progress_pct: int

    class Config:
        from_attributes = True


class AttendanceOut(BaseModel):
    present_count: int
    on_leave_count: int
    absent_count: int
    present_pct: int


class CustomerFollowUpOut(BaseModel):
    customer_name: str
    customer_type: Optional[str]
    city: Optional[str]
    amount: Decimal
    status: str
    days_overdue: int


# ============================================================
# AI ASSISTANT
# ============================================================
class AiMessageOut(BaseModel):
    id: int
    sender: str
    content: str
    payload_json: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AiAskRequest(BaseModel):
    conversation_id: Optional[int] = None
    message: str


class AiAskResponse(BaseModel):
    conversation_id: int
    user_message: AiMessageOut
    assistant_message: AiMessageOut


class ConnectedChannelOut(BaseModel):
    channel_name: str
    status: str

    class Config:
        from_attributes = True


# ============================================================
# SALES + CRM
# ============================================================

# ---------- Customers ----------
class CustomerCreateRequest(BaseModel):
    customer_name: str
    customer_type: Optional[str] = None
    city: Optional[str] = None
    zone: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    branch_id: Optional[int] = None
    assigned_to_user_id: Optional[int] = None
    lead_source: Optional[str] = None
    credit_limit: Decimal = Decimal("0")
    notes: Optional[str] = None


class CustomerUpdateRequest(BaseModel):
    customer_name: Optional[str] = None
    customer_type: Optional[str] = None
    city: Optional[str] = None
    zone: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    branch_id: Optional[int] = None
    assigned_to_user_id: Optional[int] = None
    status: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    notes: Optional[str] = None


class CustomerOut(BaseModel):
    id: int
    customer_name: str
    customer_type: Optional[str]
    city: Optional[str]
    zone: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    gstin: Optional[str]
    branch_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    status: str
    credit_limit: Decimal
    open_orders_count: int = 0
    lifetime_value: Decimal = Decimal("0")

    class Config:
        from_attributes = True


class CustomerStatsOut(BaseModel):
    total_customers: int
    active_customers: int
    new_this_month: int
    total_lifetime_value: Decimal


# ---------- Leads ----------
class LeadCreateRequest(BaseModel):
    lead_name: str
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: str = "other"
    estimated_value: Decimal = Decimal("0")
    assigned_to_user_id: Optional[int] = None
    branch_id: Optional[int] = None
    notes: Optional[str] = None


class LeadUpdateRequest(BaseModel):
    lead_name: Optional[str] = None
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    estimated_value: Optional[Decimal] = None
    assigned_to_user_id: Optional[int] = None
    notes: Optional[str] = None


class LeadOut(BaseModel):
    id: int
    lead_name: str
    company_name: Optional[str]
    contact_person: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    source: str
    status: str
    estimated_value: Decimal
    assigned_to_name: Optional[str] = None
    converted_customer_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LeadStatsOut(BaseModel):
    total_leads: int
    new_leads: int
    qualified_leads: int
    won_leads: int
    pipeline_value: Decimal


# ---------- Line items (shared shape for quotations/orders/invoices) ----------
class LineItemIn(BaseModel):
    product_name: str
    description: Optional[str] = None
    quantity: Decimal = Decimal("1")
    unit: str = "unit"
    unit_price: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("0")
    product_id: Optional[int] = None


class LineItemOut(BaseModel):
    id: int
    product_name: str
    description: Optional[str]
    quantity: Decimal
    unit: str
    unit_price: Decimal
    tax_rate: Decimal
    line_total: Decimal
    product_id: Optional[int] = None
    received_quantity: Optional[Decimal] = None

    class Config:
        from_attributes = True


# ---------- Quotations ----------
class QuotationCreateRequest(BaseModel):
    customer_id: int
    lead_id: Optional[int] = None
    branch_id: Optional[int] = None
    quotation_date: date
    valid_until: Optional[date] = None
    notes: Optional[str] = None
    items: List[LineItemIn]


class QuotationUpdateRequest(BaseModel):
    status: Optional[str] = None
    valid_until: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[LineItemIn]] = None


class QuotationOut(BaseModel):
    id: int
    quotation_number: str
    customer_id: int
    customer_name: str
    quotation_date: date
    valid_until: Optional[date]
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal

    class Config:
        from_attributes = True


class QuotationDetailOut(QuotationOut):
    notes: Optional[str]
    items: List[LineItemOut]


# ---------- Sales Orders ----------
class SalesOrderCreateRequest(BaseModel):
    customer_id: int
    quotation_id: Optional[int] = None
    branch_id: Optional[int] = None
    order_date: date
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[LineItemIn]


class SalesOrderUpdateRequest(BaseModel):
    status: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[LineItemIn]] = None


class SalesOrderOut(BaseModel):
    id: int
    order_number: str
    customer_id: int
    customer_name: str
    order_date: date
    expected_delivery_date: Optional[date]
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal

    class Config:
        from_attributes = True


class SalesOrderDetailOut(SalesOrderOut):
    notes: Optional[str]
    items: List[LineItemOut]


# ---------- Invoices ----------
class InvoiceCreateRequest(BaseModel):
    customer_id: int
    sales_order_id: Optional[int] = None
    branch_id: Optional[int] = None
    invoice_date: date
    due_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[LineItemIn]


class InvoiceUpdateRequest(BaseModel):
    status: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[LineItemIn]] = None


class InvoicePaymentRequest(BaseModel):
    amount: Decimal
    payment_date: date
    payment_method: str = "bank_transfer"
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class InvoicePaymentOut(BaseModel):
    id: int
    amount: Decimal
    payment_date: date
    payment_method: str
    reference_number: Optional[str]

    class Config:
        from_attributes = True


class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    customer_id: int
    customer_name: str
    invoice_date: date
    due_date: Optional[date]
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal

    class Config:
        from_attributes = True


class InvoiceDetailOut(InvoiceOut):
    notes: Optional[str]
    items: List[LineItemOut]
    payments: List[InvoicePaymentOut]


# ---------- Pipeline summary (module dashboard strip) ----------
class SalesPipelineSummaryOut(BaseModel):
    open_leads: int
    pipeline_value: Decimal
    quotations_pending: int
    orders_in_progress: int
    invoices_outstanding: Decimal


# ============================================================
# INVENTORY
# ============================================================
class ProductCreateRequest(BaseModel):
    product_name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: str = "unit"
    hsn_code: Optional[str] = None
    cost_price: Decimal = Decimal("0")
    selling_price: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("18.00")
    reorder_level: int = 0
    reorder_quantity: int = 0
    barcode: Optional[str] = None
    description: Optional[str] = None
    primary_branch_id: Optional[int] = None
    status: str = "active"


class ProductUpdateRequest(BaseModel):
    product_name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: Optional[str] = None
    hsn_code: Optional[str] = None
    cost_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    reorder_level: Optional[int] = None
    reorder_quantity: Optional[int] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    primary_branch_id: Optional[int] = None
    status: Optional[str] = None


class ProductOut(BaseModel):
    id: int
    product_name: str
    sku: Optional[str]
    category: Optional[str]
    unit_of_measure: str
    hsn_code: Optional[str]
    cost_price: Decimal
    selling_price: Decimal
    tax_rate: Decimal
    reorder_level: int
    reorder_quantity: int
    barcode: Optional[str]
    description: Optional[str]
    primary_branch_id: Optional[int]
    primary_branch_name: Optional[str]
    status: str
    total_stock: Decimal = Decimal("0")

    class Config:
        from_attributes = True


class InventoryStatsOut(BaseModel):
    total_products: int
    active_products: int
    low_stock_count: int
    total_stock_value: Decimal


class StockLevelOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: Optional[str]
    branch_id: int
    branch_name: str
    quantity_on_hand: Decimal
    quantity_reserved: Decimal
    quantity_available: Decimal
    reorder_level: int
    is_low_stock: bool

    class Config:
        from_attributes = True


class StockMovementOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    branch_id: int
    branch_name: str
    movement_type: str
    quantity: Decimal
    reference_type: Optional[str]
    reference_id: Optional[int]
    balance_after: Decimal
    notes: Optional[str]
    created_by_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TransferItemIn(BaseModel):
    product_id: int
    quantity: Decimal


class TransferItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: Decimal
    received_quantity: Decimal

    class Config:
        from_attributes = True


class StockTransferCreateRequest(BaseModel):
    from_branch_id: int
    to_branch_id: int
    transfer_date: date
    notes: Optional[str] = None
    items: List[TransferItemIn]


class StockTransferUpdateRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class StockTransferOut(BaseModel):
    id: int
    transfer_number: str
    from_branch_id: int
    from_branch_name: str
    to_branch_id: int
    to_branch_name: str
    transfer_date: date
    status: str
    notes: Optional[str]

    class Config:
        from_attributes = True


class StockTransferDetailOut(StockTransferOut):
    items: List[TransferItemOut]


class AdjustmentItemIn(BaseModel):
    product_id: int
    quantity_change: Decimal
    reason_note: Optional[str] = None


class AdjustmentItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity_change: Decimal
    reason_note: Optional[str]

    class Config:
        from_attributes = True


class StockAdjustmentCreateRequest(BaseModel):
    branch_id: int
    adjustment_date: date
    reason: str = "correction"
    notes: Optional[str] = None
    items: List[AdjustmentItemIn]


class StockAdjustmentOut(BaseModel):
    id: int
    adjustment_number: str
    branch_id: int
    branch_name: str
    adjustment_date: date
    reason: str
    status: str
    notes: Optional[str]

    class Config:
        from_attributes = True


class StockAdjustmentDetailOut(StockAdjustmentOut):
    items: List[AdjustmentItemOut]


class InventoryOverviewOut(BaseModel):
    total_products: int
    low_stock_count: int
    total_stock_value: Decimal
    pending_transfers: int
    recent_movements: List[StockMovementOut]


# ============================================================
# PURCHASE MODULE
# ============================================================
class SupplierCreateRequest(BaseModel):
    supplier_name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: Optional[str] = None
    category: Optional[str] = None
    payment_terms: str = "Net 30"
    assigned_to_user_id: Optional[int] = None


class SupplierUpdateRequest(BaseModel):
    supplier_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: Optional[str] = None
    category: Optional[str] = None
    payment_terms: Optional[str] = None
    rating: Optional[Decimal] = None
    status: Optional[str] = None
    assigned_to_user_id: Optional[int] = None


class SupplierOut(BaseModel):
    id: int
    supplier_name: str
    contact_person: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    gstin: Optional[str]
    billing_address: Optional[str]
    category: Optional[str]
    payment_terms: str
    rating: Decimal
    status: str
    assigned_to_user_id: Optional[int]
    assigned_to_name: Optional[str] = None
    open_po_count: int = 0
    total_spend: Decimal = Decimal("0")

    class Config:
        from_attributes = True


class SupplierStatsOut(BaseModel):
    total_suppliers: int
    active_suppliers: int
    open_purchase_orders: int
    bills_due: Decimal


class PurchaseOrderCreateRequest(BaseModel):
    branch_id: int
    supplier_id: int
    po_date: date
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[LineItemIn]


class PurchaseOrderUpdateRequest(BaseModel):
    branch_id: Optional[int] = None
    expected_delivery_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[LineItemIn]] = None


class PurchaseOrderOut(BaseModel):
    id: int
    po_number: str
    branch_id: int
    branch_name: str
    supplier_id: int
    supplier_name: str
    po_date: date
    expected_delivery_date: Optional[date]
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    notes: Optional[str]

    class Config:
        from_attributes = True


class PurchaseOrderDetailOut(PurchaseOrderOut):
    items: List[LineItemOut]


class ReceiptItemIn(BaseModel):
    purchase_order_item_id: int
    quantity_received: Decimal


class PurchaseReceiptCreateRequest(BaseModel):
    branch_id: int
    purchase_order_id: int
    receipt_date: date
    notes: Optional[str] = None
    items: List[ReceiptItemIn]


class ReceiptItemOut(BaseModel):
    id: int
    purchase_order_item_id: int
    product_id: int
    product_name: str
    quantity_received: Decimal
    unit: str

    class Config:
        from_attributes = True


class PurchaseReceiptOut(BaseModel):
    id: int
    grn_number: str
    branch_id: int
    branch_name: str
    purchase_order_id: int
    po_number: str
    supplier_name: str
    receipt_date: date
    status: str
    notes: Optional[str]

    class Config:
        from_attributes = True


class PurchaseReceiptDetailOut(PurchaseReceiptOut):
    items: List[ReceiptItemOut]


class PurchaseBillCreateRequest(BaseModel):
    branch_id: int
    supplier_id: int
    purchase_order_id: Optional[int] = None
    bill_date: date
    due_date: date
    items: List[LineItemIn]


class PurchaseBillOut(BaseModel):
    id: int
    bill_number: str
    branch_id: int
    branch_name: str
    supplier_id: int
    supplier_name: str
    purchase_order_id: Optional[int]
    bill_date: date
    due_date: date
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal

    class Config:
        from_attributes = True


class PurchaseBillDetailOut(PurchaseBillOut):
    items: List[LineItemOut]


class PurchaseBillPaymentRequest(BaseModel):
    amount: Decimal
    payment_date: date
    payment_method: str = "bank_transfer"
    reference_number: Optional[str] = None


class PurchaseOverviewOut(BaseModel):
    total_suppliers: int
    open_purchase_orders: int
    pending_receipts: int
    bills_due_amount: Decimal
    bills_overdue_count: int
    recent_orders: List[PurchaseOrderOut]


# ============================================================
# MANUFACTURING MODULE
# ============================================================
class WorkCenterCreateRequest(BaseModel):
    name: str
    code: str
    branch_id: int
    description: Optional[str] = None
    capacity_per_day: int = 0


class WorkCenterUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity_per_day: Optional[int] = None
    status: Optional[str] = None


class WorkCenterOut(BaseModel):
    id: int
    name: str
    code: str
    branch_id: int
    branch_name: str
    description: Optional[str]
    capacity_per_day: int
    status: str
    active_work_orders: int = 0

    class Config:
        from_attributes = True


class BomComponentIn(BaseModel):
    component_product_id: int
    quantity_required: Decimal
    unit: str = "unit"


class BomComponentOut(BaseModel):
    id: int
    component_product_id: int
    component_product_name: str
    quantity_required: Decimal
    unit: str

    class Config:
        from_attributes = True


class BomCreateRequest(BaseModel):
    product_id: int
    bom_name: str
    version: str = "v1"
    notes: Optional[str] = None
    components: List[BomComponentIn]


class BomUpdateRequest(BaseModel):
    bom_name: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    components: Optional[List[BomComponentIn]] = None


class BomOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    bom_name: str
    version: str
    status: str
    notes: Optional[str]

    class Config:
        from_attributes = True


class BomDetailOut(BomOut):
    components: List[BomComponentOut]


class WorkOrderCreateRequest(BaseModel):
    branch_id: int
    product_id: int
    bom_id: Optional[int] = None
    work_center_id: Optional[int] = None
    quantity_planned: Decimal
    priority: str = "medium"
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None


class WorkOrderUpdateRequest(BaseModel):
    work_center_id: Optional[int] = None
    quantity_planned: Optional[Decimal] = None
    priority: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None


class WorkOrderStageRequest(BaseModel):
    current_stage: str
    progress_pct: int


class WorkOrderCompleteRequest(BaseModel):
    quantity_completed: Decimal


class WorkOrderOut(BaseModel):
    id: int
    wo_number: str
    branch_id: int
    branch_name: str
    product_id: int
    product_name: str
    bom_id: Optional[int]
    work_center_id: Optional[int]
    work_center_name: Optional[str] = None
    quantity_planned: Decimal
    quantity_completed: Decimal
    status: str
    priority: str
    current_stage: str
    progress_pct: int
    materials_issued: bool
    start_date: Optional[date]
    due_date: Optional[date]
    notes: Optional[str]

    class Config:
        from_attributes = True


class MaterialIssueOut(BaseModel):
    id: int
    component_product_id: int
    component_product_name: str
    quantity_issued: Decimal

    class Config:
        from_attributes = True


class WorkOrderDetailOut(WorkOrderOut):
    material_issues: List[MaterialIssueOut] = []
    bom_components: List[BomComponentOut] = []


class ManufacturingOverviewOut(BaseModel):
    total_work_orders: int
    in_progress_count: int
    completed_this_month: int
    total_work_centers: int
    active_boms: int
    recent_work_orders: List[WorkOrderOut]


# ============================================================
# HR & EMPLOYEE
# ============================================================
class DepartmentCreateRequest(BaseModel):
    department_name: str
    head_user_id: Optional[int] = None


class DepartmentUpdateRequest(BaseModel):
    department_name: Optional[str] = None
    head_user_id: Optional[int] = None


class DepartmentOut(BaseModel):
    id: int
    department_name: str
    head_user_id: Optional[int]
    head_name: Optional[str] = None
    employee_count: int = 0

    class Config:
        from_attributes = True


class EmployeeCreateRequest(BaseModel):
    full_name: str
    designation: str
    branch_id: int
    department_id: Optional[int] = None
    user_id: Optional[int] = None
    employment_type: str = "full_time"
    date_of_joining: date
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    personal_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    reporting_manager_id: Optional[int] = None
    ctc_annual: Optional[Decimal] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    pan: Optional[str] = None


class EmployeeUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    designation: Optional[str] = None
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    employment_type: Optional[str] = None
    gender: Optional[str] = None
    personal_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    reporting_manager_id: Optional[int] = None
    ctc_annual: Optional[Decimal] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    pan: Optional[str] = None
    status: Optional[str] = None
    exit_date: Optional[date] = None


class EmployeeOut(BaseModel):
    id: int
    employee_code: str
    full_name: str
    designation: str
    branch_id: int
    branch_name: str
    department_id: Optional[int]
    department_name: Optional[str] = None
    employment_type: str
    date_of_joining: date
    status: str
    reporting_manager_id: Optional[int]
    reporting_manager_name: Optional[str] = None
    phone: Optional[str]
    personal_email: Optional[str]

    class Config:
        from_attributes = True


class EmployeeDetailOut(EmployeeOut):
    date_of_birth: Optional[date]
    gender: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    ctc_annual: Optional[Decimal]
    bank_account_number: Optional[str]
    bank_ifsc: Optional[str]
    pan: Optional[str]
    exit_date: Optional[date]
    leave_balance_summary: List["LeaveBalanceOut"] = []


class EmployeeStatsOut(BaseModel):
    total_employees: int
    active_employees: int
    on_leave_today: int
    new_hires_this_month: int


class LeaveTypeCreate(BaseModel):
    leave_type_name: str
    annual_quota: Decimal = Decimal("0")
    is_paid: bool = True


class LeaveTypeOut(BaseModel):
    id: int
    leave_type_name: str
    annual_quota: Decimal
    is_paid: bool

    class Config:
        from_attributes = True


class LeaveBalanceOut(BaseModel):
    leave_type_id: int
    leave_type_name: str
    annual_quota: Decimal
    used_days: Decimal
    balance_days: Decimal


class LeaveRequestCreateRequest(BaseModel):
    employee_id: int
    leave_type_id: int
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveRequestDecisionRequest(BaseModel):
    status: str  # approved | rejected
    note: Optional[str] = None


class LeaveRequestOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    leave_type_id: int
    leave_type_name: str
    start_date: date
    end_date: date
    total_days: Decimal
    reason: Optional[str]
    status: str
    applied_at: datetime

    class Config:
        from_attributes = True


class AttendanceRecordIn(BaseModel):
    employee_id: int
    attendance_date: date
    status: str
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    notes: Optional[str] = None


class AttendanceBulkMarkRequest(BaseModel):
    branch_id: int
    attendance_date: date
    records: List[AttendanceRecordIn]


class AttendanceRecordOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    branch_id: int
    attendance_date: date
    status: str
    check_in_time: Optional[time]
    check_out_time: Optional[time]

    class Config:
        from_attributes = True


class AttendanceSummaryOut(BaseModel):
    attendance_date: date
    present_count: int
    absent_count: int
    on_leave_count: int
    half_day_count: int
    present_pct: int


class PayslipCreateRequest(BaseModel):
    employee_id: int
    pay_month: int
    pay_year: int
    basic: Decimal = Decimal("0")
    hra: Decimal = Decimal("0")
    other_allowances: Decimal = Decimal("0")
    deductions: Decimal = Decimal("0")


class PayslipOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    pay_month: int
    pay_year: int
    basic: Decimal
    hra: Decimal
    other_allowances: Decimal
    deductions: Decimal
    net_pay: Decimal
    status: str
    paid_on: Optional[date]

    class Config:
        from_attributes = True


class PayslipLeaveLine(BaseModel):
    leave_type_name: str
    is_paid: bool
    days: Decimal


class PayslipDetailOut(PayslipOut):
    employee_code: str
    designation: str
    department_name: Optional[str] = None
    branch_name: str
    employment_type: str
    date_of_joining: date
    pan: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    attendance_recorded: int
    present_days: int
    half_days: int
    absent_days: int
    on_leave_days: int
    holiday_days: int
    week_off_days: int
    leave_lines: List[PayslipLeaveLine] = []


class HrOverviewOut(BaseModel):
    total_employees: int
    active_employees: int
    pending_leave_requests: int
    on_leave_today: int
    open_departments: int


# ============================================================
# FINANCE & GST
# ============================================================
class FinanceOverviewOut(BaseModel):
    cash_and_bank_balance: Decimal
    outstanding_receivables: Decimal
    outstanding_payables: Decimal
    pending_expenses: int
    unposted_journal_entries: int


class ChartOfAccountCreateRequest(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    parent_account_id: Optional[int] = None


class ChartOfAccountUpdateRequest(BaseModel):
    account_name: Optional[str] = None
    parent_account_id: Optional[int] = None
    is_active: Optional[bool] = None


class ChartOfAccountOut(BaseModel):
    id: int
    account_code: str
    account_name: str
    account_type: str
    parent_account_id: Optional[int]
    is_system: bool
    is_active: bool

    class Config:
        from_attributes = True


class BankAccountCreateRequest(BaseModel):
    account_name: str
    bank_name: str
    account_number: str
    ifsc_code: Optional[str] = None
    account_type: str = "current"
    opening_balance: Decimal = Decimal("0")
    is_primary: bool = False


class BankAccountUpdateRequest(BaseModel):
    account_name: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    is_primary: Optional[bool] = None
    status: Optional[str] = None


class BankAccountOut(BaseModel):
    id: int
    account_name: str
    bank_name: str
    account_number: str
    ifsc_code: Optional[str]
    account_type: str
    opening_balance: Decimal
    current_balance: Decimal
    is_primary: bool
    status: str

    class Config:
        from_attributes = True


class JournalLineIn(BaseModel):
    account_id: int
    debit_amount: Decimal = Decimal("0")
    credit_amount: Decimal = Decimal("0")
    description: Optional[str] = None


class JournalLineOut(BaseModel):
    id: int
    account_id: int
    account_name: str
    account_code: str
    debit_amount: Decimal
    credit_amount: Decimal
    description: Optional[str]


class JournalEntryCreateRequest(BaseModel):
    branch_id: int
    entry_date: date
    reference: Optional[str] = None
    narration: Optional[str] = None
    lines: List[JournalLineIn]


class JournalEntryOut(BaseModel):
    id: int
    entry_number: str
    branch_id: int
    branch_name: str
    entry_date: date
    reference: Optional[str]
    narration: Optional[str]
    status: str
    total_debit: Decimal
    total_credit: Decimal
    source_type: str


class JournalEntryDetailOut(JournalEntryOut):
    lines: List[JournalLineOut]


class ExpenseCreateRequest(BaseModel):
    branch_id: int
    expense_date: date
    category: str
    account_id: int
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    amount: Decimal
    tax_rate: Decimal = Decimal("0")
    payment_method: str = "bank_transfer"
    bank_account_id: Optional[int] = None


class ExpenseUpdateRequest(BaseModel):
    category: Optional[str] = None
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    payment_method: Optional[str] = None
    bank_account_id: Optional[int] = None


class ExpenseOut(BaseModel):
    id: int
    expense_number: str
    branch_id: int
    branch_name: str
    expense_date: date
    category: str
    account_id: int
    account_name: str
    vendor_name: Optional[str]
    description: Optional[str]
    amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    payment_method: str
    status: str


class ExpenseStatsOut(BaseModel):
    total_this_month: Decimal
    pending_count: int
    paid_this_month: Decimal
    top_category: Optional[str]


class GstReturnSummaryOut(BaseModel):
    return_month: int
    return_year: int
    taxable_outward_supplies: Decimal
    output_tax: Decimal
    taxable_inward_supplies: Decimal
    input_tax_credit: Decimal
    net_tax_payable: Decimal
    invoice_count: int
    bill_count: int
    filing_status: str
    filed_on: Optional[date]
    arn: Optional[str]


class GstFileRequest(BaseModel):
    return_month: int
    return_year: int
    arn: Optional[str] = None


class GstFilingOut(BaseModel):
    id: int
    return_month: int
    return_year: int
    taxable_outward_supplies: Decimal
    output_tax: Decimal
    taxable_inward_supplies: Decimal
    input_tax_credit: Decimal
    net_tax_payable: Decimal
    status: str
    filed_on: Optional[date]
    arn: Optional[str]

    class Config:
        from_attributes = True


class ProfitAndLossOut(BaseModel):
    period_label: str
    total_income: Decimal
    total_expense: Decimal
    net_profit: Decimal
    income_breakdown: List[dict]
    expense_breakdown: List[dict]


# ============================================================
# SERVICE DESK
# ============================================================
class TicketCategoryCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class TicketCategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    open_ticket_count: int = 0

    class Config:
        from_attributes = True


class SlaPolicyCreateRequest(BaseModel):
    priority: str
    response_hours: int
    resolution_hours: int


class SlaPolicyOut(BaseModel):
    id: int
    priority: str
    response_hours: int
    resolution_hours: int

    class Config:
        from_attributes = True


class TicketCreateRequest(BaseModel):
    branch_id: int
    customer_id: Optional[int] = None
    category_id: Optional[int] = None
    subject: str
    description: Optional[str] = None
    priority: str = "medium"
    assigned_to_user_id: Optional[int] = None


class TicketUpdateRequest(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    priority: Optional[str] = None
    assigned_to_user_id: Optional[int] = None


class TicketStatusUpdateRequest(BaseModel):
    status: str


class TicketCommentCreateRequest(BaseModel):
    message: str
    is_internal: bool = False


class TicketCommentOut(BaseModel):
    id: int
    user_id: Optional[int]
    user_name: Optional[str]
    message: str
    is_internal: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TicketOut(BaseModel):
    id: int
    ticket_number: str
    branch_id: int
    branch_name: str
    customer_id: Optional[int]
    customer_name: Optional[str]
    category_id: Optional[int]
    category_name: Optional[str]
    subject: str
    priority: str
    status: str
    assigned_to_user_id: Optional[int]
    assignee_name: Optional[str]
    response_due_at: Optional[datetime]
    resolution_due_at: Optional[datetime]
    is_response_breached: bool
    is_resolution_breached: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TicketDetailOut(TicketOut):
    description: Optional[str]
    first_responded_at: Optional[datetime]
    resolved_at: Optional[datetime]
    closed_at: Optional[datetime]
    comments: List[TicketCommentOut]


class TicketStatsOut(BaseModel):
    total_open: int
    unassigned: int
    breached_sla: int
    resolved_this_month: int
    avg_resolution_hours: Optional[float]


class ServiceDeskOverviewOut(BaseModel):
    open_tickets: int
    urgent_tickets: int
    breached_sla: int
    resolved_this_month: int
