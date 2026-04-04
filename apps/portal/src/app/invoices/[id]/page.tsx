"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PortalLayout } from "@/components/portal-layout";
import { apiFetch, getTenantId, displayStatus, statusTone } from "@/lib/api";

interface InvoiceDetail {
  id: string;
  tenant_id: string;
  ghl_invoice_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  latest_pdp_status: string | null;
  latest_pdp_provider: string | null;
  latest_pdp_submission_id: string | null;
  latest_pdp_last_error: string | null;
  latest_pdp_status_raw: unknown;
  raw_payload: unknown;
  canonical_payload: Record<string, unknown> | null;
  latest_pdf_key: string | null;
  latest_xml_key: string | null;
}

interface AuditEvent {
  id: string;
  event_type: string;
  actor: string;
  payload: unknown;
  created_at: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tenantId = getTenantId();
    if (!tenantId) {
      setError("NO_TENANT");
      setLoading(false);
      return;
    }

    Promise.all([
      apiFetch<{ ok: boolean; invoice: InvoiceDetail }>(`invoices/${invoiceId}`),
      apiFetch<{ ok: boolean; events: AuditEvent[] }>(`invoices/${invoiceId}/audit`).catch(
        () => ({ ok: false, events: [] })
      ),
    ])
      .then(([invData, auditData]) => {
        setInvoice(invData.invoice);
        setEvents(auditData.events ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (error === "NO_TENANT") {
    return (
      <PortalLayout title="Invoice Detail" activeNav="Invoices">
        <section className="panel fade-up" style={{ padding: "2rem", textAlign: "center" }}>
          <h3>Configure tenant</h3>
          <p className="muted">
            Set <code>crocotax_tenant_id</code> in localStorage to view invoice details.
          </p>
        </section>
      </PortalLayout>
    );
  }

  if (loading) {
    return (
      <PortalLayout title={`Invoice ${invoiceId}`} activeNav="Invoices">
        <p style={{ padding: "2rem", textAlign: "center" }} className="muted">
          Loading invoice...
        </p>
      </PortalLayout>
    );
  }

  if (error || !invoice) {
    return (
      <PortalLayout title={`Invoice ${invoiceId}`} activeNav="Invoices">
        <section className="panel fade-up" style={{ padding: "2rem", textAlign: "center" }}>
          <h3>Unable to load invoice</h3>
          <p className="muted">{error ?? "Invoice not found."}</p>
        </section>
      </PortalLayout>
    );
  }

  const cp = invoice.canonical_payload ?? {};
  const buyerName = String(cp.buyer_name ?? cp.customer_name ?? "—");
  const buyerSiret = String(cp.buyer_siret ?? cp.siret ?? "");
  const totalAmount = cp.total_amount != null ? `EUR ${cp.total_amount}` : "—";
  const subtotal = cp.subtotal != null ? `EUR ${cp.subtotal}` : "—";
  const vatAmount = cp.vat_amount != null ? `EUR ${cp.vat_amount}` : "—";
  const issueDate = String(cp.issue_date ?? invoice.created_at?.slice(0, 10) ?? "—");
  const dueDate = String(cp.due_date ?? "—");
  const label = displayStatus(invoice.status);
  const tone = statusTone(label);

  const pdfUrl = `/api/v1/invoices/${invoice.id}/artifacts/pdf`;
  const xmlUrl = `/api/v1/invoices/${invoice.id}/artifacts/xml`;

  // Build timeline from audit events, falling back to status-based timeline
  const timeline =
    events.length > 0
      ? events
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
          .map((e) => ({
            title: e.event_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            meta: new Date(e.created_at).toLocaleString(),
            status: "ok",
          }))
      : [
          {
            title: `Status: ${label}`,
            meta: new Date(invoice.updated_at).toLocaleString(),
            status: tone,
          },
          {
            title: "Invoice created",
            meta: new Date(invoice.created_at).toLocaleString(),
            status: "ok",
          },
        ];

  return (
    <PortalLayout
      title={`Invoice ${invoice.ghl_invoice_id ?? invoiceId}`}
      subtitle="Delivery overview and compliance trace."
      activeNav="Invoices"
      actions={
        <>
          <a className="ghost-btn" href={pdfUrl} target="_blank" rel="noopener noreferrer">
            Download PDF
          </a>
          <a className="ghost-btn" href={xmlUrl} target="_blank" rel="noopener noreferrer">
            Download XML
          </a>
          <button className="primary-btn">Resend</button>
        </>
      }
    >
      <section className="detail-hero">
        <div className="panel hero-card fade-up">
          <div className="hero-main">
            <div>
              <p className="hero-label">Buyer</p>
              <h3>{buyerName}</h3>
              {buyerSiret && <p className="muted">SIRET {buyerSiret}</p>}
            </div>
            <div className="hero-amount">
              <p className="hero-label">Total</p>
              <h2>{totalAmount}</h2>
              <span className={`status-pill ${tone}`}>{label}</span>
            </div>
          </div>
          <div className="hero-meta">
            {[
              { label: "Issue date", value: issueDate },
              { label: "Due date", value: dueDate },
              { label: "Tenant", value: invoice.tenant_id },
              { label: "PDP", value: invoice.latest_pdp_provider ?? "—" },
            ].map((item) => (
              <div key={item.label} className="meta-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="detail-grid">
        <div className="stack">
          <article className="panel fade-up">
            <div className="panel-header">
              <div>
                <h3>Status timeline</h3>
                <p>Real-time submission history.</p>
              </div>
            </div>
            <div className="timeline">
              {timeline.map((item, idx) => (
                <div key={idx} className="timeline-item">
                  <span className={`timeline-dot ${item.status}`} />
                  <div>
                    <p className="timeline-title">{item.title}</p>
                    <p className="timeline-meta">{item.meta}</p>
                  </div>
                  <span className={`status-pill ${item.status}`}>
                    {item.status === "ok" ? "OK" : item.status === "failed" ? "FAIL" : "..."}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel fade-up" style={{ animationDelay: "0.12s" }}>
            <div className="panel-header">
              <div>
                <h3>Line summary</h3>
                <p>Key invoice totals.</p>
              </div>
            </div>
            <div className="key-values">
              {[
                { label: "Subtotal", value: subtotal },
                { label: "VAT", value: vatAmount },
                { label: "Total", value: totalAmount },
              ].map((row) => (
                <div key={row.label} className="key-value">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="stack">
          <article className="panel fade-up" style={{ animationDelay: "0.16s" }}>
            <h3>Artifacts</h3>
            <p className="muted">Stored in Factur-X vault.</p>
            <div className="artifact-list">
              {[
                {
                  label: "Factur-X PDF/A",
                  value: invoice.latest_pdf_key ? "Ready" : "Not available",
                  tone: invoice.latest_pdf_key ? "ok" : "pending",
                },
                {
                  label: "Embedded XML",
                  value: invoice.latest_xml_key ? "Ready" : "Not available",
                  tone: invoice.latest_xml_key ? "ok" : "pending",
                },
                {
                  label: "PDP submission",
                  value: invoice.latest_pdp_submission_id ?? "—",
                  tone: invoice.latest_pdp_submission_id ? "ok" : "pending",
                },
              ].map((artifact) => (
                <div key={artifact.label} className="artifact-row">
                  <div>
                    <p className="artifact-title">{artifact.label}</p>
                    <p className="artifact-meta">{artifact.value}</p>
                  </div>
                  <span className={`status-pill ${artifact.tone}`}>
                    {artifact.value}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel fade-up" style={{ animationDelay: "0.22s" }}>
            <h3>Audit trail</h3>
            <p className="muted">Latest system checkpoints.</p>
            <div className="audit-list">
              {events.length === 0 ? (
                <p className="muted" style={{ padding: "1rem 0" }}>No audit events recorded.</p>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="audit-row">
                    <span>
                      {e.event_type.replace(/_/g, " ")}
                      {e.actor ? ` (${e.actor})` : ""}
                    </span>
                    <span className="muted">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>
    </PortalLayout>
  );
}
