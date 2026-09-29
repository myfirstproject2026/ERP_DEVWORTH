-- ============================================================
-- MIGRATION 003 — Inventory Module
-- Extends `products` (item master fields) and adds stock tracking:
-- stock_levels, stock_movements, stock_transfers (+items),
-- stock_adjustments (+items).
-- Safe to run on top of migration_002_sales_crm.sql.
-- ============================================================
USE nexus_erp;

-- ---------------- EXTEND products (item master) ----------------
ALTER TABLE products
    ADD COLUMN sku VARCHAR(60) NULL AFTER product_name,
    ADD COLUMN category VARCHAR(80) NULL AFTER sku,
    ADD COLUMN unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'unit' AFTER category,
    ADD COLUMN hsn_code VARCHAR(20) NULL AFTER unit_of_measure,
    ADD COLUMN cost_price DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER hsn_code,
    ADD COLUMN selling_price DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER cost_price,
    ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00 AFTER selling_price,
    ADD COLUMN reorder_level INT NOT NULL DEFAULT 0 AFTER tax_rate,
    ADD COLUMN reorder_quantity INT NOT NULL DEFAULT 0 AFTER reorder_level,
    ADD COLUMN barcode VARCHAR(60) NULL AFTER reorder_quantity,
    ADD COLUMN description VARCHAR(255) NULL AFTER barcode,
    ADD COLUMN primary_branch_id BIGINT UNSIGNED NULL AFTER description,
    ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER primary_branch_id,
    ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status,
    ADD CONSTRAINT fk_products_primary_branch FOREIGN KEY (primary_branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    ADD UNIQUE KEY uq_products_sku_company (company_id, sku),
    ADD INDEX idx_products_category (category),
    ADD INDEX idx_products_status (status);

-- ---------------- STOCK LEVELS (per product per branch) ----------------
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

-- ---------------- STOCK MOVEMENTS (ledger / audit trail) ----------------
CREATE TABLE stock_movements (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT UNSIGNED NOT NULL,
    product_id      BIGINT UNSIGNED NOT NULL,
    branch_id       BIGINT UNSIGNED NOT NULL,
    movement_type   ENUM('purchase_in','sale_out','transfer_in','transfer_out',
                          'adjustment_in','adjustment_out') NOT NULL,
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

-- ---------------- STOCK TRANSFERS (branch to branch) ----------------
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

-- ---------------- STOCK ADJUSTMENTS (damage/loss/found/correction) ----------------
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
