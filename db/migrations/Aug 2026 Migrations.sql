-- All status colums are made added 'delete'
ALTER TABLE `ticket_management`.`ab_customer` CHANGE COLUMN `status` `status` ENUM ('active', 'inactive', 'delete') CHARACTER
SET
  'utf8mb4' COLLATE 'utf8mb4_unicode_ci' NULL DEFAULT 'active';

ALTER TABLE `ticket_management`.`ab_admin` CHANGE COLUMN `status` `status` ENUM ('active', 'inactive', 'delete') NOT NULL DEFAULT 'active';

ALTER TABLE `ticket_management`.`ab_leads` CHANGE COLUMN `status` `status` ENUM ('active', 'inactive', 'delete') NULL DEFAULT 'active';

ALTER TABLE `ticket_management`.`ab_products`
ADD COLUMN `status` ENUM ('active', 'inactive', 'delete') NULL DEFAULT 'active' AFTER `modified_date`;

ALTER TABLE `ticket_management`.`ab_tickets` CHANGE COLUMN `status` `status` ENUM ('active', 'inactive', 'delete') CHARACTER
SET
  'utf8mb4' COLLATE 'utf8mb4_unicode_ci' NOT NULL DEFAULT 'active';

ALTER TABLE `ticket_management`.`ab_tickets`
ADD COLUMN `instructions` TEXT NULL DEFAULT NULL AFTER `description`;

ALTER TABLE `ticket_management`.`ab_company_master`
ADD COLUMN 'google_review_enabled' ENUM ('y', 'n') NULL DEFAULT 'n',
ADD COLUMN 'google_review_link' VARCHAR(255) NULL DEFAULT NULL;

ADD COLUMN `quotation_terms` TEXT NULL DEFAULT NULL AFTER `db_tested_at`,
ADD COLUMN `bank_name` VARCHAR(255) NULL DEFAULT NULL AFTER `quotation_terms`,
ADD COLUMN `ifsc_code` VARCHAR(45) NULL DEFAULT NULL AFTER `bank_name`,
ADD COLUMN `branch` VARCHAR(45) NULL DEFAULT NULL AFTER `ifsc_code`,
ADD COLUMN `account_number` VARCHAR(45) NULL DEFAULT NULL AFTER `branch`,
ADD COLUMN `authority_sign` VARCHAR(500) NULL DEFAULT NULL AFTER `account_number`;

ADD COLUMN `footer_logos` JSON NULL DEFAULT NULL AFTER `authority_sign`;

ALTER TABLE ab_products
ADD COLUMN rate DECIMAL(10, 2) NULL DEFAULT NULL,
ADD COLUMN gst_rate INT NULL DEFAULT NULL;

-- Quotation Module
CREATE TABLE
  IF NOT EXISTS ab_leads (
    lead_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id INT UNSIGNED DEFAULT NULL,
    company_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    company_name VARCHAR(250) DEFAULT NULL,
    gst_number VARCHAR(15) DEFAULT NULL,
    contact_person VARCHAR(145) DEFAULT NULL,
    mobile_no VARCHAR(50) NOT NULL,
    email VARCHAR(100) DEFAULT NULL,
    requirement TEXT DEFAULT NULL,
    lead_source ENUM (
      'call',
      'whatsapp',
      'website',
      'referral',
      'walk_in',
      'other'
    ) NOT NULL DEFAULT 'call',
    lead_status ENUM (
      'new',
      'contacted',
      'follow_up',
      'interested',
      'quotation_sent',
      'negotiation',
      'won',
      'lost',
      'converted'
    ) NOT NULL DEFAULT 'new',
    assigned_to INT DEFAULT NULL,
    next_followup_date DATETIME DEFAULT NULL,
    lost_reason VARCHAR(255) DEFAULT NULL,
    status ENUM ('active', 'inactive') NOT NULL DEFAULT 'active',
    created_by INT DEFAULT NULL,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    modified_by INT DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    PRIMARY KEY (lead_id),
    KEY idx_lead_customer (customer_id),
    KEY idx_lead_company (company_id),
    KEY idx_lead_mobile (mobile_no),
    KEY idx_lead_status (lead_status),
    KEY idx_lead_followup (next_followup_date),
    KEY idx_lead_assigned (assigned_to)
  );

CREATE TABLE
  IF NOT EXISTS ab_quotations (
    quotation_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    quotation_no VARCHAR(50) NOT NULL,
    company_id INT UNSIGNED NOT NULL,
    customer_id INT UNSIGNED NOT NULL,
    contact_id INT UNSIGNED DEFAULT NULL,
    ticket_id INT UNSIGNED DEFAULT NULL,
    quotation_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    timeframe VARCHAR(100) DEFAULT NULL,
    quotation_status ENUM (
      'draft',
      'sent',
      'revision_required',
      'approved',
      'rejected',
      'expired',
      'converted'
    ) NOT NULL DEFAULT 'draft',
    sent_date DATETIME DEFAULT NULL,
    sent_to_email VARCHAR(100) DEFAULT NULL,
    approved_date DATETIME DEFAULT NULL,
    approval_notes VARCHAR(500) DEFAULT NULL,
    rejected_date DATETIME DEFAULT NULL,
    rejection_reason VARCHAR(255) DEFAULT NULL,
    revision_no INT NOT NULL DEFAULT 0,
    parent_quotation_id INT DEFAULT NULL,
    revision_reason VARCHAR(500) DEFAULT NULL,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    discount_total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    tax_total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    notes TEXT DEFAULT NULL,
    terms TEXT DEFAULT NULL,
    status ENUM ('active', 'deleted') NOT NULL DEFAULT 'active',
    created_by INT DEFAULT NULL,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    modified_by INT DEFAULT NULL,
    modified_date DATETIME DEFAULT NULL,
    PRIMARY KEY (quotation_id),
    KEY idx_quotation_customer (customer_id),
    KEY idx_quotation_contact (contact_id),
    KEY idx_quotation_ticket (ticket_id),
    KEY idx_quotation_date (quotation_date),
    KEY idx_quotation_valid_until (valid_until)
  );

ALTER TABLE ab_quotations MODIFY customer_id INT UNSIGNED NULL,
MODIFY quotation_status ENUM (
  'draft',
  'sent',
  'accepted',
  'approved',
  'rejected',
  'revision_required',
  'converted',
  'cancelled',
  'expired'
) NOT NULL DEFAULT 'draft';

ADD COLUMN timeframe VARCHAR(100) DEFAULT NULL AFTER valid_until;

ADD COLUMN scope_of_work TEXT NULL DEFAULT NULL AFTER timeframe;

ADD COLUMN lead_id INT UNSIGNED NULL AFTER company_id,
ADD COLUMN sent_date DATETIME NULL AFTER quotation_status,
ADD COLUMN sent_to_email VARCHAR(100) NULL AFTER sent_date,
ADD COLUMN approved_date DATETIME NULL AFTER sent_to_email,
ADD COLUMN approval_notes VARCHAR(500) NULL AFTER approved_date,
ADD COLUMN rejected_date DATETIME NULL AFTER approval_notes,
ADD COLUMN rejection_reason VARCHAR(255) NULL AFTER rejected_date,
ADD COLUMN revision_no INT NOT NULL DEFAULT 0 AFTER rejection_reason,
ADD COLUMN parent_quotation_id INT NULL AFTER revision_no,
ADD COLUMN revision_reason VARCHAR(500) NULL AFTER parent_quotation_id,
ADD KEY idx_quotation_lead (lead_id);

ADD KEY idx_quotation_parent (parent_quotation_id);

CREATE TABLE
  `ab_quotation_items` (
    `quotation_item_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `quotation_id` INT UNSIGNED NOT NULL,
    `product_id` INT UNSIGNED DEFAULT NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `product_description` VARCHAR(255) DEFAULT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1.00,
    `rate` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `discount_rate` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `gst_rate` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `taxable_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `line_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `sort_order` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`quotation_item_id`),
    INDEX `idx_quotation_items_quotation_id` (`quotation_id`),
    INDEX `idx_quotation_items_product_id` (`product_id`),
    CONSTRAINT `fk_quotation_items_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `ab_quotations` (`quotation_id`) ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE
  IF NOT EXISTS ab_quotation_status_history (
    history_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    quotation_id INT UNSIGNED NOT NULL,
    old_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NOT NULL,
    remarks VARCHAR(500) NULL,
    changed_by INT NULL,
    changed_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (history_id),
    KEY idx_quotation_status_history (quotation_id, changed_date)
  );

CREATE TABLE
  IF NOT EXISTS ab_quotation_followups (
    followup_id INT NOT NULL AUTO_INCREMENT,
    quotation_id INT NOT NULL,
    lead_id INT NULL,
    customer_id INT NULL,
    followup_date DATETIME NOT NULL,
    followup_type ENUM ('call', 'whatsapp', 'email', 'meeting') NOT NULL DEFAULT 'call',
    followup_status ENUM ('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    followup_result ENUM (
      'no_response',
      'callback',
      'interested',
      'revision_requested',
      'approved',
      'rejected'
    ) NULL,
    notes TEXT NULL,
    next_followup_date DATETIME NULL,
    assigned_to INT NULL,
    company_id INT NOT NULL,
    created_by INT NULL,
    created_date DATETIME NOT NULL,
    modified_by INT NULL,
    modified_date DATETIME NULL,
    PRIMARY KEY (followup_id),
    KEY idx_quotation_followup (quotation_id, followup_status),
    KEY idx_followup_due (
      company_id,
      assigned_to,
      followup_status,
      followup_date
    )
  );

ALTER TABLE ab_leads
ADD COLUMN gst_number VARCHAR(15) DEFAULT NULL AFTER company_name;

ALTER TABLE `ticket_management`.`ab_quotations`