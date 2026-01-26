import type { Pool } from "pg";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForDatabase(
  pool: Pool,
  opts?: {
    maxAttempts?: number;
    delayMs?: number;
  }
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 30;
  const delayMs = opts?.delayMs ?? 250;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      await sleep(delayMs);
    }
  }

  throw lastError;
}
