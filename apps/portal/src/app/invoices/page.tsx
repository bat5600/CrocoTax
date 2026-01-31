import { PortalLayout } from "@/components/portal-layout";

const INVOICES = [
  {
    id: "INV-2026-9912",
    buyer: "ACME SAS",
    tenant: "GHL Paris",
    amount: "EUR 4,520.00",
    status: "Accepted",
    statusTone: "ok",
    pdp: "Delivered",
    pdpTone: "ok",
    updated: "12m"
  },
  {
    id: "INV-2026-9909",
    buyer: "Nova Retail",
    tenant: "GHL Lyon",
    amount: "EUR 1,140.00",
    status: "Submitted",
    statusTone: "pending",
    pdp: "In review",
    pdpTone: "pending",
    updated: "28m"
  },
  {
    id: "INV-2026-9902",
    buyer: "Lumen Group",
    tenant: "GHL Nantes",
    amount: "EUR 860.00",
    status: "Action needed",
    statusTone: "review",
    pdp: "Missing VAT",
    pdpTone: "review",
    updated: "1h"
  },
  {
    id: "INV-2026-9891",
    buyer: "Atelier 72",
    tenant: "GHL Paris",
    amount: "EUR 3,320.00",
    status: "Rejected",
    statusTone: "failed",
    pdp: "Schema error",
    pdpTone: "failed",
    updated: "2h"
  },
  {
    id: "INV-2026-9877",
    buyer: "Plume Hotels",
    tenant: "GHL Lille",
    amount: "EUR 2,015.00",
    status: "Accepted",
    statusTone: "ok",
    pdp: "Delivered",
    pdpTone: "ok",
    updated: "3h"
  },
  {
    id: "INV-2026-9862",
    buyer: "Sable SAS",
    tenant: "GHL Marseille",
    amount: "EUR 620.00",
    status: "Pending",
    statusTone: "pending",
    pdp: "Queued",
    pdpTone: "pending",
    updated: "4h"
  }
];

export default function InvoicesPage() {
  return (
    <PortalLayout
      title="Invoice Queue"
      subtitle="Monitor delivery, exceptions, and PDP results."
      activeNav="Invoices"
      actions={
        <>
          <button className="ghost-btn">Download report</button>
          <button className="primary-btn">Create invoice</button>
        </>
      }
    >
      <section className="filter-bar">
        <div className="search-field">
          <span className="search-icon">Search</span>
          <input
            type="search"
            placeholder="Search invoice, buyer, or tenant"
          />
        </div>
        <div className="filter-group">
          <button className="filter-pill active">All</button>
          <button className="filter-pill">Accepted</button>
          <button className="filter-pill">Pending</button>
          <button className="filter-pill">Exceptions</button>
          <select className="filter-select" defaultValue="24h">
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel table-panel fade-up">
          <div className="table-header">
            <div>
              <h3>Live submissions</h3>
              <p>Updated every 2 minutes from the PDP pipeline.</p>
            </div>
            <button className="ghost-btn small">Export CSV</button>
          </div>
          <div className="invoice-table">
            <div className="invoice-row header">
              <span>Invoice</span>
              <span>Tenant</span>
              <span>Amount</span>
              <span>Status</span>
              <span>PDP</span>
              <span>Updated</span>
              <span></span>
            </div>
            {INVOICES.map((invoice) => (
              <div key={invoice.id} className="invoice-row">
                <div className="invoice-main">
                  <p className="invoice-id">{invoice.id}</p>
                  <p className="invoice-meta">{invoice.buyer}</p>
                </div>
                <span className="invoice-tenant">{invoice.tenant}</span>
                <span className="invoice-amount">{invoice.amount}</span>
                <span className={`status-pill ${invoice.statusTone}`}>
                  {invoice.status}
                </span>
                <span className={`status-pill ${invoice.pdpTone}`}>
                  {invoice.pdp}
                </span>
                <span className="invoice-updated">{invoice.updated}</span>
                <a className="link-btn" href={`/invoices/${invoice.id}`}>
                  View
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <article className="panel fade-up" style={{ animationDelay: "0.12s" }}>
            <h3>Queue health</h3>
            <p className="muted">
              92% accepted in the last 24h across all tenants.
            </p>
            <div className="meter">
              <span style={{ width: "92%" }} />
            </div>
            <div className="metric-list">
              {[
                { label: "Accepted", value: "3,712" },
                { label: "Pending", value: "318" },
                { label: "Rejected", value: "12" }
              ].map((metric) => (
                <div key={metric.label} className="metric-row">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel fade-up" style={{ animationDelay: "0.18s" }}>
            <h3>Top tenants</h3>
            <p className="muted">Volumes driving todays pipeline.</p>
            <div className="tenant-list">
              {[
                { label: "GHL Paris", value: "1,820 invoices" },
                { label: "GHL Lyon", value: "1,104 invoices" },
                { label: "GHL Nantes", value: "610 invoices" }
              ].map((tenant) => (
                <div key={tenant.label} className="tenant-row">
                  <span>{tenant.label}</span>
                  <span className="muted">{tenant.value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </PortalLayout>
  );
}
