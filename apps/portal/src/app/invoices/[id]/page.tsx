import { PortalLayout } from "@/components/portal-layout";

type InvoiceDetailPageProps = {
  params: { id: string };
};

const TIMELINE = [
  {
    title: "Accepted by PDP",
    meta: "2026-01-29 09:14",
    status: "ok"
  },
  {
    title: "Submitted to PDP",
    meta: "2026-01-29 09:10",
    status: "ok"
  },
  {
    title: "Mapped to Factur-X",
    meta: "2026-01-29 09:06",
    status: "ok"
  },
  {
    title: "Received from GHL",
    meta: "2026-01-29 09:02",
    status: "ok"
  }
];

const AUDIT = [
  {
    label: "Webhook received",
    value: "200 OK - ghl.invoice.created"
  },
  {
    label: "Validation",
    value: "Factur-X EN 16931 profile"
  },
  {
    label: "PDP reference",
    value: "FR-PDP-AX1-7782"
  }
];

export default function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const invoiceId = params.id ?? "INV-2026-9912";

  return (
    <PortalLayout
      title={`Invoice ${invoiceId}`}
      subtitle="Delivery overview and compliance trace."
      activeNav="Invoices"
      actions={
        <>
          <button className="ghost-btn">Download PDF</button>
          <button className="ghost-btn">Download XML</button>
          <button className="primary-btn">Resend</button>
        </>
      }
    >
      <section className="detail-hero">
        <div className="panel hero-card fade-up">
          <div className="hero-main">
            <div>
              <p className="hero-label">Buyer</p>
              <h3>ACME SAS</h3>
              <p className="muted">SIRET 812 332 901 00012</p>
            </div>
            <div className="hero-amount">
              <p className="hero-label">Total</p>
              <h2>EUR 4,520.00</h2>
              <span className="status-pill ok">Accepted</span>
            </div>
          </div>
          <div className="hero-meta">
            {[
              { label: "Issue date", value: "2026-01-29" },
              { label: "Due date", value: "2026-02-12" },
              { label: "Tenant", value: "GHL Paris" },
              { label: "PDP", value: "PDP Alpha FR-001" }
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
              <span className="pill">Latency 8m</span>
            </div>
            <div className="timeline">
              {TIMELINE.map((item) => (
                <div key={item.title} className="timeline-item">
                  <span className={`timeline-dot ${item.status}`} />
                  <div>
                    <p className="timeline-title">{item.title}</p>
                    <p className="timeline-meta">{item.meta}</p>
                  </div>
                  <span className={`status-pill ${item.status}`}>OK</span>
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
                { label: "Subtotal", value: "EUR 3,760.00" },
                { label: "VAT (20%)", value: "EUR 752.00" },
                { label: "Discount", value: "EUR 0.00" },
                { label: "Total", value: "EUR 4,520.00" }
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
                { label: "Factur-X PDF/A", value: "Ready", tone: "ok" },
                { label: "Embedded XML", value: "Ready", tone: "ok" },
                { label: "PDP receipt", value: "Stored", tone: "pending" }
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
              {AUDIT.map((item) => (
                <div key={item.label} className="audit-row">
                  <span>{item.label}</span>
                  <span className="muted">{item.value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </PortalLayout>
  );
}
