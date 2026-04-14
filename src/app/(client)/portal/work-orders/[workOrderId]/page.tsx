import Link from "next/link";
import { getClientPortalWorkOrder } from "@/modules/clients/server/client-portal";

interface ClientPortalWorkOrderDetailPageProps {
  params: Promise<{ workOrderId: string }>;
}

export default async function ClientPortalWorkOrderDetailPage({
  params,
}: ClientPortalWorkOrderDetailPageProps) {
  const { workOrderId } = await params;
  const workOrder = await getClientPortalWorkOrder(workOrderId);

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
        href="/portal/work-orders"
      >
        Back to work orders
      </Link>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Work order
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {workOrder.workOrderNumber}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{workOrder.title}</p>
          </div>
          {workOrder.currentQuoteId ? (
            <Link
              className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              href={`/portal/quotes/${workOrder.currentQuoteId}`}
            >
              View quote
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <section className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Request summary</h2>
            <p className="mt-4 text-sm leading-7 text-slate-700">{workOrder.description}</p>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Service location</h2>
            <p className="mt-4 text-sm font-semibold text-slate-950">{workOrder.locationName}</p>
            <p className="mt-2 text-sm text-slate-600">
              {workOrder.locationAddress ?? "Address details are not available in the portal."}
            </p>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Status</h2>
            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-4">
                <dt>Current status</dt>
                <dd className="font-medium text-slate-950">{workOrder.status}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Priority</dt>
                <dd className="font-medium text-slate-950">{workOrder.priority}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Created</dt>
                <dd className="font-medium text-slate-950">{formatDate(workOrder.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Updated</dt>
                <dd className="font-medium text-slate-950">{formatDate(workOrder.updatedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Quote summary</h2>
            {workOrder.activeQuote ? (
              <>
                <p className="mt-4 text-sm text-slate-600">
                  Quote status:{" "}
                  <span className="font-semibold text-slate-950">
                    {workOrder.activeQuote.status}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Total amount:{" "}
                  <span className="font-semibold text-slate-950">
                    {formatCurrency(workOrder.activeQuote.totalAmount)}
                  </span>
                </p>
                <div className="mt-4">
                  <Link
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
                    href={`/portal/quotes/${workOrder.activeQuote.id}`}
                  >
                    Review quote
                  </Link>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                No client quote is currently active for this work order.
              </p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);
}
