import Link from "next/link";
import { listClientPortalLocations, listClientPortalWorkOrders } from "@/modules/clients/server/client-portal";
import type { WorkOrderStatus } from "@/types/work-order";

interface ClientPortalWorkOrdersPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    locationId?: string;
  }>;
}

export default async function ClientPortalWorkOrdersPage({
  searchParams,
}: ClientPortalWorkOrdersPageProps) {
  const filters = await searchParams;
  const [locations, workOrders] = await Promise.all([
    listClientPortalLocations(),
    listClientPortalWorkOrders({
      search: filters.search,
      status: filters.status as WorkOrderStatus | undefined,
      locationId: filters.locationId,
    }),
  ]);

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Work Orders
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Your work orders
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Track request progress, review client-safe details, and move into quote
          response when approval is required.
        </p>
      </section>

      <form className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_14rem_16rem_auto]">
        <label className="text-sm font-medium text-slate-700">
          Search
          <input
            className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500"
            defaultValue={filters.search ?? ""}
            name="search"
            placeholder="Search by work order number, summary, or location"
            type="search"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500"
            defaultValue={filters.status ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="in_review">In review</option>
            <option value="quote_requested">Quote requested</option>
            <option value="pending_client_approval">Pending approval</option>
            <option value="approved_to_proceed">Approved to proceed</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Location
          <select
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500"
            defaultValue={filters.locationId ?? ""}
            name="locationId"
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button
            className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            type="submit"
          >
            Apply
          </button>
          <Link
            className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
            href="/portal/work-orders"
          >
            Reset
          </Link>
        </div>
      </form>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        {workOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Work order</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Quote</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {workOrders.map((workOrder) => (
                  <tr key={workOrder.id}>
                    <td className="px-4 py-4">
                      <Link
                        className="font-semibold text-slate-950 underline-offset-4 hover:underline"
                        href={`/portal/work-orders/${workOrder.id}`}
                      >
                        {workOrder.workOrderNumber}
                      </Link>
                      <p className="mt-1 text-slate-600">
                        {workOrder.shortDescription}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{workOrder.locationName}</td>
                    <td className="px-4 py-4 text-slate-600">{workOrder.lifecycleStatus}</td>
                    <td className="px-4 py-4 text-slate-600">{workOrder.priority}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {workOrder.currentQuoteStatus ?? "No active quote"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(workOrder.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-600">
            No work orders match your current filters.
          </div>
        )}
      </section>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));
}
