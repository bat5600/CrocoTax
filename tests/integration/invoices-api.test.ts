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

describe("invoice status API", () => {
  let container: StartedTestContainer | undefined;
  let tenantId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    process.env.FACTURX_MODE = "stub";
    process.env.STORAGE_MODE = "filesystem";
    process.env.STORAGE_LOCAL_PATH = join(process.cwd(), "tmp", "storage-test");
    process.env.PDP_PROVIDER = "mock";
    process.env.TENANT_API_TOKEN = "test-token";

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
    otherTenantId = await seedDemoTenant();
  });

  afterAll(async () => {
    await closePool();
    await container?.stop();
  });

  it("lists invoices and fetches details/audit", async () => {
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

    const webhookResp = await app.inject({
      method: "POST",
      url: "/webhooks/ghl",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": tenantId
      },
      payload
    });
    expect(webhookResp.statusCode).toBe(200);

    // Process enough jobs to reach sync.
    for (let i = 0; i < 10; i += 1) {
      const didWork = await processOnce(
        { pool, queue, logger, ghlClient, facturxGenerator, storageClient, pdpClient },
        "test-worker"
      );
      if (!didWork) {
        break;
      }
    }

    const listResp = await app.inject({
      method: "GET",
      url: "/api/v1/invoices?limit=10",
      headers: {
        "x-tenant-id": tenantId,
        authorization: "Bearer test-token"
      }
    });
    expect(listResp.statusCode).toBe(200);
    const listBody = JSON.parse(listResp.body) as { invoices: Array<{ id: string }> };
    expect(listBody.invoices.length).toBeGreaterThan(0);

    const invoiceId = listBody.invoices[0].id;

    const filteredResp = await app.inject({
      method: "GET",
      url: "/api/v1/invoices?status=ACCEPTED&limit=10",
      headers: {
        "x-tenant-id": tenantId,
        authorization: "Bearer test-token"
      }
    });
    expect(filteredResp.statusCode).toBe(200);

    const detailResp = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoiceId}`,
      headers: {
        "x-tenant-id": tenantId,
        authorization: "Bearer test-token"
      }
    });
    expect(detailResp.statusCode).toBe(200);

    const auditResp = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoiceId}/audit?limit=50`,
      headers: {
        "x-tenant-id": tenantId,
        authorization: "Bearer test-token"
      }
    });
    expect(auditResp.statusCode).toBe(200);
    const auditBody = JSON.parse(auditResp.body) as { events: unknown[] };
    expect(auditBody.events.length).toBeGreaterThan(0);

    const crossTenant = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoiceId}`,
      headers: {
        "x-tenant-id": otherTenantId,
        authorization: "Bearer test-token"
      }
    });
    expect(crossTenant.statusCode).toBe(404);

    const pdfResp = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoiceId}/artifacts/pdf`,
      headers: {
        "x-tenant-id": tenantId,
        authorization: "Bearer test-token"
      }
    });
    expect(pdfResp.statusCode).toBe(200);
    expect(pdfResp.headers["content-type"]).toContain("application/pdf");
    expect(pdfResp.rawPayload.length).toBeGreaterThan(0);

    const xmlResp = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoiceId}/artifacts/xml`,
      headers: {
        "x-tenant-id": tenantId,
        authorization: "Bearer test-token"
      }
    });
    expect(xmlResp.statusCode).toBe(200);
    expect(xmlResp.headers["content-type"]).toContain("application/xml");
    expect(xmlResp.rawPayload.length).toBeGreaterThan(0);

    const pdfCrossTenant = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoiceId}/artifacts/pdf`,
      headers: {
        "x-tenant-id": otherTenantId,
        authorization: "Bearer test-token"
      }
    });
    expect(pdfCrossTenant.statusCode).toBe(404);

    await app.close();
  });
});
