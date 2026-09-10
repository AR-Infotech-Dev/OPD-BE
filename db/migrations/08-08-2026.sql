ALTER TABLE `ticket_management`.`ab_quotations`
ADD COLUMN `sent_date` DATETIME NULL DEFAULT NULL AFTER `modified_date`,
ADD COLUMN `sent_to_email` VARCHAR(100) NULL DEFAULT NULL AFTER `sent_date`,
ADD COLUMN `approved_date` DATETIME NULL DEFAULT NULL AFTER `sent_to_email`,
ADD COLUMN `approved_by_name` INT NULL DEFAULT NULL AFTER `approved_date`,
ADD COLUMN `approval_mode` ENUM ('call', 'email', 'whatsapp', 'signed_copy') NULL DEFAULT NULL AFTER `approved_by_name`,
ADD COLUMN `approval_notes` VARCHAR(500) NULL DEFAULT NULL AFTER `approval_mode`,
ADD COLUMN `rejected_date` DATETIME NULL DEFAULT NULL AFTER `approval_notes`,
ADD COLUMN `rejection_reason` VARCHAR(255) NULL DEFAULT NULL AFTER `rejected_date`,
ADD COLUMN `revision_no` INT NULL DEFAULT 0 AFTER `rejection_reason`,
ADD COLUMN `parent_quotation_id` INT NULL DEFAULT NULL AFTER `revision_no`,
ADD COLUMN `revision_reason` VARCHAR(45) NULL DEFAULT NULL AFTER `parent_quotation_id`,
ADD COLUMN `converted_date` DATETIME NULL DEFAULT NULL AFTER `revision_reason`,
ADD COLUMN `cancelled_date` DATETIME NULL DEFAULT NULL AFTER `converted_date`,
ADD COLUMN `cancellation_reason` VARCHAR(255) NULL DEFAULT NULL AFTER `cancelled_date`,
ADD COLUMN `is_revised_copy` ENUM('yes', 'no') DEFAULT `no`;


ALTER TABLE ab_quotations MODIFY quotation_status ENUM (
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