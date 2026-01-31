import { PortalLayout } from "@/components/portal-layout";

const SETTINGS = [
  {
    title: "Webhook retries",
    description: "Auto-retry failed PDP submissions up to 3 times."
  },
  {
    title: "Daily audit export",
    description: "Send a CSV summary to the ops inbox every day."
  },
  {
    title: "Exception routing",
    description: "Notify tenant admins for high-risk failures."
  }
];

export default function SettingsPage() {
  return (
    <PortalLayout
      title="Settings"
      subtitle="Configure portal behavior per tenant."
      activeNav="Settings"
      actions={<button className="primary-btn">Save changes</button>}
    >
      <section className="panel fade-up">
        <div className="panel-header">
          <div>
            <h3>Automation</h3>
            <p>Controls for workflows and notifications.</p>
          </div>
          <button className="ghost-btn small">Reset</button>
        </div>
        <div className="settings-list">
          {SETTINGS.map((setting) => (
            <div key={setting.title} className="settings-row">
              <div>
                <p className="settings-title">{setting.title}</p>
                <p className="muted">{setting.description}</p>
              </div>
              <button className="toggle-btn">Enabled</button>
            </div>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <article className="panel fade-up" style={{ animationDelay: "0.12s" }}>
          <h3>Security</h3>
          <p className="muted">
            API tokens rotate every 90 days. Next rotation: 2026-02-10.
          </p>
          <div className="key-values">
            {[
              { label: "Portal role", value: "Owner" },
              { label: "PDP endpoint", value: "Production" }
            ].map((row) => (
              <div key={row.label} className="key-value">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel fade-up" style={{ animationDelay: "0.18s" }}>
          <h3>Tenant tokens</h3>
          <p className="muted">Active tokens: 3</p>
          <div className="token-list">
            {[
              "ct_live_paris_20x",
              "ct_live_lyon_13b",
              "ct_live_nantes_08w"
            ].map((token) => (
              <div key={token} className="token-row">
                <span>{token}</span>
                <button className="ghost-btn small">Rotate</button>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PortalLayout>
  );
}
