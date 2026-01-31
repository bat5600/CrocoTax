export default function LoginPage() {
  return (
    <div className="login-shell">
      <div className="login-card fade-up">
        <div className="login-header">
          <span className="brand-mark">CT</span>
          <div>
            <h1>CrocoTax Portal</h1>
            <p className="muted">
              Sign in to monitor invoice compliance and PDP delivery.
            </p>
          </div>
        </div>

        <form className="login-form">
          <label className="field">
            <span>Email</span>
            <input type="email" placeholder="ops@croco.tax" />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" placeholder="••••••••" />
          </label>
          <label className="field">
            <span>Tenant token</span>
            <input type="text" placeholder="ct_live_..." />
          </label>
          <button className="primary-btn" type="submit">
            Sign in
          </button>
        </form>

        <div className="login-foot">
          <span className="muted">Need access?</span>
          <button className="ghost-btn small">Request onboarding</button>
        </div>
      </div>

      <div className="login-aside">
        <div className="aside-card fade-up" style={{ animationDelay: "0.12s" }}>
          <h2>Live PDP visibility</h2>
          <p className="muted">
            Track submissions, receipts, and audit trails across all tenants.
          </p>
          <div className="aside-metrics">
            {[
              { label: "Invoices today", value: "3,812" },
              { label: "Accepted", value: "3,712" },
              { label: "Exceptions", value: "12" }
            ].map((item) => (
              <div key={item.label} className="aside-metric">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="aside-card fade-up" style={{ animationDelay: "0.18s" }}>
          <h3>Compliance checklist</h3>
          <ul className="checklist">
            <li>Factur-X EN 16931</li>
            <li>PDF/A-3 validation</li>
            <li>PDP transmission logs</li>
            <li>Audit exports ready</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
