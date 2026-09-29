-- ============================================================
-- MIGRATION 006 — HR & Employee module
-- Adds: departments, employees, leave_types, leave_requests,
--       attendance_records, payslips
-- Non-destructive: safe to run on an existing database.
-- ============================================================
USE nexus_erp;

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
