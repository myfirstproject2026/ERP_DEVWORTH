-- ============================================================
-- MIGRATION 008 — Service Desk module
-- Adds: ticket_categories, sla_policies, tickets, ticket_comments
-- Non-destructive — safe to run against an existing database
-- that already has every other module installed.
-- ============================================================
USE nexus_erp;

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
