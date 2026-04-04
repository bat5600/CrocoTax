import { PortalLayout } from "@/components/portal-layout";

export default function AlertsPage() {
  return (
    <PortalLayout
      title="Alerts Center"
      subtitle="Issues that need immediate attention."
      activeNav="Alerts"
    >
      <section className="panel fade-up" style={{ padding: "3rem", textAlign: "center" }}>
        <h3>Coming soon</h3>
        <p className="muted">
          The alerts feed will display real-time PDP rejections, timeouts, and validation
          errors once the alerts API endpoint is available.
        </p>
      </section>
    </PortalLayout>
  );
}
