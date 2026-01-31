import { readFileSync } from "fs";
import { join } from "path";
import { createLogger } from "@croco/observability";
import { getPool } from "@croco/db";
import { DbQueue } from "@croco/queue";
import { buildServer } from "../apps/api/src/server";
import { createGhlClient } from "@croco/ghl";
import { createFacturxGenerator } from "@croco/facturx";
import { createStorageClient } from "@croco/storage";
import { createPdpClient } from "@croco/pdp";
import { processOnce } from "../apps/worker/src/worker";
import { loadEnvFile } from "@croco/config";

async function run(): Promise<void> {
  loadEnvFile();
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    throw new Error("TENANT_ID is required (use the seeded tenant id)");
  }

  const logger = createLogger();
  const pool = getPool();
  const queue = new DbQueue(pool, logger);
  const storageClient = createStorageClient();
  const app = buildServer({ logger, pool, queue, storageClient });
  await app.ready();

  const ghlClient = createGhlClient();
  const facturxGenerator = createFacturxGenerator();
  const pdpClient = createPdpClient();

  const payload = JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "ghl-invoice.json"), "utf8")
  );

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/ghl",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    payload
  });

  if (response.statusCode !== 200) {
    throw new Error(`Webhook failed: ${response.statusCode} ${response.body}`);
  }

  for (let i = 0; i < 10; i += 1) {
    const didWork = await processOnce(
      { pool, queue, logger, ghlClient, facturxGenerator, storageClient, pdpClient },
      "pdp-smoke"
    );
    if (!didWork) {
      break;
    }
  }

  const { rows } = await pool.query(
    "SELECT status FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1",
    [tenantId]
  );
  if (!rows.length) {
    throw new Error("No invoice created during PDP smoke run");
  }
  // eslint-disable-next-line no-console
  console.log(`Latest invoice status: ${rows[0].status}`);

  await app.close();
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
