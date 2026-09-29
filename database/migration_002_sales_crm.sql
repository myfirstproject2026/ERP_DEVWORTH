-- ============================================================
-- MIGRATION 002 — Sales + CRM module
-- Run this against your EXISTING nexus_erp database (schema.sql
-- already applied). Safe to run once.
-- ============================================================
USE nexus_erp;

-- ----------------------------------------------------------------
-- Extend the existing `customers` table with full CRM fields
-- ----------------------------------------------------------------
ALTER TABLE customers
    ADD COLUMN email VARCHAR(150) NULL AFTER phone,
    ADD COLUMN gstin VARCHAR(20) NULL AFTER email,
    ADD COLUMN billing_address VARCHAR(255) NULL AFTER gstin,
    ADD COLUMN shipping_address VARCHAR(255) NULL AFTER billing_address,
    ADD COLUMN branch_id BIGINT UNSIGNED NULL AFTER shipping_address,
    ADD COLUMN assigned_to_user_id BIGINT UNSIGNED NULL AFTER branch_id,
    ADD COLUMN lead_source VARCHAR(60) NULL AFTER assigned_to_user_id,
    ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER lead_source,
    ADD COLUMN credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER status,
    ADD COLUMN notes TEXT NULL AFTER credit_limit,
    ADD CONSTRAINT fk_customers_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_customers_assigned_user FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    ADD INDEX idx_customers_status (status);

-- ============================================================
-- LEADS
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

-- ============================================================
-- QUOTATIONS
-- ============================================================
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

-- ============================================================
-- SALES ORDERS
-- ============================================================
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

-- ============================================================
-- INVOICES
-- ============================================================
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
-- Register the module as active (was a "Soon" placeholder before)
-- ============================================================
UPDATE modules SET is_active = 1 WHERE module_key = 'sales_crm';
