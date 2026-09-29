-- ============================================================
-- MIGRATION 007 — Finance & GST module
-- Adds: chart_of_accounts, bank_accounts, journal_entries,
--       journal_entry_lines, expenses, gst_filings
-- Non-destructive — safe to run against an existing database
-- that already has the Login/Sales+CRM/Inventory/Purchase/
-- Manufacturing/HR modules installed.
-- ============================================================
USE nexus_erp;

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
