import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getPool, closePool, waitForDatabase } from "@croco/db";
import { loadEnvFile } from "@croco/config";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMigrations(): Promise<void> {
  loadEnvFile();
  const pool = getPool();
  await waitForDatabase(pool);

  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
  );
  const appliedResult = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations"
  );
  const applied = new Set(appliedResult.rows.map((r) => r.filename));

  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    // Retry a few times for transient startup issues (e.g. container not ready yet).
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await pool.query(sql);
        break;
      } catch (error) {
        if (attempt === 3) {
          throw error;
        }
        await sleep(250 * attempt);
      }
    }

    // Record success; retry insert separately so we don't reapply the migration file.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await pool.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
          [file]
        );
        break;
      } catch (error) {
        if (attempt === 3) {
          throw error;
        }
        await sleep(250 * attempt);
      }
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
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
