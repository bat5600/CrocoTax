import { describe, expect, it, vi } from "vitest";
import { createSuperPdpClient } from "../../packages/pdp/src/superpdp";

describe("SUPER PDP client", () => {
  it("submits a PDF as multipart and returns the invoice id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 123 }),
      text: async () => ""
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    const client = createSuperPdpClient({
      baseUrl: "https://api.superpdp.tech/",
      apiKey: "token",
      provider: "superpdp"
    });

    const pdfBase64 = Buffer.from("%PDF-1.4 fake", "utf8").toString("base64");
    const result = await client.submit(
      "tenant_1",
      // not used by the client at the moment
      {} as never,
      {
        pdf: { key: "pdf_key", base64: pdfBase64 },
        xml: { key: "xml_key", base64: Buffer.from("<xml/>").toString("base64") }
      },
      { correlationId: "corr_1", idempotencyKey: "idem_1" }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.superpdp.tech/v1.beta/invoices",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
          "X-Correlation-Id": "corr_1",
          "Idempotency-Key": "idem_1"
        }),
        body: expect.any(FormData)
      })
    );

    expect(result).toEqual({
      provider: "superpdp",
      submissionId: "123",
      status: "SUBMITTED"
    });
  });

  it("maps api:accepted to ACCEPTED", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            invoice_id: 123,
            status_code: "api:accepted",
            status_text: "Accepted",
            created_at: "2026-01-31T00:00:00Z"
          }
        ],
        has_after: false
      }),
      text: async () => ""
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    const client = createSuperPdpClient({
      baseUrl: "https://api.superpdp.tech",
      apiKey: "token",
      provider: "superpdp"
    });

    const status = await client.getStatus("tenant_1", "123");
    expect(status.status).toBe("ACCEPTED");
    expect(status.raw).toEqual(
      expect.objectContaining({
        provider: "superpdp",
        invoice_id: "123",
        latest_event: expect.objectContaining({ status_code: "api:accepted" })
      })
    );
  });

  it("maps fr:212 to PAID", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            invoice_id: 123,
            status_code: "fr:212",
            status_text: "Paid",
            created_at: "2026-01-31T00:00:00Z"
          }
        ],
        has_after: false
      }),
      text: async () => ""
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    const client = createSuperPdpClient({
      baseUrl: "https://api.superpdp.tech",
      apiKey: "token",
      provider: "superpdp"
    });

    const status = await client.getStatus("tenant_1", "123");
    expect(status.status).toBe("PAID");
  });
});

