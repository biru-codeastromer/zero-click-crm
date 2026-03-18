-- BigQuery schema for Zero-Click CRM
-- Update dataset/table names to match `BQ_DATASET` / `BQ_TABLE`.

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.zero_click_crm_dataset.contacts` (
  contact_name STRING,
  company_name STRING,
  deal_value_usd INT64,
  sentiment STRING,
  next_step STRING,
  follow_up_date DATE,
  full_summary STRING,
  at_risk BOOL,
  transcript STRING,
  created_at TIMESTAMP
);

