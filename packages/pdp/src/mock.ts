import { randomUUID } from "crypto";
import { PdpClient, PdpStatus, PdpSubmission } from "./types";

export function createMockPdpClient(): PdpClient {
  return {
    async submit(): Promise<PdpSubmission> {
      return {
        provider: "mock",
        submissionId: `mock-${randomUUID()}`,
        status: "SUBMITTED"
      };
    },
    async getStatus(): Promise<PdpStatus> {
      return {
        status: "ACCEPTED",
        raw: { source: "mock" }
      };
    }
  };
}
