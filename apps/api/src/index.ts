import { buildServer } from "./server";
import { getPool } from "@croco/db";
import { DbQueue } from "@croco/queue";
import { createLogger } from "@croco/observability";
import { loadEnvFile } from "@croco/config";
import { createStorageClient } from "@croco/storage";

loadEnvFile();

const logger = createLogger();
const pool = getPool();
const queue = new DbQueue(pool, logger);
const storageClient = createStorageClient();

const app = buildServer({ logger, pool, queue, storageClient });

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  logger.error(error);
  process.exit(1);
});
