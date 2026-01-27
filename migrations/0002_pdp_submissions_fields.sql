BEGIN;

ALTER TABLE pdp_submissions
  ADD COLUMN IF NOT EXISTS status_raw jsonb,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

COMMIT;
