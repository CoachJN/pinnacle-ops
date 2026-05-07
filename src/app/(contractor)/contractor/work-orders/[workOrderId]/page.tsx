import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractorActionPanel } from "@/components/contractor-portal/contractor-action-panel";
import { PriorityBadge } from "@/components/work-orders/badges";
import { DetailField, DetailSection } from "@/components/work-orders/detail-section";
import { formatDate, formatDateTime } from "@/components/work-orders/formatting";
import { formatCurrency } from "@/lib/quotes/money";
import { getContractorPortalWorkOrder } from "@/modules/contractors/server/contractor-portal";

type Params = Promise<{ workOrderId?: string }>;

export default async function ContractorWorkOrderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { workOrderId } = await params;
  if (!workOrderId || !workOrderId.trim()) {
    notFound();
  }

  const workOrder = await getContractorPortalWorkOrder(workOrderId);
  if (!workOrder) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/contractor/work-orders" className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
        Back to assigned work
      </Link>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-500">
              {workOrder.workOrderNumber}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              {workOrder.title}
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Updated {formatDateTime(workOrder.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
              {formatStatusLabel(workOrder.lifecycleStatus)}
            </span>
            <PriorityBadge priority={workOrder.priority} />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <DetailSection title="Job details">
              <DetailField label="Description" value={workOrder.description} fullWidth />
              <DetailField label="Category" value={workOrder.category} />
              <DetailField label="Requested service date" value={formatDate(workOrder.requestedServiceDate)} />
            </DetailSection>
            <DetailSection title="Service location">
              <DetailField label="Client" value={workOrder.clientName} />
              <DetailField label="Location" value={workOrder.locationName} />
              <DetailField label="Service address" value={workOrder.serviceAddress} fullWidth />
              <DetailField label="Location contact" value={workOrder.locationContactName} />
              <DetailField label="Contact phone" value={workOrder.locationContactPhone} />
              <DetailField label="Contact email" value={workOrder.locationContactEmail} />
              <DetailField label="Access notes" value={workOrder.accessNotes} fullWidth />
            </DetailSection>
          </div>

          {workOrder.quote ? (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="text-base font-semibold text-neutral-950">
                Contractor quote
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <DetailField label="Quote status" value={workOrder.quote.status} />
                <DetailField label="Submitted" value={formatDateTime(workOrder.quote.submittedAt)} />
                <DetailField label="Reviewed" value={formatDateTime(workOrder.quote.reviewedAt)} />
                <DetailField label="Subtotal" value={formatCurrency(workOrder.quote.subtotal)} />
                <DetailField label="Tax" value={formatCurrency(workOrder.quote.taxAmount)} />
                <DetailField label="Total" value={formatCurrency(workOrder.quote.totalAmount)} />
                <DetailField label="Contractor notes" value={workOrder.quote.notes} fullWidth />
                <div className="md:col-span-3">
                  <h3 className="text-sm font-semibold text-neutral-950">Line items</h3>
                  <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                      <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
                        <tr>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3">Qty</th>
                          <th className="px-4 py-3">Unit</th>
                          <th className="px-4 py-3">Line total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 bg-white">
                        {workOrder.quote.lineItems.map((lineItem, index) => (
                          <tr key={`${lineItem.description}-${index}`}>
                            <td className="px-4 py-3 text-neutral-900">{lineItem.description}</td>
                            <td className="px-4 py-3 text-neutral-700">{lineItem.quantity}</td>
                            <td className="px-4 py-3 text-neutral-700">
                              {formatCurrency(lineItem.unitPrice)}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {formatCurrency(lineItem.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-950">
              Communications
            </h2>
            <div className="mt-4 space-y-3">
              {workOrder.communications.length > 0 ? (
                workOrder.communications.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm font-medium text-neutral-950">{entry.body}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatDateTime(entry.createdAt)} by {entry.actor.displayName ?? "System"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-600">
                  No contractor-visible communications yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-950">
              Contractor-visible timeline
            </h2>
            <div className="mt-4 space-y-3">
              {workOrder.visibleActivity.length > 0 ? (
                workOrder.visibleActivity.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm font-medium text-neutral-950">{entry.message}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatDateTime(entry.createdAt)} by {entry.actorLabel}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-600">
                  No contractor-visible activity yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <ContractorActionPanel workOrder={workOrder} />
      </div>
    </div>
  );
}

function formatStatusLabel(value: string): string {
  return value.replaceAll("_", " ");
}
