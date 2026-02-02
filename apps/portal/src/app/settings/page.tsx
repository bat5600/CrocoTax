import { PortalLayout } from "@/components/portal-layout";
import { SettingsClient } from "./settings-client";

type SettingsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  const locationId =
    (typeof searchParams?.location_id === "string" && searchParams.location_id) ||
    (typeof searchParams?.locationId === "string" && searchParams.locationId) ||
    undefined;

  return (
    <PortalLayout
      title="Settings"
      subtitle="Configure integrations per tenant."
      activeNav="Settings"
    >
      <SettingsClient locationId={locationId} />
    </PortalLayout>
  );
}
