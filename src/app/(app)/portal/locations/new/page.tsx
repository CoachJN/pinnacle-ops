import { LocationEditorPage } from "@/components/locations/location-editor-page";
import { getBusinessEntityApiContext } from "@/server/api/business-entities";
import { APP_ROLES } from "@/lib/rbac/roles";
import { requireUserWithRole } from "@/lib/auth/guards";

export default async function PortalNewLocationPage() {
  await requireUserWithRole([APP_ROLES.ClientUser] as const);
  const context = await getBusinessEntityApiContext();

  if (context.actor.actorType !== "client") {
    throw new Error("Portal location creation requires a client-scoped actor.");
  }

  return (
    <LocationEditorPage
      defaultClientOrganizationId={context.actor.scope.clientOrganizationId}
      mode="create"
      portalMode
    />
  );
}
