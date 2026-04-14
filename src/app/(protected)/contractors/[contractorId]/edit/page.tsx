import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractorForm } from "@/components/contractors/contractor-form";
import { InternalShell } from "@/components/internal/internal-shell";
import { getContractorById } from "@/lib/contractors/repository";
import { canEditContractor } from "@/lib/permissions/contractor-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";

type Params = Promise<{ contractorId?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EditContractorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ contractorId }, query] = await Promise.all([params, searchParams]);
  if (!contractorId || !contractorId.trim()) {
    notFound();
  }

  const currentUser = getMockCurrentUser(readParam(query.role));
  const contractor = await getContractorById(contractorId);
  if (!contractor) {
    notFound();
  }

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-4xl">
        <Link href={`/contractors/${contractor.id}?role=${currentUser.role}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
          Back to contractor
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            Contractor setup
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Edit contractor
          </h1>
        </div>
        <div className="mt-6">
          {canEditContractor(currentUser.role, contractor) ? (
            <ContractorForm mode="edit" role={currentUser.role} contractor={contractor} />
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              Your current mock role cannot edit contractors.
            </div>
          )}
        </div>
      </div>
    </InternalShell>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
