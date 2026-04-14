import { ClientOrganizationListPage } from "@/components/client-organizations/client-organization-list-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

export default async function ClientOrganizationsPage() {
  await requireUserWithRole(INTERNAL_APP_ROLES);

  return <ClientOrganizationListPage />;
}
