import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import type { Invoice } from "@/types/invoice";
import type { InternalUserRole } from "@/types/permissions";
import type { PhaseOneWorkOrder } from "@/types/work-order";
import { PriorityBadge, StatusBadge } from "./badges";
import { formatDate, formatDateTime } from "./formatting";
import { DerivedStatusIndicators } from "./derived-status-indicators";
import { getDisplayInvoiceStatus } from "@/lib/invoices/status";

export function InternalWorkOrderTable({
  workOrders,
  role,
  invoices = [],
}: {
  workOrders: PhaseOneWorkOrder[];
  role: InternalUserRole;
  invoices?: Invoice[];
}) {
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

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
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Quote</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {workOrders.map((workOrder) => {
              const currentInvoice = workOrder.currentInvoiceId
                ? invoiceById.get(workOrder.currentInvoiceId) ?? null
                : null;

              return (
                <tr key={workOrder.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      className="text-neutral-950 underline-offset-4 hover:underline"
                      href={`/work-orders/${workOrder.id}?role=${role}`}
                    >
                      {workOrder.workOrderNumber}
                    </Link>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-neutral-900">
                    <Link
                      className="line-clamp-2 underline-offset-4 hover:underline"
                      href={`/work-orders/${workOrder.id}?role=${role}`}
                    >
                      {workOrder.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    <Link href={`/clients/${workOrder.clientId}?role=${role}`} className="underline-offset-4 hover:underline">
                      {workOrder.clientName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    <Link href={`/locations/${workOrder.locationId}?role=${role}`} className="underline-offset-4 hover:underline">
                      {workOrder.locationName}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={workOrder.priority} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <StatusBadge status={workOrder.status} />
                      <DerivedStatusIndicators
                        workOrder={workOrder}
                        currentInvoice={currentInvoice}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {workOrder.requiresQuote ? "Required" : "Not required"}
                  </td>
                  <td className="px-4 py-3">
                    {currentInvoice ? (
                      <InvoiceStatusBadge
                        status={getDisplayInvoiceStatus(
                          currentInvoice.status,
                          currentInvoice.dueDate,
                        )}
                      />
                    ) : (
                      <span className="text-neutral-500">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{formatDate(workOrder.requestedServiceDate)}</td>
                  <td className="px-4 py-3 text-neutral-700">{formatDateTime(workOrder.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
