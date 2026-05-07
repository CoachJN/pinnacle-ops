import Link from "next/link";
import { getClientPortalLandingSummary, listClientPortalWorkOrders } from "@/modules/clients/server/client-portal";

export default async function ClientPortalLandingPage() {
  const [summary, workOrders] = await Promise.all([
    getClientPortalLandingSummary(),
    listClientPortalWorkOrders(),
  ]);

  const activeWorkOrders = workOrders.slice(0, 5);

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">
          Welcome
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {summary.organizationName}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Review your service locations, keep up with open work orders, and respond
          to quotes without entering the internal operations workspace.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          description="Locations currently visible in your portal scope."
          href="/portal/locations"
          title="Locations"
          value={summary.locationCount}
        />
        <SummaryCard
          description="Open work orders your team can track."
          href="/portal/work-orders"
          title="Active work orders"
          value={summary.activeWorkOrderCount}
        />
        <SummaryCard
          description="Quotes currently waiting for your response."
          href="/portal/work-orders"
          title="Awaiting quote response"
          value={summary.quotesAwaitingResponseCount}
        />
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Recent work orders</h2>
            <p className="mt-2 text-sm text-slate-600">
              A quick view of the most recent requests in your client scope.
            </p>
          </div>
          <Link
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
            href="/portal/work-orders"
          >
            View all work orders
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {activeWorkOrders.length > 0 ? (
            activeWorkOrders.map((workOrder) => (
              <Link
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 md:flex-row md:items-center md:justify-between"
                href={`/portal/work-orders/${workOrder.id}`}
                key={workOrder.id}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {workOrder.workOrderNumber}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {workOrder.shortDescription}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>{workOrder.locationName}</span>
                  <span>{workOrder.lifecycleStatus}</span>
                  <span>{formatDate(workOrder.updatedAt)}</span>
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">
              No work orders are visible in your portal yet.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

function SummaryCard({
  description,
  href,
  title,
  value,
}: {
  description: string;
  href: string;
  title: string;
  value: number;
}) {
  return (
    <Link
      className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40"
      href={href}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </Link>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
