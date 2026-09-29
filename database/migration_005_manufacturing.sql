-- ============================================================
-- MIGRATION 005 — Manufacturing Module
-- Work Centers, Bill of Materials, Work Orders, Material Issues
-- ============================================================
USE nexus_erp;

-- Extend stock_movements movement_type enum to support manufacturing consumption/output
ALTER TABLE stock_movements
    MODIFY COLUMN movement_type ENUM(
        'purchase_in','sale_out','transfer_in','transfer_out',
        'adjustment_in','adjustment_out','production_consume','production_output'
    ) NOT NULL;

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
