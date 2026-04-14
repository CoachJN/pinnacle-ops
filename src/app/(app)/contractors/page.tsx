import { ContractorListPage } from "@/components/contractors/contractor-list-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

export default async function ContractorsPage() {
  await requireUserWithRole(INTERNAL_APP_ROLES);

  return <ContractorListPage />;
}
