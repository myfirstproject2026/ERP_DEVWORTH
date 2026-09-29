-- ============================================================
-- NEXUS ERP - MySQL Database Schema
-- Module: Login & Company Setup + Dashboard + AI Assistant
-- ============================================================

CREATE DATABASE IF NOT EXISTS nexus_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nexus_erp;

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE companies (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_name        VARCHAR(150) NOT NULL,
    business_type       VARCHAR(60)  NOT NULL,
    industry            VARCHAR(100) NOT NULL,
    cin                 VARCHAR(30),
    contact_number      VARCHAR(20)  NOT NULL,
    business_email      VARCHAR(150) NOT NULL,
    address_line        VARCHAR(255) NOT NULL,
    city                VARCHAR(100) NOT NULL,
    state               VARCHAR(100) NOT NULL,
    pin_code            VARCHAR(10)  NOT NULL,
    country             VARCHAR(80)  NOT NULL DEFAULT 'India',
    gstin               VARCHAR(20)  NOT NULL,
    pan                 VARCHAR(15)  NOT NULL,
    default_gst_rate    DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    financial_year_start VARCHAR(20) NOT NULL DEFAULT 'April',
    logo_url            VARCHAR(255),
    plan_name           VARCHAR(60)  NOT NULL DEFAULT 'Business',
    plan_billing        VARCHAR(30)  NOT NULL DEFAULT 'billed annually',
    status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
    member_since        DATE NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_companies_gstin (gstin),
    UNIQUE KEY uq_companies_email (business_email),
    INDEX idx_companies_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- ROLES  (per-company custom roles)
-- ============================================================
CREATE TABLE roles (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    role_name       VARCHAR(80) NOT NULL,
    description     VARCHAR(255),
    access_level    ENUM('full','high','medium','limited') NOT NULL DEFAULT 'limited',
    is_system_role  TINYINT(1) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_roles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_role_per_company (company_id, role_name),
    INDEX idx_roles_company (company_id)
) ENGINE=InnoDB;

-- ============================================================
-- MODULES (static reference list — matches sidebar)
-- ============================================================
CREATE TABLE modules (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    module_key    VARCHAR(60) NOT NULL UNIQUE,
    module_name   VARCHAR(100) NOT NULL,
    category      ENUM('main','login_setup','workspace') NOT NULL,
    sort_order    INT NOT NULL DEFAULT 0,
    is_active     TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ============================================================
-- ROLE_PERMISSIONS  (module-level grid: view/add/edit/delete/approve)
-- ============================================================
CREATE TABLE role_permissions (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id       BIGINT UNSIGNED NOT NULL,
    module_id     BIGINT UNSIGNED NOT NULL,
    can_view      TINYINT(1) NOT NULL DEFAULT 0,
    can_add       TINYINT(1) NOT NULL DEFAULT 0,
    can_edit      TINYINT(1) NOT NULL DEFAULT 0,
    can_delete    TINYINT(1) NOT NULL DEFAULT 0,
    can_approve   TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    UNIQUE KEY uq_role_module (role_id, module_id),
    INDEX idx_rp_role (role_id)
) ENGINE=InnoDB;

-- ============================================================
-- BRANCHES
-- ============================================================
CREATE TABLE branches (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    branch_name     VARCHAR(120) NOT NULL,
    branch_type     ENUM('Head Office','Warehouse','Sales Office','Plant','Depot','Other') NOT NULL DEFAULT 'Warehouse',
    address         VARCHAR(255) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    state           VARCHAR(100) NOT NULL,
    manager_user_id BIGINT UNSIGNED NULL,
    gstin           VARCHAR(20) NULL,
    status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
    is_default      TINYINT(1) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_branches_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_branches_company (company_id),
    INDEX idx_branches_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    branch_id       BIGINT UNSIGNED NULL,
    role_id         BIGINT UNSIGNED NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    mobile_number   VARCHAR(20),
    password_hash   VARCHAR(255) NULL,
    login_method    ENUM('password','otp','email_invite') NOT NULL DEFAULT 'email_invite',
    is_owner        TINYINT(1) NOT NULL DEFAULT 0,
    status          ENUM('active','invited','suspended') NOT NULL DEFAULT 'invited',
    last_login_at   TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_users_branch  FOREIGN KEY (branch_id)  REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_users_role    FOREIGN KEY (role_id)    REFERENCES roles(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_users_email_company (company_id, email),
    INDEX idx_users_company (company_id),
    INDEX idx_users_status (status),
    INDEX idx_users_branch (branch_id)
) ENGINE=InnoDB;

ALTER TABLE branches
    ADD CONSTRAINT fk_branch_manager FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- OTP LOGIN
-- ============================================================
CREATE TABLE otp_requests (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT UNSIGNED NOT NULL,
    otp_code      VARCHAR(6) NOT NULL,
    is_used       TINYINT(1) NOT NULL DEFAULT 0,
    expires_at    TIMESTAMP NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_otp_user (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- CUSTOMERS  (for dashboard follow-up + AI assistant)
-- ============================================================
CREATE TABLE customers (
    id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id           BIGINT UNSIGNED NOT NULL,
    customer_name        VARCHAR(150) NOT NULL,
    customer_type        VARCHAR(60),
    city                 VARCHAR(100),
    zone                 VARCHAR(100),
    phone                VARCHAR(20),
    email                VARCHAR(150) NULL,
    gstin                VARCHAR(20) NULL,
    billing_address      VARCHAR(255) NULL,
    shipping_address     VARCHAR(255) NULL,
    branch_id            BIGINT UNSIGNED NULL,
    assigned_to_user_id  BIGINT UNSIGNED NULL,
    lead_source          VARCHAR(60) NULL,
    status               ENUM('active','inactive') NOT NULL DEFAULT 'active',
    credit_limit         DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes                TEXT NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customers_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_customers_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_customers_assigned_user FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_customers_company (company_id),
    INDEX idx_customers_status (status)
) ENGINE=InnoDB;

CREATE TABLE customer_dues (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id     BIGINT UNSIGNED NOT NULL,
    company_id      BIGINT UNSIGNED NOT NULL,
    amount          DECIMAL(14,2) NOT NULL,
    status          ENUM('overdue','due_soon','received') NOT NULL,
    days_overdue    INT NOT NULL DEFAULT 0,
    last_order_days_ago INT NULL,
    due_date        DATE NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cd_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_cd_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_cd_company (company_id),
    INDEX idx_cd_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- SALES + CRM MODULE — leads, quotations, orders, invoices
-- ============================================================
CREATE TABLE leads (
    id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id            BIGINT UNSIGNED NOT NULL,
    branch_id             BIGINT UNSIGNED NULL,
    lead_name             VARCHAR(150) NOT NULL,
    company_name          VARCHAR(150) NULL,
    contact_person        VARCHAR(120) NULL,
    email                 VARCHAR(150) NULL,
    phone                 VARCHAR(20) NULL,
    source                ENUM('website','referral','cold_call','social_media','trade_show','other') NOT NULL DEFAULT 'other',
    status                ENUM('new','contacted','qualified','proposal','won','lost') NOT NULL DEFAULT 'new',
    estimated_value       DECIMAL(14,2) NOT NULL DEFAULT 0,
    assigned_to_user_id   BIGINT UNSIGNED NULL,
    converted_customer_id BIGINT UNSIGNED NULL,
    notes                 TEXT NULL,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_leads_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_leads_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_leads_assigned_user FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_leads_converted_customer FOREIGN KEY (converted_customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_leads_company (company_id),
    INDEX idx_leads_status (status)
) ENGINE=InnoDB;

CREATE TABLE quotations (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id        BIGINT UNSIGNED NOT NULL,
    branch_id         BIGINT UNSIGNED NULL,
    quotation_number  VARCHAR(30) NOT NULL,
    customer_id       BIGINT UNSIGNED NOT NULL,
    lead_id           BIGINT UNSIGNED NULL,
    quotation_date    DATE NOT NULL,
    valid_until       DATE NULL,
    status            ENUM('draft','sent','accepted','rejected','expired') NOT NULL DEFAULT 'draft',
    subtotal          DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes             TEXT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_quotations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_quotations_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_quotations_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_quotations_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    CONSTRAINT fk_quotations_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_quotation_number (company_id, quotation_number),
    INDEX idx_quotations_company (company_id),
    INDEX idx_quotations_status (status)
) ENGINE=InnoDB;

CREATE TABLE quotation_items (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quotation_id  BIGINT UNSIGNED NOT NULL,
    product_name  VARCHAR(150) NOT NULL,
    description   VARCHAR(255) NULL,
    quantity      DECIMAL(12,2) NOT NULL DEFAULT 1,
    unit          VARCHAR(20) NOT NULL DEFAULT 'unit',
    unit_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate      DECIMAL(5,2) NOT NULL DEFAULT 0,
    line_total    DECIMAL(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_qi_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
    INDEX idx_qi_quotation (quotation_id)
) ENGINE=InnoDB;

CREATE TABLE sales_orders (
    id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id             BIGINT UNSIGNED NOT NULL,
    branch_id              BIGINT UNSIGNED NULL,
    order_number           VARCHAR(30) NOT NULL,
    customer_id            BIGINT UNSIGNED NOT NULL,
    quotation_id           BIGINT UNSIGNED NULL,
    order_date             DATE NOT NULL,
    expected_delivery_date DATE NULL,
    status                 ENUM('pending','confirmed','processing','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
    subtotal               DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount             DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount           DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes                  TEXT NULL,
    created_by_user_id     BIGINT UNSIGNED NULL,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_so_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_so_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_so_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_so_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
    CONSTRAINT fk_so_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_order_number (company_id, order_number),
    INDEX idx_so_company (company_id),
    INDEX idx_so_status (status)
) ENGINE=InnoDB;

CREATE TABLE sales_order_items (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sales_order_id BIGINT UNSIGNED NOT NULL,
    product_name   VARCHAR(150) NOT NULL,
    description    VARCHAR(255) NULL,
    quantity       DECIMAL(12,2) NOT NULL DEFAULT 1,
    unit           VARCHAR(20) NOT NULL DEFAULT 'unit',
    unit_price     DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate       DECIMAL(5,2) NOT NULL DEFAULT 0,
    line_total     DECIMAL(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_soi_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    INDEX idx_soi_order (sales_order_id)
) ENGINE=InnoDB;

CREATE TABLE invoices (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id         BIGINT UNSIGNED NOT NULL,
    branch_id          BIGINT UNSIGNED NULL,
    invoice_number     VARCHAR(30) NOT NULL,
    customer_id        BIGINT UNSIGNED NOT NULL,
    sales_order_id     BIGINT UNSIGNED NULL,
    invoice_date       DATE NOT NULL,
    due_date           DATE NULL,
    status             ENUM('draft','sent','partially_paid','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
    subtotal           DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount         DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount       DECIMAL(14,2) NOT NULL DEFAULT 0,
    amount_paid        DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes              TEXT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inv_sales_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_invoice_number (company_id, invoice_number),
    INDEX idx_inv_company (company_id),
    INDEX idx_inv_status (status)
) ENGINE=InnoDB;

CREATE TABLE invoice_items (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_id   BIGINT UNSIGNED NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    description  VARCHAR(255) NULL,
    quantity     DECIMAL(12,2) NOT NULL DEFAULT 1,
    unit         VARCHAR(20) NOT NULL DEFAULT 'unit',
    unit_price   DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate     DECIMAL(5,2) NOT NULL DEFAULT 0,
    line_total   DECIMAL(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_ii_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_ii_invoice (invoice_id)
) ENGINE=InnoDB;

CREATE TABLE invoice_payments (
    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_id       BIGINT UNSIGNED NOT NULL,
    amount           DECIMAL(14,2) NOT NULL,
    payment_date     DATE NOT NULL,
    payment_method   ENUM('cash','bank_transfer','upi','cheque','card','other') NOT NULL DEFAULT 'bank_transfer',
    reference_number VARCHAR(60) NULL,
    notes            VARCHAR(255) NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ip_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_ip_invoice (invoice_id)
) ENGINE=InnoDB;

-- ============================================================
-- DASHBOARD METRICS
-- ============================================================
CREATE TABLE daily_metrics (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    metric_date     DATE NOT NULL,
    todays_sales    DECIMAL(14,2) NOT NULL DEFAULT 0,
    sales_change_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
    todays_purchase DECIMAL(14,2) NOT NULL DEFAULT 0,
    purchase_change_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
    pending_payments DECIMAL(14,2) NOT NULL DEFAULT 0,
    overdue_invoice_count INT NOT NULL DEFAULT 0,
    stock_alert_count INT NOT NULL DEFAULT 0,
    below_reorder_count INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_dm_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_dm_company_date (company_id, metric_date)
) ENGINE=InnoDB;

CREATE TABLE profit_loss_monthly (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id    BIGINT UNSIGNED NOT NULL,
    month_label   VARCHAR(10) NOT NULL,
    month_order   INT NOT NULL,
    revenue_lakhs DECIMAL(10,2) NOT NULL,
    net_profit_lakhs DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_pl_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_pl_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE production_orders (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id    BIGINT UNSIGNED NOT NULL,
    wo_number     VARCHAR(30) NOT NULL,
    product_name  VARCHAR(150) NOT NULL,
    units         INT NOT NULL,
    stage         VARCHAR(80) NOT NULL,
    progress_pct  INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_po_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_po_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE attendance_daily (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id    BIGINT UNSIGNED NOT NULL,
    attendance_date DATE NOT NULL,
    present_count INT NOT NULL DEFAULT 0,
    on_leave_count INT NOT NULL DEFAULT 0,
    absent_count  INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_att_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_att_company_date (company_id, attendance_date)
) ENGINE=InnoDB;

-- ============================================================
-- PRODUCTS  (for AI assistant "fast moving product" queries)
-- ============================================================
CREATE TABLE products (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id        BIGINT UNSIGNED NOT NULL,
    product_name      VARCHAR(150) NOT NULL,
    sku               VARCHAR(60),
    category          VARCHAR(80),
    unit_of_measure   VARCHAR(20) NOT NULL DEFAULT 'unit',
    hsn_code          VARCHAR(20),
    cost_price        DECIMAL(12,2) NOT NULL DEFAULT 0,
    selling_price     DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate          DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    reorder_level     INT NOT NULL DEFAULT 0,
    reorder_quantity  INT NOT NULL DEFAULT 0,
    barcode           VARCHAR(60),
    description       VARCHAR(255),
    primary_branch_id BIGINT UNSIGNED NULL,
    status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
    units_sold_month  INT NOT NULL DEFAULT 0,
    change_pct        DECIMAL(6,2) NOT NULL DEFAULT 0,
    current_stock     INT NOT NULL DEFAULT 0,
    daily_run_rate    DECIMAL(8,2) NOT NULL DEFAULT 0,
    supplier_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
    reorder_suggested_units INT NOT NULL DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_products_primary_branch FOREIGN KEY (primary_branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    UNIQUE KEY uq_products_sku_company (company_id, sku),
    INDEX idx_products_company (company_id),
    INDEX idx_products_category (category),
    INDEX idx_products_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- INVENTORY — STOCK LEVELS, MOVEMENTS, TRANSFERS, ADJUSTMENTS
-- ============================================================
CREATE TABLE stock_levels (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    product_id          BIGINT UNSIGNED NOT NULL,
    branch_id           BIGINT UNSIGNED NOT NULL,
    quantity_on_hand    DECIMAL(12,2) NOT NULL DEFAULT 0,
    quantity_reserved   DECIMAL(12,2) NOT NULL DEFAULT 0,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sl_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_sl_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_sl_branch  FOREIGN KEY (branch_id)  REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE KEY uq_stock_product_branch (product_id, branch_id),
    INDEX idx_sl_company (company_id),
    INDEX idx_sl_branch (branch_id)
) ENGINE=InnoDB;

CREATE TABLE stock_movements (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    product_id      BIGINT UNSIGNED NOT NULL,
    branch_id       BIGINT UNSIGNED NOT NULL,
    movement_type   ENUM('purchase_in','sale_out','transfer_in','transfer_out',
                          'adjustment_in','adjustment_out','production_consume','production_output') NOT NULL,
    quantity        DECIMAL(12,2) NOT NULL,
    reference_type  VARCHAR(40) NULL,
    reference_id    BIGINT UNSIGNED NULL,
    balance_after   DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes           VARCHAR(255) NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sm_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_sm_branch  FOREIGN KEY (branch_id)  REFERENCES branches(id) ON DELETE CASCADE,
    CONSTRAINT fk_sm_user    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_sm_company (company_id),
    INDEX idx_sm_product (product_id),
    INDEX idx_sm_branch (branch_id),
    INDEX idx_sm_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE stock_transfers (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    transfer_number VARCHAR(30) NOT NULL,
    from_branch_id  BIGINT UNSIGNED NOT NULL,
    to_branch_id    BIGINT UNSIGNED NOT NULL,
    transfer_date   DATE NOT NULL,
    status          ENUM('pending','in_transit','completed','cancelled') NOT NULL DEFAULT 'pending',
    notes           VARCHAR(255) NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_st_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_st_from FOREIGN KEY (from_branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_st_to   FOREIGN KEY (to_branch_id)   REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_st_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_transfer_number (company_id, transfer_number),
    INDEX idx_st_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE stock_transfer_items (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    transfer_id     BIGINT UNSIGNED NOT NULL,
    product_id      BIGINT UNSIGNED NOT NULL,
    quantity        DECIMAL(12,2) NOT NULL,
    received_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_sti_transfer FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
    CONSTRAINT fk_sti_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_sti_transfer (transfer_id)
) ENGINE=InnoDB;

CREATE TABLE stock_adjustments (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    branch_id           BIGINT UNSIGNED NOT NULL,
    adjustment_number   VARCHAR(30) NOT NULL,
    adjustment_date     DATE NOT NULL,
    reason              ENUM('damage','loss','found','correction','other') NOT NULL DEFAULT 'correction',
    status              ENUM('draft','completed') NOT NULL DEFAULT 'draft',
    notes               VARCHAR(255) NULL,
    created_by_user_id  BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sa_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_sa_branch  FOREIGN KEY (branch_id)  REFERENCES branches(id) ON DELETE CASCADE,
    CONSTRAINT fk_sa_user    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_adjustment_number (company_id, adjustment_number),
    INDEX idx_sa_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE stock_adjustment_items (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    adjustment_id   BIGINT UNSIGNED NOT NULL,
    product_id      BIGINT UNSIGNED NOT NULL,
    quantity_change DECIMAL(12,2) NOT NULL COMMENT 'positive = stock added, negative = stock removed',
    reason_note     VARCHAR(255) NULL,
    CONSTRAINT fk_sai_adjustment FOREIGN KEY (adjustment_id) REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    CONSTRAINT fk_sai_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_sai_adjustment (adjustment_id)
) ENGINE=InnoDB;

-- ============================================================
-- AI ASSISTANT
-- ============================================================
CREATE TABLE ai_conversations (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id    BIGINT UNSIGNED NOT NULL,
    user_id       BIGINT UNSIGNED NOT NULL,
    title         VARCHAR(150) NOT NULL DEFAULT 'New conversation',
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_aic_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_aic_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_aic_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE ai_messages (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversation_id   BIGINT UNSIGNED NOT NULL,
    sender            ENUM('user','assistant') NOT NULL,
    content           TEXT NOT NULL,
    payload_json      JSON NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_aim_conv FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
    INDEX idx_aim_conv (conversation_id)
) ENGINE=InnoDB;

CREATE TABLE connected_channels (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id    BIGINT UNSIGNED NOT NULL,
    channel_name  VARCHAR(60) NOT NULL,
    status        ENUM('connected','disconnected') NOT NULL DEFAULT 'disconnected',
    CONSTRAINT fk_cc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_cc_company_channel (company_id, channel_name)
) ENGINE=InnoDB;

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_logs (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id    BIGINT UNSIGNED NOT NULL,
    user_id       BIGINT UNSIGNED NULL,
    action        VARCHAR(120) NOT NULL,
    entity_type   VARCHAR(60) NOT NULL,
    entity_id     BIGINT UNSIGNED NULL,
    details       JSON NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_audit_company (company_id)
) ENGINE=InnoDB;


-- ============================================================
-- PURCHASE MODULE — suppliers, POs, GRN, bills, payments
-- ============================================================

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE suppliers (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    supplier_name       VARCHAR(150) NOT NULL,
    contact_person      VARCHAR(120),
    email               VARCHAR(150),
    phone               VARCHAR(20),
    gstin               VARCHAR(20),
    billing_address     VARCHAR(255),
    category            VARCHAR(80),
    payment_terms       VARCHAR(60) DEFAULT 'Net 30',
    rating              DECIMAL(2,1) DEFAULT 0,
    status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
    assigned_to_user_id BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_suppliers_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_suppliers_user FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_suppliers_company (company_id),
    INDEX idx_suppliers_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE purchase_orders (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    branch_id           BIGINT UNSIGNED NOT NULL,
    po_number           VARCHAR(30) NOT NULL,
    supplier_id         BIGINT UNSIGNED NOT NULL,
    po_date             DATE NOT NULL,
    expected_delivery_date DATE NULL,
    status              ENUM('draft','sent','confirmed','partially_received','received','cancelled')
                        NOT NULL DEFAULT 'draft',
    subtotal            DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount          DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes               VARCHAR(255),
    created_by_user_id  BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_purchord_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_purchord_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchord_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchord_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_purchord_number (company_id, po_number),
    INDEX idx_purchord_company (company_id),
    INDEX idx_purchord_supplier (supplier_id),
    INDEX idx_purchord_status (status)
) ENGINE=InnoDB;

CREATE TABLE purchase_order_items (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id   BIGINT UNSIGNED NOT NULL,
    product_id          BIGINT UNSIGNED NULL,
    product_name        VARCHAR(150) NOT NULL,
    description         VARCHAR(255),
    quantity            DECIMAL(12,2) NOT NULL,
    unit                VARCHAR(20) NOT NULL DEFAULT 'unit',
    unit_price          DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate            DECIMAL(5,2) NOT NULL DEFAULT 0,
    line_total          DECIMAL(14,2) NOT NULL DEFAULT 0,
    received_quantity   DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_poi_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_poi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_poi_po (purchase_order_id)
) ENGINE=InnoDB;

-- ============================================================
-- GOODS RECEIPT NOTES (GRN)
-- ============================================================
CREATE TABLE purchase_receipts (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    branch_id           BIGINT UNSIGNED NOT NULL,
    grn_number          VARCHAR(30) NOT NULL,
    purchase_order_id   BIGINT UNSIGNED NOT NULL,
    receipt_date        DATE NOT NULL,
    status              ENUM('draft','completed') NOT NULL DEFAULT 'draft',
    notes               VARCHAR(255),
    created_by_user_id  BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_grn_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_grn_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_grn_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_grn_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_grn_number (company_id, grn_number),
    INDEX idx_grn_company (company_id),
    INDEX idx_grn_po (purchase_order_id)
) ENGINE=InnoDB;

CREATE TABLE purchase_receipt_items (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_receipt_id BIGINT UNSIGNED NOT NULL,
    purchase_order_item_id BIGINT UNSIGNED NOT NULL,
    product_id          BIGINT UNSIGNED NOT NULL,
    product_name        VARCHAR(150) NOT NULL,
    quantity_received   DECIMAL(12,2) NOT NULL,
    unit                VARCHAR(20) NOT NULL DEFAULT 'unit',
    CONSTRAINT fk_gri_grn FOREIGN KEY (purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    CONSTRAINT fk_gri_poi FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_gri_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_gri_grn (purchase_receipt_id)
) ENGINE=InnoDB;

-- ============================================================
-- PURCHASE BILLS (supplier invoices) + PAYMENTS
-- ============================================================
CREATE TABLE purchase_bills (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    branch_id           BIGINT UNSIGNED NOT NULL,
    bill_number         VARCHAR(30) NOT NULL,
    supplier_id         BIGINT UNSIGNED NOT NULL,
    purchase_order_id   BIGINT UNSIGNED NULL,
    bill_date           DATE NOT NULL,
    due_date            DATE NOT NULL,
    status              ENUM('draft','pending','partially_paid','paid','overdue','cancelled')
                        NOT NULL DEFAULT 'pending',
    subtotal            DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount          DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
    amount_paid         DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_by_user_id  BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bill_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_bill_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_bill_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_bill_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_bill_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_bill_number (company_id, bill_number),
    INDEX idx_bill_company (company_id),
    INDEX idx_bill_supplier (supplier_id),
    INDEX idx_bill_status (status)
) ENGINE=InnoDB;

CREATE TABLE purchase_bill_items (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_bill_id    BIGINT UNSIGNED NOT NULL,
    product_name        VARCHAR(150) NOT NULL,
    description         VARCHAR(255),
    quantity            DECIMAL(12,2) NOT NULL,
    unit                VARCHAR(20) NOT NULL DEFAULT 'unit',
    unit_price          DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate            DECIMAL(5,2) NOT NULL DEFAULT 0,
    line_total          DECIMAL(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_bi_bill FOREIGN KEY (purchase_bill_id) REFERENCES purchase_bills(id) ON DELETE CASCADE,
    INDEX idx_bi_bill (purchase_bill_id)
) ENGINE=InnoDB;

CREATE TABLE purchase_bill_payments (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_bill_id    BIGINT UNSIGNED NOT NULL,
    company_id          BIGINT UNSIGNED NOT NULL,
    amount              DECIMAL(14,2) NOT NULL,
    payment_date        DATE NOT NULL,
    payment_method      ENUM('bank_transfer','upi','cheque','cash','card','other') NOT NULL DEFAULT 'bank_transfer',
    reference_number    VARCHAR(60),
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bp_bill FOREIGN KEY (purchase_bill_id) REFERENCES purchase_bills(id) ON DELETE CASCADE,
    CONSTRAINT fk_bp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_bp_bill (purchase_bill_id)
) ENGINE=InnoDB;

USE nexus_erp;

-- ============================================================
-- WORK CENTERS (machines / production stations)
-- ============================================================
CREATE TABLE work_centers (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    branch_id       BIGINT UNSIGNED NOT NULL,
    name            VARCHAR(120) NOT NULL,
    code            VARCHAR(30) NOT NULL,
    description     VARCHAR(255),
    capacity_per_day INT NOT NULL DEFAULT 0,
    status          ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_wc_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_wc_code (company_id, code),
    INDEX idx_wc_company (company_id)
) ENGINE=InnoDB;

-- ============================================================
-- BILL OF MATERIALS
-- ============================================================
CREATE TABLE bill_of_materials (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    product_id      BIGINT UNSIGNED NOT NULL COMMENT 'finished good this BOM produces',
    bom_name        VARCHAR(150) NOT NULL,
    version         VARCHAR(20) NOT NULL DEFAULT 'v1',
    status          ENUM('draft','active','archived') NOT NULL DEFAULT 'active',
    notes           VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bom_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_bom_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_bom_company (company_id),
    INDEX idx_bom_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE bom_components (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bom_id              BIGINT UNSIGNED NOT NULL,
    component_product_id BIGINT UNSIGNED NOT NULL COMMENT 'raw material / sub-component consumed',
    quantity_required   DECIMAL(12,3) NOT NULL,
    unit                VARCHAR(20) NOT NULL DEFAULT 'unit',
    CONSTRAINT fk_bomc_bom FOREIGN KEY (bom_id) REFERENCES bill_of_materials(id) ON DELETE CASCADE,
    CONSTRAINT fk_bomc_product FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_bomc_bom (bom_id)
) ENGINE=InnoDB;

-- ============================================================
-- WORK ORDERS
-- ============================================================
CREATE TABLE work_orders (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    branch_id           BIGINT UNSIGNED NOT NULL,
    wo_number           VARCHAR(30) NOT NULL,
    product_id          BIGINT UNSIGNED NOT NULL COMMENT 'finished good being produced',
    bom_id              BIGINT UNSIGNED NULL,
    work_center_id      BIGINT UNSIGNED NULL,
    quantity_planned    DECIMAL(12,2) NOT NULL,
    quantity_completed  DECIMAL(12,2) NOT NULL DEFAULT 0,
    status              ENUM('draft','scheduled','in_progress','completed','cancelled')
                        NOT NULL DEFAULT 'draft',
    priority            ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
    current_stage       VARCHAR(80) NOT NULL DEFAULT 'Raw Material Prep',
    progress_pct        INT NOT NULL DEFAULT 0,
    materials_issued    TINYINT(1) NOT NULL DEFAULT 0,
    start_date          DATE NULL,
    due_date            DATE NULL,
    completed_at        TIMESTAMP NULL,
    notes               VARCHAR(255),
    created_by_user_id  BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wo_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_wo_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_wo_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_wo_bom FOREIGN KEY (bom_id) REFERENCES bill_of_materials(id) ON DELETE SET NULL,
    CONSTRAINT fk_wo_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id) ON DELETE SET NULL,
    CONSTRAINT fk_wo_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_wo_number (company_id, wo_number),
    INDEX idx_wo_company (company_id),
    INDEX idx_wo_status (status),
    INDEX idx_wo_product (product_id)
) ENGINE=InnoDB;

-- ============================================================
-- MATERIAL ISSUES (raw material consumption ledger per work order)
-- ============================================================
CREATE TABLE material_issues (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_order_id           BIGINT UNSIGNED NOT NULL,
    company_id              BIGINT UNSIGNED NOT NULL,
    component_product_id    BIGINT UNSIGNED NOT NULL,
    quantity_issued         DECIMAL(12,3) NOT NULL,
    branch_id               BIGINT UNSIGNED NOT NULL,
    issued_by_user_id       BIGINT UNSIGNED NULL,
    issued_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mi_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_mi_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_mi_product FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mi_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mi_user FOREIGN KEY (issued_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_mi_wo (work_order_id)
) ENGINE=InnoDB;

-- ============================================================
-- HR & EMPLOYEE MODULE
-- ============================================================

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    head_user_id    BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dept_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_dept_head FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_dept_company_name (company_id, department_name),
    INDEX idx_dept_company (company_id)
) ENGINE=InnoDB;

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE employees (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id              BIGINT UNSIGNED NOT NULL,
    user_id                 BIGINT UNSIGNED NULL COMMENT 'linked ERP login account, if any',
    branch_id               BIGINT UNSIGNED NOT NULL,
    department_id           BIGINT UNSIGNED NULL,
    employee_code           VARCHAR(30) NOT NULL,
    full_name               VARCHAR(120) NOT NULL,
    designation             VARCHAR(100) NOT NULL,
    employment_type         ENUM('full_time','part_time','contract','intern') NOT NULL DEFAULT 'full_time',
    date_of_joining         DATE NOT NULL,
    date_of_birth           DATE NULL,
    gender                  ENUM('male','female','other','prefer_not_to_say') NULL,
    personal_email          VARCHAR(150) NULL,
    phone                   VARCHAR(20) NULL,
    emergency_contact_name  VARCHAR(120) NULL,
    emergency_contact_phone VARCHAR(20) NULL,
    reporting_manager_id    BIGINT UNSIGNED NULL,
    ctc_annual              DECIMAL(12,2) NULL,
    bank_account_number     VARCHAR(30) NULL,
    bank_ifsc               VARCHAR(15) NULL,
    pan                     VARCHAR(15) NULL,
    status                  ENUM('active','on_leave','resigned','terminated') NOT NULL DEFAULT 'active',
    exit_date               DATE NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_emp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_emp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_emp_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_emp_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_emp_manager FOREIGN KEY (reporting_manager_id) REFERENCES employees(id) ON DELETE SET NULL,
    UNIQUE KEY uq_emp_company_code (company_id, employee_code),
    INDEX idx_emp_company (company_id),
    INDEX idx_emp_department (department_id),
    INDEX idx_emp_status (status),
    INDEX idx_emp_branch (branch_id)
) ENGINE=InnoDB;

-- ============================================================
-- LEAVE TYPES
-- ============================================================
CREATE TABLE leave_types (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    leave_type_name VARCHAR(60) NOT NULL,
    annual_quota    DECIMAL(5,1) NOT NULL DEFAULT 0,
    is_paid         TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_lt_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_lt_company_name (company_id, leave_type_name)
) ENGINE=InnoDB;

-- ============================================================
-- LEAVE REQUESTS
-- Leave balances are always computed on the fly from
-- (leave_type.annual_quota - SUM(approved requests this year))
-- rather than stored as a separately-mutated counter, to avoid
-- the kind of stale-data drift found elsewhere in this project.
-- ============================================================
CREATE TABLE leave_requests (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    employee_id         BIGINT UNSIGNED NOT NULL,
    leave_type_id       BIGINT UNSIGNED NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    total_days          DECIMAL(5,1) NOT NULL,
    reason              VARCHAR(255) NULL,
    status              ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
    approved_by_user_id BIGINT UNSIGNED NULL,
    decided_at          TIMESTAMP NULL,
    applied_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lr_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_lr_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_lr_leavetype FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
    CONSTRAINT fk_lr_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_lr_company (company_id),
    INDEX idx_lr_employee (employee_id),
    INDEX idx_lr_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- ATTENDANCE RECORDS (per employee, per day)
-- ============================================================
CREATE TABLE attendance_records (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    employee_id     BIGINT UNSIGNED NOT NULL,
    branch_id       BIGINT UNSIGNED NOT NULL,
    attendance_date DATE NOT NULL,
    status          ENUM('present','absent','half_day','on_leave','holiday','week_off') NOT NULL,
    check_in_time   TIME NULL,
    check_out_time  TIME NULL,
    notes           VARCHAR(255) NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attrec_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_attrec_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_attrec_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_att_employee_date (employee_id, attendance_date),
    INDEX idx_att_company_date (company_id, attendance_date)
) ENGINE=InnoDB;

-- ============================================================
-- PAYSLIPS (lightweight — full payroll tax engine is out of scope)
-- ============================================================
CREATE TABLE payslips (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    employee_id         BIGINT UNSIGNED NOT NULL,
    pay_month           TINYINT UNSIGNED NOT NULL COMMENT '1-12',
    pay_year            SMALLINT UNSIGNED NOT NULL,
    basic               DECIMAL(12,2) NOT NULL DEFAULT 0,
    hra                 DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_allowances    DECIMAL(12,2) NOT NULL DEFAULT 0,
    deductions          DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_pay             DECIMAL(12,2) NOT NULL DEFAULT 0,
    status              ENUM('draft','finalized','paid') NOT NULL DEFAULT 'draft',
    paid_on             DATE NULL,
    generated_by_user_id BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pay_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_pay_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_pay_user FOREIGN KEY (generated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_pay_employee_month (employee_id, pay_month, pay_year),
    INDEX idx_pay_company (company_id),
    INDEX idx_pay_period (pay_year, pay_month)
) ENGINE=InnoDB;

-- ============================================================
-- FINANCE & GST
-- ============================================================
CREATE TABLE chart_of_accounts (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    account_code        VARCHAR(20) NOT NULL,
    account_name        VARCHAR(150) NOT NULL,
    account_type        ENUM('asset','liability','equity','income','expense') NOT NULL,
    parent_account_id   BIGINT UNSIGNED NULL,
    is_system           TINYINT(1) NOT NULL DEFAULT 0,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_coa_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_coa_parent FOREIGN KEY (parent_account_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    UNIQUE KEY uq_coa_code (company_id, account_code),
    INDEX idx_coa_company (company_id),
    INDEX idx_coa_type (account_type)
) ENGINE=InnoDB;

CREATE TABLE bank_accounts (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    account_name        VARCHAR(150) NOT NULL,
    bank_name           VARCHAR(150) NOT NULL,
    account_number      VARCHAR(40) NOT NULL,
    ifsc_code           VARCHAR(15) NULL,
    account_type        ENUM('current','savings','cash') NOT NULL DEFAULT 'current',
    opening_balance     DECIMAL(14,2) NOT NULL DEFAULT 0,
    current_balance     DECIMAL(14,2) NOT NULL DEFAULT 0,
    is_primary          TINYINT(1) NOT NULL DEFAULT 0,
    status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bank_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_bank_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE journal_entries (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    branch_id           BIGINT UNSIGNED NOT NULL,
    entry_number        VARCHAR(30) NOT NULL,
    entry_date          DATE NOT NULL,
    reference           VARCHAR(100) NULL,
    narration           VARCHAR(255) NULL,
    status              ENUM('draft','posted') NOT NULL DEFAULT 'draft',
    total_debit         DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_credit        DECIMAL(14,2) NOT NULL DEFAULT 0,
    source_type         ENUM('manual','sales_invoice','purchase_bill','expense','payroll') NOT NULL DEFAULT 'manual',
    source_id           BIGINT UNSIGNED NULL,
    created_by_user_id  BIGINT UNSIGNED NULL,
    posted_at           TIMESTAMP NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_je_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_je_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_je_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_je_number (company_id, entry_number),
    INDEX idx_je_company (company_id),
    INDEX idx_je_status (status),
    INDEX idx_je_date (entry_date)
) ENGINE=InnoDB;

CREATE TABLE journal_entry_lines (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    journal_entry_id    BIGINT UNSIGNED NOT NULL,
    account_id          BIGINT UNSIGNED NOT NULL,
    debit_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
    credit_amount       DECIMAL(14,2) NOT NULL DEFAULT 0,
    description         VARCHAR(255) NULL,
    CONSTRAINT fk_jel_entry FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
    CONSTRAINT fk_jel_account FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    INDEX idx_jel_entry (journal_entry_id),
    INDEX idx_jel_account (account_id)
) ENGINE=InnoDB;

CREATE TABLE expenses (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT UNSIGNED NOT NULL,
    branch_id           BIGINT UNSIGNED NOT NULL,
    expense_number      VARCHAR(30) NOT NULL,
    expense_date        DATE NOT NULL,
    category            VARCHAR(80) NOT NULL,
    account_id          BIGINT UNSIGNED NOT NULL,
    vendor_name         VARCHAR(150) NULL,
    description         VARCHAR(255) NULL,
    amount              DECIMAL(14,2) NOT NULL,
    tax_rate            DECIMAL(5,2) NOT NULL DEFAULT 0,
    tax_amount          DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount        DECIMAL(14,2) NOT NULL,
    payment_method      ENUM('cash','bank_transfer','upi','cheque','card','other') NOT NULL DEFAULT 'bank_transfer',
    bank_account_id     BIGINT UNSIGNED NULL,
    status              ENUM('pending','paid') NOT NULL DEFAULT 'pending',
    journal_entry_id    BIGINT UNSIGNED NULL,
    created_by_user_id  BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_exp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_exp_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_exp_account FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_exp_bank FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_exp_je FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL,
    CONSTRAINT fk_exp_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_exp_number (company_id, expense_number),
    INDEX idx_exp_company (company_id),
    INDEX idx_exp_status (status),
    INDEX idx_exp_date (expense_date)
) ENGINE=InnoDB;

CREATE TABLE gst_filings (
    id                          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id                  BIGINT UNSIGNED NOT NULL,
    return_month                TINYINT UNSIGNED NOT NULL COMMENT '1-12',
    return_year                 SMALLINT UNSIGNED NOT NULL,
    taxable_outward_supplies    DECIMAL(14,2) NOT NULL DEFAULT 0,
    output_tax                  DECIMAL(14,2) NOT NULL DEFAULT 0,
    taxable_inward_supplies     DECIMAL(14,2) NOT NULL DEFAULT 0,
    input_tax_credit            DECIMAL(14,2) NOT NULL DEFAULT 0,
    net_tax_payable             DECIMAL(14,2) NOT NULL DEFAULT 0,
    status                      ENUM('draft','filed') NOT NULL DEFAULT 'draft',
    filed_on                    DATE NULL,
    filed_by_user_id            BIGINT UNSIGNED NULL,
    arn                         VARCHAR(40) NULL,
    created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gst_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_gst_user FOREIGN KEY (filed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_gst_period (company_id, return_year, return_month),
    INDEX idx_gst_company (company_id)
) ENGINE=InnoDB;

-- ============================================================
-- SERVICE DESK MODULE
-- ============================================================
CREATE TABLE ticket_categories (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id    BIGINT UNSIGNED NOT NULL,
    name          VARCHAR(80) NOT NULL,
    description   VARCHAR(255) NULL,
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tcat_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_tcat_name (company_id, name),
    INDEX idx_tcat_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE sla_policies (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id         BIGINT UNSIGNED NOT NULL,
    priority           ENUM('low','medium','high','urgent') NOT NULL,
    response_hours     INT UNSIGNED NOT NULL,
    resolution_hours   INT UNSIGNED NOT NULL,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sla_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sla_priority (company_id, priority),
    INDEX idx_sla_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE tickets (
    id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id           BIGINT UNSIGNED NOT NULL,
    branch_id            BIGINT UNSIGNED NOT NULL,
    ticket_number        VARCHAR(30) NOT NULL,
    customer_id          BIGINT UNSIGNED NULL,
    category_id          BIGINT UNSIGNED NULL,
    sla_policy_id        BIGINT UNSIGNED NULL,
    subject              VARCHAR(200) NOT NULL,
    description          TEXT NULL,
    priority             ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
    status               ENUM('open','in_progress','on_hold','resolved','closed') NOT NULL DEFAULT 'open',
    assigned_to_user_id  BIGINT UNSIGNED NULL,
    response_due_at      DATETIME NULL,
    resolution_due_at    DATETIME NULL,
    first_responded_at   DATETIME NULL,
    resolved_at          DATETIME NULL,
    closed_at            DATETIME NULL,
    created_by_user_id   BIGINT UNSIGNED NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ticket_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_ticket_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_sla FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_assignee FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_ticket_number (company_id, ticket_number),
    INDEX idx_ticket_company (company_id),
    INDEX idx_ticket_status (status),
    INDEX idx_ticket_priority (priority),
    INDEX idx_ticket_assignee (assigned_to_user_id)
) ENGINE=InnoDB;

CREATE TABLE ticket_comments (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_id     BIGINT UNSIGNED NOT NULL,
    user_id       BIGINT UNSIGNED NULL,
    message       TEXT NOT NULL,
    is_internal   TINYINT(1) NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tcom_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_tcom_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_tcom_ticket (ticket_id)
) ENGINE=InnoDB;
