import { ReactNode } from "react";

const NAV_ITEMS = [
  "Dashboard",
  "Invoices",
  "Alerts",
  "Customers",
  "Settings"
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

interface PortalLayoutProps {
  title: string;
  subtitle?: string;
  activeNav: NavItem;
  actions?: ReactNode;
  children: ReactNode;
}

export function PortalLayout({
  title,
  subtitle,
  activeNav,
  actions,
  children
}: PortalLayoutProps) {
  return (
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand-block">
          <div className="brand-mark">CT</div>
          <div>
            <p className="brand-title">CrocoTax</p>
            <p className="brand-sub">Invoice Command</p>
          </div>
        </div>
        <nav className="nav-stack">
          {NAV_ITEMS.map((label) => (
            <a
              key={label}
              className={`nav-link ${label === activeNav ? "active" : ""}`}
              href={label === "Dashboard" ? "/" : `/${label.toLowerCase()}`}
            >
              <span>{label}</span>
              {label === "Alerts" ? (
                <span className="nav-count">3</span>
              ) : null}
            </a>
          ))}
        </nav>
        <div className="side-footer">
          <div className="tenant-card">
            <p className="tenant-label">Active tenant</p>
            <p className="tenant-name">GHL Paris Region</p>
            <p className="tenant-meta">60k invoices / month</p>
          </div>
        </div>
      </aside>

      <main className="main-surface">
        <header className="top-bar">
          <div>
            <p className="eyebrow">{subtitle ?? "Invoice Operations"}</p>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">{actions}</div>
        </header>

        <div className="page-body">{children}</div>
      </main>
    </div>
  );
}
