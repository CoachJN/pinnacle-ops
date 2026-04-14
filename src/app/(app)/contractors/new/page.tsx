import { ContractorEditorPage } from "@/components/contractors/contractor-editor-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

export default async function NewContractorRoute() {
  await requireUserWithRole(INTERNAL_APP_ROLES);

  return <ContractorEditorPage mode="create" />;
}
