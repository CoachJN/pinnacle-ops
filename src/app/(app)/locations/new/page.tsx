import { LocationEditorPage } from "@/components/locations/location-editor-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

interface NewLocationPageProps {
  searchParams: Promise<{
    clientOrganizationId?: string;
  }>;
}

export default async function NewLocationPage({
  searchParams,
}: NewLocationPageProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { clientOrganizationId } = await searchParams;

  return (
    <LocationEditorPage
      defaultClientOrganizationId={clientOrganizationId}
      mode="create"
    />
  );
}
