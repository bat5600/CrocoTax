import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { getEnv, resolveTenantFromRequest } from "@croco/config";

function mockPool(rows: unknown[] = []) {
  return {
    query: async () => ({ rows, rowCount: rows.length })
  } as unknown as Pool;
}

describe("getEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.DATABASE_URL;
    delete process.env.STORAGE_MODE;
    delete process.env.FACTURX_MODE;
    delete process.env.PDP_PROVIDER;
    delete process.env.PDP_ARTIFACT_MODE;
    delete process.env.PDP_RECONCILE_INTERVAL_MS;
    delete process.env.PDP_RECONCILE_BATCH;
    delete process.env.PDP_RECONCILE_OLDER_MINUTES;
    delete process.env.WORKER_POLL_INTERVAL_MS;
    delete process.env.GHL_API_BASE;
    delete process.env.PDP_API_BASE;
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => getEnv()).toThrow("DATABASE_URL is not set");
  });

  it("returns correct defaults when DATABASE_URL is set", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/test";

    const config = getEnv();

    expect(config.databaseUrl).toBe("postgres://localhost:5432/test");
    expect(config.storageMode).toBe("filesystem");
    expect(config.facturxMode).toBe("stub");
    expect(config.pdpProvider).toBe("mock");
    expect(config.pdpArtifactMode).toBe("base64");
    expect(config.pdpReconcileIntervalMs).toBe(600000);
    expect(config.pdpReconcileBatch).toBe(25);
    expect(config.pdpReconcileOlderMinutes).toBe(15);
    expect(config.workerPollIntervalMs).toBe(1000);
  });

  it("respects env overrides", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/prod";
    process.env.STORAGE_MODE = "s3";
    process.env.FACTURX_MODE = "real";
    process.env.PDP_PROVIDER = "superpdp";
    process.env.PDP_ARTIFACT_MODE = "keys";
    process.env.PDP_RECONCILE_INTERVAL_MS = "30000";
    process.env.PDP_RECONCILE_BATCH = "50";
    process.env.PDP_RECONCILE_OLDER_MINUTES = "30";
    process.env.WORKER_POLL_INTERVAL_MS = "5000";
    process.env.GHL_API_BASE = "https://ghl.example.com";
    process.env.PDP_API_BASE = "https://pdp.example.com";

    const config = getEnv();

    expect(config.databaseUrl).toBe("postgres://localhost:5432/prod");
    expect(config.storageMode).toBe("s3");
    expect(config.facturxMode).toBe("real");
    expect(config.pdpProvider).toBe("superpdp");
    expect(config.pdpArtifactMode).toBe("keys");
    expect(config.pdpReconcileIntervalMs).toBe(30000);
    expect(config.pdpReconcileBatch).toBe(50);
    expect(config.pdpReconcileOlderMinutes).toBe(30);
    expect(config.workerPollIntervalMs).toBe(5000);
    expect(config.ghlApiBase).toBe("https://ghl.example.com");
    expect(config.pdpApiBase).toBe("https://pdp.example.com");
  });
});

describe("resolveTenantFromRequest", () => {
  it("returns null when no tenant header is present", async () => {
    const pool = mockPool();
    const result = await resolveTenantFromRequest({}, pool);
    expect(result).toBeNull();
  });

  it("returns tenant when x-tenant-id matches", async () => {
    const tenant = { id: "t1", name: "Test Tenant", status: "active", config: {} };
    const pool = mockPool([tenant]);

    const result = await resolveTenantFromRequest({ "x-tenant-id": "t1" }, pool);

    expect(result).toEqual(tenant);
  });

  it("returns null when x-tenant-id does not match any active tenant", async () => {
    const pool = mockPool([]);
    const result = await resolveTenantFromRequest({ "x-tenant-id": "nonexistent" }, pool);
    expect(result).toBeNull();
  });

  it("returns tenant when x-ghl-location-id matches", async () => {
    const tenant = { id: "t2", name: "GHL Tenant", status: "active", config: {} };
    const pool = mockPool([tenant]);

    const result = await resolveTenantFromRequest({ "x-ghl-location-id": "loc123" }, pool);

    expect(result).toEqual(tenant);
  });

  it("returns null when x-ghl-location-id does not match", async () => {
    const pool = mockPool([]);
    const result = await resolveTenantFromRequest({ "x-ghl-location-id": "bad-loc" }, pool);
    expect(result).toBeNull();
  });

  it("prefers x-tenant-id over x-ghl-location-id", async () => {
    const tenant = { id: "t1", name: "By ID", status: "active", config: {} };
    const pool = {
      query: async (_sql: string, params: unknown[]) => {
        // If querying by tenant id
        if (String(params[0]) === "t1") {
          return { rows: [tenant], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
    } as unknown as Pool;

    const result = await resolveTenantFromRequest(
      { "x-tenant-id": "t1", "x-ghl-location-id": "loc456" },
      pool
    );

    expect(result).toEqual(tenant);
  });

  it("handles array header values by using the first element", async () => {
    const tenant = { id: "t3", name: "Array Tenant", status: "active", config: {} };
    const pool = mockPool([tenant]);

    const result = await resolveTenantFromRequest({ "x-tenant-id": ["t3", "t4"] }, pool);

    expect(result).toEqual(tenant);
  });
});
