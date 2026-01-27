import { getPool, closePool, waitForDatabase } from "@croco/db";
import { loadEnvFile, encryptSecret } from "@croco/config";

export async function seedDemoTenant(): Promise<string> {
  loadEnvFile();
  const pool = getPool();
  await waitForDatabase(pool);
  const tenantResult = await pool.query(
    "INSERT INTO tenants (name, status, config) VALUES ($1, 'active', $2) RETURNING id",
    ["Demo Tenant", { webhook_secret: "demo-secret" }]
  );
  const tenantId = tenantResult.rows[0].id as string;

  const ghlSecret = encryptSecret(process.env.GHL_API_KEY ?? "demo-ghl-key");
  const pdpSecret = encryptSecret(process.env.PDP_API_KEY ?? "demo-pdp-key");

  await pool.query(
    "INSERT INTO tenant_secrets (tenant_id, ghl_api_key_enc, pdp_api_key_enc, enc_version, enc_nonce) VALUES ($1, $2, $3, $4, $5)",
    [tenantId, ghlSecret.ciphertext, pdpSecret.ciphertext, ghlSecret.version, ghlSecret.nonce]
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
