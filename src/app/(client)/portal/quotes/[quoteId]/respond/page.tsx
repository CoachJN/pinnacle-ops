import Link from "next/link";
import { QuoteResponseForm } from "@/components/client-portal/quote-response-form";
import { getClientPortalQuote } from "@/modules/clients/server/client-portal";

interface ClientPortalQuoteRespondPageProps {
  params: Promise<{ quoteId: string }>;
}

export default async function ClientPortalQuoteRespondPage({
  params,
}: ClientPortalQuoteRespondPageProps) {
  const { quoteId } = await params;
  const quote = await getClientPortalQuote(quoteId);

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
        href={`/portal/quotes/${quote.id}`}
      >
        Back to quote
      </Link>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Quote response
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {quote.workOrderNumber}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Approve the quote to allow work to proceed, or reject it with a reason
          so the operations team can revise and resubmit.
        </p>
      </section>

      <QuoteResponseForm quoteId={quote.id} workOrderId={quote.workOrderId} />
    </section>
  );
}
