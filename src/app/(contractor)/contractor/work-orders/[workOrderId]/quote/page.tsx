import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractorQuoteForm } from "@/components/contractor-portal/contractor-quote-form";
import { getContractorPortalWorkOrder } from "@/modules/contractors/server/contractor-portal";

type Params = Promise<{ workOrderId?: string }>;

export default async function ContractorQuotePage({
  params,
}: {
  params: Params;
}) {
  const { workOrderId } = await params;
  if (!workOrderId || !workOrderId.trim()) {
    notFound();
  }

  const projection = await getContractorPortalWorkOrder(workOrderId);
  if (!projection) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/contractor/work-orders/${projection.id}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
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
        {projection.actionAvailability.canSubmitQuote ? (
          <ContractorQuoteForm workOrder={projection} />
        ) : (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            This work order is not currently eligible for contractor quote submission.
          </div>
        )}
      </div>
    </div>
  );
}
