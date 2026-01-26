import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getPool, closePool } from "@croco/db";
import { loadEnvFile } from "@croco/config";

export async function runMigrations(): Promise<void> {
  loadEnvFile();
  const pool = getPool();
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await pool.query(sql);
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
