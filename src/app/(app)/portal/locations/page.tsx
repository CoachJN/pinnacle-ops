import { LocationListPage } from "@/components/locations/location-list-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { APP_ROLES } from "@/lib/rbac/roles";

export default async function PortalLocationsPage() {
  await requireUserWithRole([APP_ROLES.ClientUser] as const);

  return <LocationListPage portalMode />;
}
