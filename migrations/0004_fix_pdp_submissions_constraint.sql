BEGIN;

-- Fix: make submission_id unique constraint tenant-scoped to prevent cross-tenant collisions
ALTER TABLE pdp_submissions DROP CONSTRAINT IF EXISTS pdp_submissions_provider_submission_id_key;
ALTER TABLE pdp_submissions ADD CONSTRAINT pdp_submissions_tenant_provider_submission_id_key UNIQUE (tenant_id, provider, submission_id);

COMMIT;
