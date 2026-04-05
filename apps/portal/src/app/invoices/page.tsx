"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal-layout";
import {
  apiFetch,
  getTenantId,
  displayStatus,
  statusTone,
  matchesFilter,
  relativeTime,
  type FilterCategory,
} from "@/lib/api";

interface Invoice {
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
  canonical_payload?: Record<string, unknown>;
}

interface InvoicesResponse {
  ok: boolean;
  invoices: Invoice[];
  nextCursor?: string;
}

const FILTERS: FilterCategory[] = ["All", "Accepted", "Pending", "Rejected"];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterCategory>("All");

  useEffect(() => {
    const tenantId = getTenantId();
    if (!tenantId) {
      setError("NO_TENANT");
      setLoading(false);
      return;
    }

    apiFetch<InvoicesResponse>("invoices")
      .then((data) => setInvoices(data.invoices ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (error === "NO_TENANT") {
    return (
      <PortalLayout title="Invoice Queue" activeNav="Invoices">
        <section className="panel fade-up" style={{ padding: "2rem", textAlign: "center" }}>
          <h3>Configure tenant</h3>
          <p className="muted">
            Set <code>crocotax_tenant_id</code> in localStorage to view invoices.
          </p>
        </section>
      </PortalLayout>
    );
  }

  const displayed = invoices.filter((inv) =>
    matchesFilter(displayStatus(inv.status), filter)
  );

  const accepted = invoices.filter((i) => ["Accepted", "Paid"].includes(displayStatus(i.status))).length;
  const pending = invoices.filter((i) => ["Pending", "Processing"].includes(displayStatus(i.status))).length;
  const rejected = invoices.filter((i) => ["Rejected", "Error"].includes(displayStatus(i.status))).length;
  const acceptPct = invoices.length > 0 ? Math.round((accepted / invoices.length) * 100) : 0;

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
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-pill ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
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

          {loading ? (
            <p style={{ padding: "2rem", textAlign: "center" }} className="muted">
              Loading invoices...
            </p>
          ) : error ? (
            <p style={{ padding: "2rem", textAlign: "center" }} className="muted">
              Failed to load invoices: {error}
            </p>
          ) : displayed.length === 0 ? (
            <p style={{ padding: "2rem", textAlign: "center" }} className="muted">
              No invoices found.
            </p>
          ) : (
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
              {displayed.map((invoice) => {
                const label = displayStatus(invoice.status);
                const tone = statusTone(label);
                const pdpLabel = invoice.latest_pdp_status ?? "—";
                const buyer =
                  (invoice.canonical_payload as Record<string, unknown>)
                    ?.buyer_name ??
                  invoice.ghl_invoice_id;
                const amount =
                  (invoice.canonical_payload as Record<string, unknown>)
                    ?.total_amount ?? "—";

                return (
                  <div key={invoice.id} className="invoice-row">
                    <div className="invoice-main">
                      <p className="invoice-id">{invoice.ghl_invoice_id ?? invoice.id}</p>
                      <p className="invoice-meta">{String(buyer)}</p>
                    </div>
                    <span className="invoice-tenant">{invoice.tenant_id}</span>
                    <span className="invoice-amount">{String(amount)}</span>
                    <span className={`status-pill ${tone}`}>{label}</span>
                    <span className={`status-pill pending`}>{pdpLabel}</span>
                    <span className="invoice-updated">
                      {relativeTime(invoice.updated_at)}
                    </span>
                    <a className="link-btn" href={`/invoices/${invoice.id}`}>
                      View
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="stack">
          <article className="panel fade-up" style={{ animationDelay: "0.12s" }}>
            <h3>Queue health</h3>
            <p className="muted">
              {acceptPct}% accepted across loaded invoices.
            </p>
            <div className="meter">
              <span style={{ width: `${acceptPct}%` }} />
            </div>
            <div className="metric-list">
              {[
                { label: "Accepted", value: String(accepted) },
                { label: "Pending", value: String(pending) },
                { label: "Rejected", value: String(rejected) },
              ].map((metric) => (
                <div key={metric.label} className="metric-row">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </PortalLayout>
  );
}
