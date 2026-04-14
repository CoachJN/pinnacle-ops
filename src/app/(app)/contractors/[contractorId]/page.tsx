import { ContractorDetailPage } from "@/components/contractors/contractor-detail-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

interface ContractorDetailRouteProps {
  params: Promise<{ contractorId: string }>;
}

export default async function ContractorDetailRoute({
  params,
}: ContractorDetailRouteProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { contractorId } = await params;

  return <ContractorDetailPage contractorId={contractorId} />;
}
