import { describe, expect, it, vi } from "vitest";
import { createHandlers, WorkerContext } from "../../apps/worker/src/worker";
import { JobType } from "@croco/core";

function makeCtx(overrides: Partial<WorkerContext> = {}): WorkerContext {
  return {
    pool: {} as WorkerContext["pool"],
    queue: { enqueue: vi.fn().mockResolvedValue({ enqueued: true }) } as unknown as WorkerContext["queue"],
    logger: { info: vi.fn(), error: vi.fn() } as unknown as WorkerContext["logger"],
    ghlClient: {} as WorkerContext["ghlClient"],
    facturxGenerator: {} as WorkerContext["facturxGenerator"],
    storageClient: {} as WorkerContext["storageClient"],
    pdpClient: {} as WorkerContext["pdpClient"],
    ...overrides
  };
}

vi.mock("@croco/db", async () => {
  const actual = await vi.importActual<typeof import("@croco/db")>("@croco/db");
  return {
    ...actual,
    listPendingSubmissions: vi.fn().mockResolvedValue([
      {
        tenant_id: "tenant_1",
        invoice_id: "invoice_1",
        submission_id: "sub_1",
        provider: "mock",
        id: "pdp_1",
        status: "SUBMITTED"
      }
    ])
  };
});

vi.mock("@croco/audit", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined)
}));

describe("PDP reconcile handler", () => {
  it("enqueues sync jobs for pending submissions", async () => {
    const ctx = makeCtx();
    const handlers = createHandlers(ctx);

    await handlers[JobType.RECONCILE_PDP](
      {
        id: "job_1",
        type: JobType.RECONCILE_PDP,
        payload: { correlationId: "corr_1", limit: 10 },
        attempts: 0,
        maxAttempts: 5
      },
      ctx
    );

    const enqueue = ctx.queue.enqueue as unknown as ReturnType<typeof vi.fn>;
    expect(enqueue).toHaveBeenCalledWith(
      JobType.SYNC_STATUS,
      expect.objectContaining({ tenantId: "tenant_1", invoiceId: "invoice_1" }),
      expect.objectContaining({ tenantId: "tenant_1" })
    );
  });
});
