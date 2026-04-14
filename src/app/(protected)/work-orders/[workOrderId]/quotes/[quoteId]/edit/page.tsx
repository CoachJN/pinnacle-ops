import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteForm } from "@/components/quotes/quote-form";
import { InternalShell } from "@/components/internal/internal-shell";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { canEditQuote } from "@/lib/permissions/quote-permissions";
import { getQuoteById } from "@/lib/quotes/repository";
import { getWorkOrderById } from "@/lib/work-orders/repository";

type Params = Promise<{ workOrderId?: string; quoteId?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EditQuotePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ workOrderId, quoteId }, query] = await Promise.all([params, searchParams]);
  if (!workOrderId?.trim() || !quoteId?.trim()) {
    notFound();
  }

  const currentUser = getMockCurrentUser(readParam(query.role));
  const [workOrder, quote] = await Promise.all([
    getWorkOrderById(workOrderId),
    getQuoteById(workOrderId, quoteId),
  ]);
  if (!workOrder || !quote) {
    notFound();
  }

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/work-orders/${workOrder.id}?role=${currentUser.role}`}
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        >
          Back to work order
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            {workOrder.workOrderNumber} quote v{quote.versionNumber}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Edit quote draft
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Draft quote edits stay internal until the quote is submitted for review.
          </p>
        </div>
        <div className="mt-6">
          {canEditQuote(currentUser.role, workOrder, quote) ? (
            <QuoteForm
              mode="edit"
              role={currentUser.role}
              workOrder={workOrder}
              quote={quote}
            />
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              This quote is not editable for your role or current quote state.
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
