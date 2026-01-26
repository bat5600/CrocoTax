import { getPool, closePool } from "@croco/db";
import { loadEnvFile } from "@croco/config";

export async function seedDemoTenant(): Promise<string> {
  loadEnvFile();
  const pool = getPool();
  const tenantResult = await pool.query(
    "INSERT INTO tenants (name, status, config) VALUES ($1, 'active', $2) RETURNING id",
    ["Demo Tenant", { webhook_secret: "demo-secret" }]
  );
  const tenantId = tenantResult.rows[0].id as string;

  await pool.query(
    "INSERT INTO tenant_secrets (tenant_id, ghl_api_key_enc, pdp_api_key_enc, enc_version, enc_nonce) VALUES ($1, $2, $3, $4, $5)",
    [tenantId, "enc_placeholder", "enc_placeholder", 1, "nonce_placeholder"]
  );

  return tenantId;
}

if (require.main === module) {
  seedDemoTenant()
    .then(async (tenantId) => {
      // eslint-disable-next-line no-console
      console.log(`Seeded tenant ${tenantId}`);
      await closePool();
      process.exit(0);
    })
    .catch(async (error) => {
      // eslint-disable-next-line no-console
      console.error(error);
      await closePool();
      process.exit(1);
    });
}
