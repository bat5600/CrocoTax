import { PortalLayout } from "@/components/portal-layout";

const ALERTS = [
  {
    title: "Rejected invoice",
    meta: "INV-2026-9891 · GHL Paris",
    status: "Rejected",
    tone: "failed"
  },
  {
    title: "PDP timeout",
    meta: "GHL Lyon · 18 minutes",
    status: "Delayed",
    tone: "pending"
  },
  {
    title: "Missing VAT number",
    meta: "INV-2026-9902 · GHL Nantes",
    status: "Action",
    tone: "review"
  }
];

export default function AlertsPage() {
  return (
    <PortalLayout
      title="Alerts Center"
      subtitle="Issues that need immediate attention."
      activeNav="Alerts"
      actions={<button className="primary-btn">Resolve all</button>}
    >
      <section className="panel fade-up">
        <div className="panel-header">
          <div>
            <h3>Open alerts</h3>
            <p>Prioritized by risk and SLA impact.</p>
          </div>
          <button className="ghost-btn small">Download log</button>
        </div>
        <div className="alert-list">
          {ALERTS.map((alert) => (
            <div key={alert.title} className="alert-item">
              <div>
                <p className="alert-title">{alert.title}</p>
                <p className="alert-meta">{alert.meta}</p>
              </div>
              <span className={`status-pill ${alert.tone}`}>
                {alert.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <article className="panel fade-up" style={{ animationDelay: "0.12s" }}>
          <h3>Root cause</h3>
          <p className="muted">
            78% of issues are missing customer identifiers or invalid VAT
            numbers. Automate validation before submission to reduce rejects.
          </p>
          <div className="meter">
            <span style={{ width: "78%" }} />
          </div>
        </article>
        <article className="panel fade-up" style={{ animationDelay: "0.18s" }}>
          <h3>Recovery tips</h3>
          <ul className="checklist">
            <li>Notify tenant admin when PDP rejects occur.</li>
            <li>Auto-retry timeouts after 5 minutes.</li>
            <li>Escalate invoices above EUR 5k.</li>
          </ul>
        </article>
      </section>
    </PortalLayout>
  );
}
