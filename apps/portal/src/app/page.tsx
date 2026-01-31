import { PortalLayout } from "@/components/portal-layout";

export default function Home() {
  return (
    <PortalLayout
      title="Live Compliance Dashboard"
      activeNav="Dashboard"
      actions={
        <>
          <button className="ghost-btn">Export</button>
          <button className="primary-btn">New Invoice</button>
        </>
      }
    >
      <section className="kpi-grid">
        {[
          { label: "Sent today", value: "1,248", change: "+12%" },
          { label: "Pending", value: "318", change: "-4%" },
          { label: "Rejected", value: "12", change: "+2" },
          { label: "Avg time to accept", value: "42m", change: "-8m" }
        ].map((kpi, idx) => (
          <article
            key={kpi.label}
            className="kpi-card fade-up"
            style={{ animationDelay: `${idx * 0.08}s` }}
          >
            <p className="kpi-label">{kpi.label}</p>
            <div className="kpi-row">
              <h2>{kpi.value}</h2>
              <span className="kpi-change">{kpi.change}</span>
            </div>
            <div className="kpi-spark" />
          </article>
        ))}
      </section>

      <section className="panel-grid">
        <article className="panel large fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="panel-header">
            <div>
              <h3>Invoice flow</h3>
              <p>Real-time delivery funnel across tenants.</p>
            </div>
            <div className="chips">
              <button className="chip active">24h</button>
              <button className="chip">7d</button>
              <button className="chip">30d</button>
            </div>
          </div>
          <div className="flow-chart">
            {[
              { label: "Received", value: "3,802" },
              { label: "Mapped", value: "3,791" },
              { label: "Submitted", value: "3,760" },
              { label: "Accepted", value: "3,712", highlight: true }
            ].map((node, idx) => (
              <div
                key={node.label}
                className="flow-step fade-up"
                style={{ animationDelay: `${0.2 + idx * 0.08}s` }}
              >
                <div className={`flow-node ${node.highlight ? "highlight" : ""}`}>
                  <p>{node.label}</p>
                  <h4>{node.value}</h4>
                </div>
                {idx < 3 ? <div className="flow-connector" /> : null}
              </div>
            ))}
          </div>
        </article>

        <article className="panel fade-up" style={{ animationDelay: "0.18s" }}>
          <div className="panel-header">
            <div>
              <h3>Recent alerts</h3>
              <p>Items that need attention.</p>
            </div>
            <button className="ghost-btn small">View all</button>
          </div>
          <div className="alert-list">
            {[
              { title: "Rejected invoice", meta: "INV-2026-9912 · ACP", tag: "Rejected" },
              { title: "PDP timeout", meta: "GHL Lyon · 12m ago", tag: "Delayed" },
              { title: "Missing VAT", meta: "INV-2026-9902", tag: "Action" }
            ].map((alert, idx) => (
              <div
                key={alert.title}
                className="alert-item fade-up"
                style={{ animationDelay: `${0.24 + idx * 0.08}s` }}
              >
                <div>
                  <p className="alert-title">{alert.title}</p>
                  <p className="alert-meta">{alert.meta}</p>
                </div>
                <span className={`tag ${alert.tag.toLowerCase()}`}>{alert.tag}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PortalLayout>
  );
}
