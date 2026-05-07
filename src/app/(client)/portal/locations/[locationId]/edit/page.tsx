import { LocationEditorPage } from "@/components/locations/location-editor-page";
import { requireClientPortalContext } from "@/modules/clients/server/client-portal";

interface ClientPortalEditLocationPageProps {
  params: Promise<{ locationId: string }>;
}

export default async function ClientPortalEditLocationPage({
  params,
}: ClientPortalEditLocationPageProps) {
  const { locationId } = await params;
  const context = await requireClientPortalContext();

  return (
    <LocationEditorPage
      defaultClientOrganizationId={context.actor.scope.clientOrganizationId}
      locationId={locationId}
      mode="edit"
      portalMode
    />
  );
}
