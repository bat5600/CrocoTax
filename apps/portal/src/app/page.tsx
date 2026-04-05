"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal-layout";
import { apiFetch, getTenantId, displayStatus, statusTone, relativeTime } from "@/lib/api";

interface Invoice {
  id: string;
  ghl_invoice_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  latest_pdp_status: string | null;
}

interface InvoicesResponse {
  ok: boolean;
  invoices: Invoice[];
}

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tenantId = getTenantId();
    if (!tenantId) {
      setError("NO_TENANT");
      setLoading(false);
      return;
    }

    apiFetch<InvoicesResponse>("invoices?limit=200")
      .then((data) => setInvoices(data.invoices ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Compute KPIs
  const total = invoices.length;
  const accepted = invoices.filter((i) =>
    ["Accepted", "Paid"].includes(displayStatus(i.status))
  ).length;
  const pending = invoices.filter((i) =>
    ["Pending", "Processing"].includes(displayStatus(i.status))
  ).length;
  const rejected = invoices.filter((i) =>
    ["Rejected", "Error"].includes(displayStatus(i.status))
  ).length;

  // Flow funnel counts
  const received = total;
  const mapped = invoices.filter((i) =>
    !["NEW", "FETCHED"].includes((i.status ?? "").toUpperCase())
  ).length;
  const submitted = invoices.filter((i) =>
    ["SUBMITTED", "SYNCED", "ACCEPTED", "REJECTED", "PAID", "ERROR"].includes(
      (i.status ?? "").toUpperCase()
    )
  ).length;

  // Recent alerts (rejected/error invoices)
  const alerts = invoices
    .filter((i) => ["Rejected", "Error"].includes(displayStatus(i.status)))
    .slice(0, 5);

  const kpis = [
    { label: "Total invoices", value: loading ? "..." : String(total) },
    { label: "Accepted", value: loading ? "..." : String(accepted) },
    { label: "Pending", value: loading ? "..." : String(pending) },
    { label: "Rejected", value: loading ? "..." : String(rejected) },
  ];

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
      {error === "NO_TENANT" && (
        <section className="panel fade-up" style={{ padding: "1.5rem", marginBottom: "1.5rem", textAlign: "center" }}>
          <h3>Configure tenant</h3>
          <p className="muted">
            Set <code>crocotax_tenant_id</code> in localStorage to load real data.
          </p>
        </section>
      )}

      <section className="kpi-grid">
        {kpis.map((kpi, idx) => (
          <article
            key={kpi.label}
            className="kpi-card fade-up"
            style={{ animationDelay: `${idx * 0.08}s` }}
          >
            <p className="kpi-label">{kpi.label}</p>
            <div className="kpi-row">
              <h2>{kpi.value}</h2>
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
          </div>
          {loading ? (
            <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>
              Loading...
            </p>
          ) : (
            <div className="flow-chart">
              {[
                { label: "Received", value: String(received) },
                { label: "Mapped", value: String(mapped) },
                { label: "Submitted", value: String(submitted) },
                { label: "Accepted", value: String(accepted), highlight: true },
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
          )}
        </article>

        <article className="panel fade-up" style={{ animationDelay: "0.18s" }}>
          <div className="panel-header">
            <div>
              <h3>Recent alerts</h3>
              <p>Items that need attention.</p>
            </div>
            <a className="ghost-btn small" href="/alerts">View all</a>
          </div>
          <div className="alert-list">
            {loading ? (
              <p className="muted" style={{ padding: "1rem" }}>Loading...</p>
            ) : alerts.length === 0 ? (
              <p className="muted" style={{ padding: "1rem" }}>No alerts at this time.</p>
            ) : (
              alerts.map((inv) => {
                const label = displayStatus(inv.status);
                return (
                  <div key={inv.id} className="alert-item fade-up">
                    <div>
                      <p className="alert-title">{label} invoice</p>
                      <p className="alert-meta">
                        {inv.ghl_invoice_id ?? inv.id} &middot; {relativeTime(inv.updated_at)}
                      </p>
                    </div>
                    <span className={`tag ${label.toLowerCase()}`}>{label}</span>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
    </PortalLayout>
  );
}
