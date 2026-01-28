import { randomUUID } from "crypto";
import { getPool } from "@croco/db";
import { DbQueue } from "@croco/queue";
import { createLogger } from "@croco/observability";
import { getEnv, loadEnvFile } from "@croco/config";
import { startWorker } from "./worker";
import { createGhlClient } from "@croco/ghl";
import { createFacturxGenerator } from "@croco/facturx";
import { createStorageClient } from "@croco/storage";
import { createPdpClient } from "@croco/pdp";
import { JobType } from "@croco/core";

loadEnvFile();

const logger = createLogger();
const pool = getPool();
const queue = new DbQueue(pool, logger);
const env = getEnv();
const ghlClient = createGhlClient();
const facturxGenerator = createFacturxGenerator();
const storageClient = createStorageClient();
const pdpClient = createPdpClient();

const workerId = process.env.WORKER_ID ?? randomUUID();

startWorker(
  {
    pool,
    queue,
    logger,
    ghlClient,
    facturxGenerator,
    storageClient,
    pdpClient
  },
  workerId,
  env.workerPollIntervalMs
);

const reconcileIntervalMs = env.pdpReconcileIntervalMs;
setInterval(async () => {
  try {
    const correlationId = randomUUID();
    const bucket = Math.floor(Date.now() / reconcileIntervalMs);
    await queue.enqueue(
      JobType.RECONCILE_PDP,
      {
        correlationId,
        limit: env.pdpReconcileBatch
      },
      {
        idempotencyKey: `RECONCILE:${bucket}`,
        correlationId
      }
    );
  } catch (error) {
    logger.error({ error }, "pdp.reconcile.enqueue_failed");
  }
}, reconcileIntervalMs);
