import { ContractorEditorPage } from "@/components/contractors/contractor-editor-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

interface EditContractorRouteProps {
  params: Promise<{ contractorId: string }>;
}

export default async function EditContractorRoute({
  params,
}: EditContractorRouteProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { contractorId } = await params;

  return <ContractorEditorPage contractorId={contractorId} mode="edit" />;
}
