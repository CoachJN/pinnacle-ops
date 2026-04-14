import { LocationListPage } from "@/components/locations/location-list-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

export default async function LocationsPage() {
  await requireUserWithRole(INTERNAL_APP_ROLES);

  return <LocationListPage />;
}
