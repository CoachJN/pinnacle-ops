import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractorQuoteForm } from "@/components/contractor-portal/contractor-quote-form";
import { ContractorShell } from "@/components/contractor-portal/contractor-shell";
import { getContractorWorkOrderDetailView } from "@/lib/contractors/projections";
import { canSubmitContractorQuote } from "@/lib/permissions/contractor-permissions";
import { getMockContractorCurrentUser } from "@/lib/permissions/contractor-session";
import { getWorkOrderById } from "@/lib/work-orders/repository";
import { USER_ROLES } from "@/types/permissions";

type Params = Promise<{ id?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContractorQuotePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!id || !id.trim()) {
    notFound();
  }

  const currentUser = await getMockContractorCurrentUser(
    readParam(query.contractorId),
  );
  if (!currentUser) {
    notFound();
  }

  const [projection, rawWorkOrder] = await Promise.all([
    getContractorWorkOrderDetailView(currentUser.contractorId, id),
    getWorkOrderById(id),
  ]);
  if (!projection || !rawWorkOrder) {
    notFound();
  }

  const canSubmit = canSubmitContractorQuote(
    USER_ROLES.ContractorUser,
    rawWorkOrder,
    currentUser,
  );

  return (
    <ContractorShell currentUser={currentUser}>
      <div className="mx-auto max-w-4xl">
        <Link href={`/contractor/work-orders/${projection.id}?contractorId=${currentUser.contractorId}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
          Back to work order
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            {projection.workOrderNumber}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Submit quote
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Provide the scope and amount for internal review.
          </p>
        </div>
        <div className="mt-6">
          {canSubmit ? (
            <ContractorQuoteForm workOrder={projection} contractorId={currentUser.contractorId} />
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              This work order is not currently eligible for contractor quote submission.
            </div>
          )}
        </div>
      </div>
    </ContractorShell>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
