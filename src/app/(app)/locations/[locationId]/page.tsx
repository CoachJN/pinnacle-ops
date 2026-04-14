import { LocationDetailPage } from "@/components/locations/location-detail-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

interface LocationDetailRouteProps {
  params: Promise<{
    locationId: string;
  }>;
}

export default async function LocationDetailRoute({
  params,
}: LocationDetailRouteProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { locationId } = await params;

  return <LocationDetailPage locationId={locationId} />;
}
