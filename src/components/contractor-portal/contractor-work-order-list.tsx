import Link from "next/link";
import type { ContractorPortalWorkOrderListItem } from "@/modules/work-orders/contractor-portal";
import { formatDate, formatDateTime } from "@/components/work-orders/formatting";

export function ContractorWorkOrderList({
  items,
}: {
  items: ContractorPortalWorkOrderListItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
        No assigned work orders in this queue.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
            <tr>
              <th className="px-4 py-3">Work order</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3">Work order</th>
              <th className="px-4 py-3">Quote</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-semibold">
                  <Link className="underline-offset-4 hover:underline" href={`/contractor/work-orders/${item.id}`}>
                    {item.workOrderNumber}
                  </Link>
                </td>
                <td className="max-w-xs px-4 py-3 text-neutral-900">
                  <Link className="line-clamp-2 underline-offset-4 hover:underline" href={`/contractor/work-orders/${item.id}`}>
                    {item.title}
                  </Link>
                  {item.quoteActionNeeded ? (
                    <span className="mt-1 block text-xs font-semibold text-amber-700">
                      Quote needed
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-neutral-700">{item.clientName}</td>
                <td className="px-4 py-3 text-neutral-700">
                  <span className="block font-medium">{item.locationName}</span>
                  <span className="block text-xs text-neutral-500">{item.serviceAddress}</span>
                </td>
                <td className="px-4 py-3 text-neutral-700">{item.assignment.status}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {formatStatusLabel(item.lifecycleStatus)}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-700">{item.quoteStatus ?? "None"}</td>
                <td className="px-4 py-3 text-neutral-700">{formatDate(item.requestedServiceDate)}</td>
                <td className="px-4 py-3 text-neutral-700">{formatDateTime(item.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatStatusLabel(value: string): string {
  return value.replaceAll("_", " ");
}
