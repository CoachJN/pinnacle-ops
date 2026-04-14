import { LocationEditorPage } from "@/components/locations/location-editor-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { APP_ROLES } from "@/lib/rbac/roles";

interface PortalEditLocationPageProps {
  params: Promise<{
    locationId: string;
  }>;
}

export default async function PortalEditLocationPage({
  params,
}: PortalEditLocationPageProps) {
  await requireUserWithRole([APP_ROLES.ClientUser] as const);
  const { locationId } = await params;

  return <LocationEditorPage locationId={locationId} mode="edit" portalMode />;
}
