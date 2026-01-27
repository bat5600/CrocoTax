import { createHttpPdpClient } from "./http";
import { createMockPdpClient } from "./mock";
import type { PdpClient } from "./types";

export function createPdpClient(): PdpClient {
  const provider = process.env.PDP_PROVIDER ?? "mock";
  if (provider === "mock") {
    return createMockPdpClient();
  }

  const baseUrl = process.env.PDP_API_BASE;
  if (!baseUrl) {
    throw new Error("PDP_API_BASE is not set");
  }

  return createHttpPdpClient({
    baseUrl,
    apiKey: process.env.PDP_API_KEY,
    provider
  });
}

export * from "./types";
