import { ClientOrganizationEditorPage } from "@/components/client-organizations/client-organization-editor-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

interface EditClientOrganizationRouteProps {
  params: Promise<{
    clientOrganizationId: string;
  }>;
}

export default async function EditClientOrganizationRoute({
  params,
}: EditClientOrganizationRouteProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { clientOrganizationId } = await params;

  return (
    <ClientOrganizationEditorPage
      clientOrganizationId={clientOrganizationId}
      mode="edit"
    />
  );
}
