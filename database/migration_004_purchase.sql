-- ============================================================
-- MIGRATION 004 — Purchase Module
-- Suppliers, Purchase Orders, Goods Receipts, Bills, Payments
-- ============================================================
USE nexus_erp;

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

-- ============================================================
-- MODULE FLAG — mark Purchase active in the sidebar reference table
-- ============================================================
UPDATE modules SET is_active = 1 WHERE module_key = 'purchase';
