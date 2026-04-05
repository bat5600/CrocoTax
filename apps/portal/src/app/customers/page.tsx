import { PortalLayout } from "@/components/portal-layout";

export default function CustomersPage() {
  return (
    <PortalLayout
      title="Customers"
      subtitle="Invoice compliance coverage per buyer."
      activeNav="Customers"
    >
      <section className="panel fade-up" style={{ padding: "3rem", textAlign: "center" }}>
        <h3>Coming soon</h3>
        <p className="muted">
          Customer management will be available once the customers API endpoint is implemented.
          This page will show buyer compliance status, SIRET validation, and invoice volume per customer.
        </p>
      </section>
    </PortalLayout>
  );
}
