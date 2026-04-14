import { ClientOrganizationDetailPage } from "@/components/client-organizations/client-organization-detail-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

interface ClientOrganizationDetailRouteProps {
  params: Promise<{
    clientOrganizationId: string;
  }>;
}

export default async function ClientOrganizationDetailRoute({
  params,
}: ClientOrganizationDetailRouteProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { clientOrganizationId } = await params;

  return (
    <ClientOrganizationDetailPage
      clientOrganizationId={clientOrganizationId}
    />
  );
}
