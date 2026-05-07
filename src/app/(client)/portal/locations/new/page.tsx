import { LocationEditorPage } from "@/components/locations/location-editor-page";
import { requireClientPortalContext } from "@/modules/clients/server/client-portal";

export default async function ClientPortalNewLocationPage() {
  const context = await requireClientPortalContext();

  return (
    <LocationEditorPage
      defaultClientOrganizationId={context.actor.scope.clientOrganizationId}
      mode="create"
      portalMode
    />
  );
}
