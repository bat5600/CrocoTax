import { existsSync, readFileSync } from "fs";
import { join } from "path";

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Minimal dotenv loader to keep the repo runnable without extra dependencies.
 * Does not overwrite existing process.env keys.
 */
export function loadEnvFile(filename = ".env"): void {
  const envPath = join(process.cwd(), filename);
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const withoutExport = line.startsWith("export ") ? line.slice("export ".length) : line;
    const idx = withoutExport.indexOf("=");
    if (idx <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, idx).trim();
    const value = stripQuotes(withoutExport.slice(idx + 1));
    if (!key) {
      continue;
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
