import { describe, it, expect } from "vitest";
import {
  mapPdpStatusToInvoice,
  isPendingStatus,
  computeNextRun
} from "../../apps/worker/src/worker";

describe("mapPdpStatusToInvoice", () => {
  it("maps ACCEPTED to ACCEPTED", () => {
    expect(mapPdpStatusToInvoice("ACCEPTED")).toBe("ACCEPTED");
  });

  it("maps REJECTED to REJECTED", () => {
    expect(mapPdpStatusToInvoice("REJECTED")).toBe("REJECTED");
  });

  it("maps PAID to PAID", () => {
    expect(mapPdpStatusToInvoice("PAID")).toBe("PAID");
  });

  it("maps SUBMITTED to SYNCED", () => {
    expect(mapPdpStatusToInvoice("SUBMITTED")).toBe("SYNCED");
  });

  it("maps PROCESSING to SYNCED", () => {
    expect(mapPdpStatusToInvoice("PROCESSING")).toBe("SYNCED");
  });

  it("maps PENDING to SYNCED", () => {
    expect(mapPdpStatusToInvoice("PENDING")).toBe("SYNCED");
  });

  it("maps ERROR to ERROR", () => {
    expect(mapPdpStatusToInvoice("ERROR")).toBe("ERROR");
  });

  it("maps FAILED to ERROR", () => {
    expect(mapPdpStatusToInvoice("FAILED")).toBe("ERROR");
  });

  it("maps unknown status to SYNCED", () => {
    expect(mapPdpStatusToInvoice("SOMETHING_ELSE")).toBe("SYNCED");
  });

  it("is case-insensitive", () => {
    expect(mapPdpStatusToInvoice("accepted")).toBe("ACCEPTED");
    expect(mapPdpStatusToInvoice("Rejected")).toBe("REJECTED");
    expect(mapPdpStatusToInvoice("paid")).toBe("PAID");
    expect(mapPdpStatusToInvoice("submitted")).toBe("SYNCED");
    expect(mapPdpStatusToInvoice("error")).toBe("ERROR");
  });

  it("calls logger.warn for unknown statuses when logger is provided", () => {
    const warnings: unknown[] = [];
    const logger = {
      warn: (...args: unknown[]) => { warnings.push(args); }
    } as never;
    mapPdpStatusToInvoice("UNKNOWN_STATUS", logger);
    expect(warnings.length).toBe(1);
  });
});

describe("isPendingStatus", () => {
  it("returns true for SUBMITTED", () => {
    expect(isPendingStatus("SUBMITTED")).toBe(true);
  });

  it("returns true for PROCESSING", () => {
    expect(isPendingStatus("PROCESSING")).toBe(true);
  });

  it("returns true for PENDING", () => {
    expect(isPendingStatus("PENDING")).toBe(true);
  });

  it("returns true for SYNCED", () => {
    expect(isPendingStatus("SYNCED")).toBe(true);
  });

  it("returns false for ACCEPTED", () => {
    expect(isPendingStatus("ACCEPTED")).toBe(false);
  });

  it("returns false for REJECTED", () => {
    expect(isPendingStatus("REJECTED")).toBe(false);
  });

  it("returns false for PAID", () => {
    expect(isPendingStatus("PAID")).toBe(false);
  });

  it("returns false for ERROR", () => {
    expect(isPendingStatus("ERROR")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isPendingStatus("submitted")).toBe(true);
    expect(isPendingStatus("accepted")).toBe(false);
  });
});

describe("computeNextRun", () => {
  it("returns exponentially increasing delays", () => {
    const now = Date.now();
    const run1 = computeNextRun(1);
    const run2 = computeNextRun(2);
    const run3 = computeNextRun(3);

    // attempts=1 -> 2^1 * 1000 = 2000ms
    // attempts=2 -> 2^2 * 1000 = 4000ms
    // attempts=3 -> 2^3 * 1000 = 8000ms
    expect(run1.getTime()).toBeGreaterThanOrEqual(now + 2000 - 50);
    expect(run1.getTime()).toBeLessThanOrEqual(now + 2000 + 100);

    expect(run2.getTime()).toBeGreaterThanOrEqual(now + 4000 - 50);
    expect(run2.getTime()).toBeLessThanOrEqual(now + 4000 + 100);

    expect(run3.getTime()).toBeGreaterThanOrEqual(now + 8000 - 50);
    expect(run3.getTime()).toBeLessThanOrEqual(now + 8000 + 100);
  });

  it("treats attempts=0 as attempts=1 (minimum)", () => {
    const now = Date.now();
    const run = computeNextRun(0);
    // Math.max(0,1) = 1, so 2^1 * 1000 = 2000ms
    expect(run.getTime()).toBeGreaterThanOrEqual(now + 2000 - 50);
    expect(run.getTime()).toBeLessThanOrEqual(now + 2000 + 100);
  });

  it("caps at maxMs (default 10 minutes)", () => {
    const now = Date.now();
    const maxMs = 10 * 60 * 1000;
    // attempts=20 -> 2^20 * 1000 = 1048576000ms, way above cap
    const run = computeNextRun(20);
    expect(run.getTime()).toBeGreaterThanOrEqual(now + maxMs - 50);
    expect(run.getTime()).toBeLessThanOrEqual(now + maxMs + 100);
  });

  it("respects custom maxMs", () => {
    const now = Date.now();
    const customMax = 5000;
    // attempts=10 -> 2^10 * 1000 = 1024000ms, above 5000 cap
    const run = computeNextRun(10, customMax);
    expect(run.getTime()).toBeGreaterThanOrEqual(now + customMax - 50);
    expect(run.getTime()).toBeLessThanOrEqual(now + customMax + 100);
  });
});
