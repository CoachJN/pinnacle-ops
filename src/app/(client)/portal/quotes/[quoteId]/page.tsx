import Link from "next/link";
import { getClientPortalQuote } from "@/modules/clients/server/client-portal";

interface ClientPortalQuoteDetailPageProps {
  params: Promise<{ quoteId: string }>;
}

export default async function ClientPortalQuoteDetailPage({
  params,
}: ClientPortalQuoteDetailPageProps) {
  const { quoteId } = await params;
  const quote = await getClientPortalQuote(quoteId);
  const canRespond = quote.status === "sent";

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
        href={`/portal/work-orders/${quote.workOrderId}`}
      >
        Back to work order
      </Link>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Quote
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {quote.workOrderNumber}
            </h1>
            <p className="mt-2 text-sm text-slate-600">Status: {quote.status}</p>
          </div>
          {canRespond ? (
            <Link
              className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              href={`/portal/quotes/${quote.id}/respond`}
            >
              Respond to quote
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Quoted work</h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit price</th>
                  <th className="px-4 py-3">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {quote.lineItems.map((lineItem, index) => (
                  <tr key={`${lineItem.description}-${index}`}>
                    <td className="px-4 py-4 text-slate-700">{lineItem.description}</td>
                    <td className="px-4 py-4 text-slate-700">{lineItem.quantity}</td>
                    <td className="px-4 py-4 text-slate-700">{formatCurrency(lineItem.unitPrice)}</td>
                    <td className="px-4 py-4 text-slate-950">{formatCurrency(lineItem.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">Notes</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {quote.notes ?? "No additional notes were provided with this quote."}
            </p>
          </div>
        </section>

        <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Totals</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-4">
              <dt>Subtotal</dt>
              <dd className="font-medium text-slate-950">{formatCurrency(quote.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Tax</dt>
              <dd className="font-medium text-slate-950">{formatCurrency(quote.taxAmount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
              <dt className="font-semibold text-slate-950">Total</dt>
              <dd className="text-base font-semibold text-slate-950">
                {formatCurrency(quote.totalAmount)}
              </dd>
            </div>
          </dl>

          <dl className="mt-6 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-4">
              <dt>Sent</dt>
              <dd className="font-medium text-slate-950">{formatDate(quote.sentAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Responded</dt>
              <dd className="font-medium text-slate-950">{formatDate(quote.respondedAt)}</dd>
            </div>
          </dl>

          {quote.rejectionReason ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">Rejection reason</p>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                {quote.rejectionReason}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
