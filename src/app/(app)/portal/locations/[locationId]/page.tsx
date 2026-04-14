import { LocationDetailPage } from "@/components/locations/location-detail-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { APP_ROLES } from "@/lib/rbac/roles";

interface PortalLocationDetailPageProps {
  params: Promise<{
    locationId: string;
  }>;
}

export default async function PortalLocationDetailPage({
  params,
}: PortalLocationDetailPageProps) {
  await requireUserWithRole([APP_ROLES.ClientUser] as const);
  const { locationId } = await params;

  return <LocationDetailPage locationId={locationId} portalMode />;
}
