import { ClientOrganizationEditorPage } from "@/components/client-organizations/client-organization-editor-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

export default async function NewClientOrganizationPage() {
  await requireUserWithRole(INTERNAL_APP_ROLES);

  return <ClientOrganizationEditorPage mode="create" />;
}
