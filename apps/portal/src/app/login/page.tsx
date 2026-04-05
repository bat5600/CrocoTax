"use client";

import { useState } from "react";

export default function LoginPage() {
  const [tenantId, setTenantId] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId.trim()) {
      setError("Tenant ID is required.");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("crocotax_tenant_id", tenantId.trim());
      if (token.trim()) {
        localStorage.setItem("crocotax_api_token", token.trim());
      }
      window.location.href = "/";
    }
  }

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

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Tenant ID</span>
            <input
              type="text"
              placeholder="uuid or GHL location ID"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          </label>
          <label className="field">
            <span>API Token (optional)</span>
            <input
              type="password"
              placeholder="ct_live_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          {error && <p style={{ color: "var(--red, #ef4444)" }}>{error}</p>}
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
              { label: "Factur-X compliant", value: "EN 16931" },
              { label: "PDP integration", value: "SUPER PDP" },
              { label: "Audit trail", value: "SHA-256" }
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
