import { Pool } from "pg";
import { Tenant } from "@croco/core";
import { loadEnvFile } from "./envfile";
import { decryptSecret, encryptSecret, getTenantSecrets } from "./secrets";

export interface EnvConfig {
  databaseUrl: string;
  objectStoreEndpoint?: string;
  objectStoreAccessKey?: string;
  objectStoreSecretKey?: string;
  objectStoreBucket?: string;
  storageMode: string;
  storageLocalPath?: string;
  facturxMode: string;
  pdpProvider: string;
  pdpApiBase?: string;
  ghlApiBase?: string;
  workerPollIntervalMs: number;
}

export function getEnv(): EnvConfig {
  loadEnvFile();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  return {
    databaseUrl,
    objectStoreEndpoint: process.env.OBJECT_STORE_ENDPOINT,
    objectStoreAccessKey: process.env.OBJECT_STORE_ACCESS_KEY,
    objectStoreSecretKey: process.env.OBJECT_STORE_SECRET_KEY,
    objectStoreBucket: process.env.OBJECT_STORE_BUCKET,
    storageMode: process.env.STORAGE_MODE ?? "filesystem",
    storageLocalPath: process.env.STORAGE_LOCAL_PATH,
    facturxMode: process.env.FACTURX_MODE ?? "stub",
    pdpProvider: process.env.PDP_PROVIDER ?? "mock",
    pdpApiBase: process.env.PDP_API_BASE,
    ghlApiBase: process.env.GHL_API_BASE,
    workerPollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1000)
  };
}

export async function resolveTenantFromRequest(
  headers: Record<string, unknown>,
  pool: Pool
): Promise<Tenant | null> {
  const rawTenantId = headers["x-tenant-id"];
  const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
  if (!tenantId || typeof tenantId !== "string") {
    return null;
  }
  const result = await pool.query(
    "SELECT id, name, status, config FROM tenants WHERE id = $1 AND status = 'active'",
    [tenantId]
  );
  if (result.rowCount === 0) {
    return null;
  }
  return result.rows[0] as Tenant;
}

export { loadEnvFile };
export { encryptSecret, decryptSecret, getTenantSecrets };
