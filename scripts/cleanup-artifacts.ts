import { readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { loadEnvFile } from "@croco/config";

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path, files);
    } else {
      files.push(path);
    }
  }
  return files;
}

async function run(): Promise<void> {
  loadEnvFile();
  const basePath = process.env.STORAGE_LOCAL_PATH ?? "./storage";
  const days = Number(process.env.ARTIFACT_RETENTION_DAYS ?? 30);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const dryRun = process.env.DRY_RUN === "1";

  const targets = walk(basePath).filter((path) => path.endsWith(".pdf") || path.endsWith(".xml"));
  let removed = 0;

  for (const file of targets) {
    const stats = statSync(file);
    if (stats.mtimeMs < cutoff) {
      if (!dryRun) {
        unlinkSync(file);
      }
      removed += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Cleanup complete. Removed ${removed} artifacts${dryRun ? " (dry run)" : ""}.`);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
