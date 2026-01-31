import { PortalLayout } from "@/components/portal-layout";

const CUSTOMERS = [
  { name: "ACME SAS", volume: "1,240 invoices", status: "Healthy" },
  { name: "Nova Retail", volume: "920 invoices", status: "Monitoring" },
  { name: "Lumen Group", volume: "610 invoices", status: "Attention" }
];

export default function CustomersPage() {
  return (
    <PortalLayout
      title="Customers"
      subtitle="Invoice compliance coverage per buyer."
      activeNav="Customers"
      actions={<button className="primary-btn">Add customer</button>}
    >
      <section className="content-grid">
        <article className="panel fade-up">
          <div className="panel-header">
            <div>
              <h3>Top buyers</h3>
              <p>Highest volume accounts.</p>
            </div>
            <button className="ghost-btn small">Export list</button>
          </div>
          <div className="customer-list">
            {CUSTOMERS.map((customer) => (
              <div key={customer.name} className="customer-row">
                <div>
                  <p className="customer-name">{customer.name}</p>
                  <p className="muted">{customer.volume}</p>
                </div>
                <span className="status-pill ok">{customer.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel fade-up" style={{ animationDelay: "0.12s" }}>
          <h3>Coverage snapshot</h3>
          <p className="muted">
            96% of buyers are sending valid SIRET and VAT identifiers.
          </p>
          <div className="meter">
            <span style={{ width: "96%" }} />
          </div>
          <div className="metric-list">
            {[
              { label: "Fully compliant", value: "418" },
              { label: "Needs update", value: "17" }
            ].map((metric) => (
              <div key={metric.label} className="metric-row">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PortalLayout>
  );
}
