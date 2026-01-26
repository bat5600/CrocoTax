import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer } from "testcontainers";
import { runMigrations } from "../../scripts/migrate";
import { seedDemoTenant } from "../../scripts/seed";
import { getPool, closePool } from "@croco/db";
import { DbQueue } from "@croco/queue";
import { buildServer } from "../../apps/api/src/server";
import { createLogger } from "@croco/observability";
import { processOnce } from "../../apps/worker/src/worker";
import { readFileSync } from "fs";
import { join } from "path";

const logger = createLogger();

describe("webhook -> job -> audit", () => {
  let container: PostgreSqlContainer;
  let tenantId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:15").start();
    process.env.DATABASE_URL = container.getConnectionUri();
    await runMigrations();
    tenantId = await seedDemoTenant();
  });

  afterAll(async () => {
    await closePool();
    await container.stop();
  });

  it("enqueues a job and writes an audit event", async () => {
    const pool = getPool();
    const queue = new DbQueue(pool, logger);
    const app = buildServer({ logger, pool, queue });
    await app.ready();

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
        logger
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
