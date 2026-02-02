BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS ghl_location_id text;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_ghl_location_id_unique
  ON tenants (ghl_location_id)
  WHERE ghl_location_id IS NOT NULL;

COMMIT;

