import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { GenericContainer, Wait } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";
import { runMigrations } from "../../scripts/migrate";
import { seedDemoTenant } from "../../scripts/seed";
import { getPool, closePool } from "@croco/db";
import { DbQueue } from "@croco/queue";
import { buildServer } from "../../apps/api/src/server";
import { createLogger } from "@croco/observability";
import { processOnce } from "../../apps/worker/src/worker";
import { createGhlClient } from "@croco/ghl";
import { createFacturxGenerator } from "@croco/facturx";
import { createStorageClient } from "@croco/storage";
import { createPdpClient } from "@croco/pdp";
import { readFileSync } from "fs";
import { join } from "path";

const logger = createLogger();

describe("webhook -> job -> audit", () => {
  let container: StartedTestContainer | undefined;
  let tenantId: string;

  beforeAll(async () => {
    process.env.FACTURX_MODE = "stub";
    process.env.STORAGE_MODE = "filesystem";
    process.env.STORAGE_LOCAL_PATH = join(process.cwd(), "tmp", "storage-test");
    process.env.PDP_PROVIDER = "mock";

    container = await new GenericContainer("postgres:15")
      .withEnvironment({
        POSTGRES_USER: "croco",
        POSTGRES_PASSWORD: "croco",
        POSTGRES_DB: "croco"
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections"))
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);
    process.env.DATABASE_URL = `postgresql://croco:croco@${host}:${port}/croco`;

    await runMigrations();
    tenantId = await seedDemoTenant();
  });

  afterAll(async () => {
    await closePool();
    await container?.stop();
  });

  it("enqueues a job and writes an audit event", async () => {
    const pool = getPool();
    const queue = new DbQueue(pool, logger);
    const app = buildServer({ logger, pool, queue });
    await app.ready();
    const ghlClient = createGhlClient();
    const facturxGenerator = createFacturxGenerator();
    const storageClient = createStorageClient();
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

    expect(response.statusCode).toBe(200);

    await processOnce(
      {
        pool,
        queue,
        logger,
        ghlClient,
        facturxGenerator,
        storageClient,
        pdpClient
      },
      "test-worker"
    );

    const auditResult = await pool.query(
      "SELECT event_type FROM audit_log WHERE tenant_id = $1 AND event_type = $2",
      [tenantId, "fetch_invoice.completed"]
    );

    expect(auditResult.rowCount).toBe(1);
    await app.close();
  });
});
