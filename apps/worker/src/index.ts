import { randomUUID } from "crypto";
import { getPool } from "@croco/db";
import { DbQueue } from "@croco/queue";
import { createLogger } from "@croco/observability";
import { getEnv, loadEnvFile } from "@croco/config";
import { startWorker } from "./worker";

loadEnvFile();

const logger = createLogger();
const pool = getPool();
const queue = new DbQueue(pool, logger);
const env = getEnv();

const workerId = process.env.WORKER_ID ?? randomUUID();

startWorker(
  {
    pool,
    queue,
    logger
  },
  workerId,
  env.workerPollIntervalMs
);
