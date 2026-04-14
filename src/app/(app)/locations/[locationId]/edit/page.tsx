import { LocationEditorPage } from "@/components/locations/location-editor-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

interface EditLocationPageProps {
  params: Promise<{
    locationId: string;
  }>;
}

export default async function EditLocationPage({
  params,
}: EditLocationPageProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { locationId } = await params;

  return <LocationEditorPage locationId={locationId} mode="edit" />;
}
