import { randomBytes } from "crypto";
import { closePool, getPool, waitForDatabase } from "@croco/db";
import { loadEnvFile } from "@croco/config";

function usage(): never {
  // eslint-disable-next-line no-console
  console.error(
    "Usage: npx tsx scripts/create-tenant.ts --name \"ACME\" --location-id \"<ghl_location_id>\""
  );
  process.exit(1);
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

async function run(): Promise<void> {
  loadEnvFile();
  const name = getArg("--name");
  const locationId = getArg("--location-id") ?? getArg("--locationId");
  if (!name || !locationId) {
    usage();
  }

  const pool = getPool();
  await waitForDatabase(pool);

  const apiToken = randomToken(32);
  const webhookSecret = randomToken(32);

  const existing = await pool.query(
    "SELECT id FROM tenants WHERE ghl_location_id = $1",
    [locationId]
  );
  if (existing.rowCount > 0) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: "location_already_registered",
          locationId,
          tenantId: existing.rows[0].id
        },
        null,
        2
      )
    );
    return;
  }

  const result = await pool.query(
    "INSERT INTO tenants (name, status, config, ghl_location_id) VALUES ($1, 'active', $2, $3) RETURNING id",
    [name, { webhook_secret: webhookSecret, api_token: apiToken }, locationId]
  );

  const tenantId = result.rows[0].id as string;
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      { ok: true, tenantId, locationId, apiToken, webhookSecret },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

