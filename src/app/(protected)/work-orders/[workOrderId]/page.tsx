import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/work-orders/activity-timeline";
import { ContractorAssignmentForm } from "@/components/contractors/contractor-assignment-form";
import { PriorityBadge, StatusBadge } from "@/components/work-orders/badges";
import { DetailField, DetailSection } from "@/components/work-orders/detail-section";
import { formatDate, formatDateTime } from "@/components/work-orders/formatting";
import { QuoteSection } from "@/components/work-orders/quote-section";
import { InvoiceSection } from "@/components/work-orders/invoice-section";
import { StatusTransitionPanel } from "@/components/work-orders/status-transition-panel";
import { DerivedStatusIndicators } from "@/components/work-orders/derived-status-indicators";
import { InternalShell } from "@/components/internal/internal-shell";
import { listActiveContractors } from "@/lib/contractors/repository";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import {
  canEditWorkOrder,
  canViewWorkOrders,
  getRoleAllowedTransitions,
} from "@/lib/permissions/work-order-permissions";
import {
  getActivityForWorkOrder,
  getWorkOrderById,
} from "@/lib/work-orders/repository";
import {
  getCurrentQuoteForWorkOrder,
  listQuotesForWorkOrder,
} from "@/lib/quotes/repository";
import {
  getCurrentInvoiceForWorkOrder,
  listInvoicesForWorkOrder,
} from "@/lib/invoices/repository";

type Params = Promise<{ workOrderId?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ workOrderId }, query] = await Promise.all([params, searchParams]);
  if (!workOrderId || !workOrderId.trim()) {
    notFound();
  }

  const currentUser = getMockCurrentUser(readParam(query.role));
  if (!canViewWorkOrders(currentUser.role)) {
    return (
      <InternalShell currentUser={currentUser}>
        <section className="mx-auto mt-6 max-w-5xl rounded-lg border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-rose-800">
            Unauthorized
          </h1>
          <p className="mt-2 text-sm text-rose-700">
            Your current mock role cannot view this work order.
          </p>
          <Link
            href={`/work-orders?role=${currentUser.role}`}
            className="mt-4 inline-flex rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-500"
          >
            Back to work orders
          </Link>
        </section>
      </InternalShell>
    );
  }

  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder) {
    notFound();
  }

  const [activity, activeContractors, quotes, currentQuote, invoices, currentInvoice] =
    await Promise.all([
      getActivityForWorkOrder(workOrder.id),
      listActiveContractors(),
      listQuotesForWorkOrder(workOrder.id),
      getCurrentQuoteForWorkOrder(workOrder.id),
      listInvoicesForWorkOrder(workOrder.id),
      getCurrentInvoiceForWorkOrder(workOrder.id),
    ]);
  const allowedTransitions = getRoleAllowedTransitions(
    currentUser.role,
    workOrder,
    {
      currentQuoteStatus: currentQuote?.status ?? null,
      currentInvoice,
    },
  );
  const operationalTransitions = allowedTransitions.filter(
    (status) => status !== "invoiced" && status !== "paid" && status !== "closed",
  );
  const editable = canEditWorkOrder(currentUser.role, workOrder);

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/work-orders?role=${currentUser.role}`}
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        >
          Back to work orders
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
              <StatusBadge status={workOrder.status} />
              <PriorityBadge priority={workOrder.priority} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {editable ? (
              <Link
                href={`/work-orders/${workOrder.id}/edit?role=${currentUser.role}`}
                className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Edit work order
              </Link>
            ) : (
              <span className="rounded-md border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-600">
                Read-only
              </span>
            )}
          </div>
          <div className="mt-4">
            <DerivedStatusIndicators
              workOrder={workOrder}
              currentQuote={currentQuote}
              currentInvoice={currentInvoice}
            />
          </div>
        </section>

        <div className="mt-6">
          <StatusTransitionPanel
            workOrder={workOrder}
            role={currentUser.role}
            allowedTransitions={operationalTransitions}
          />
        </div>

        <div className="mt-6">
          <QuoteSection
            workOrder={workOrder}
            quotes={quotes}
            currentQuote={currentQuote}
            role={currentUser.role}
          />
        </div>

        <div className="mt-6">
          <InvoiceSection
            workOrder={workOrder}
            invoices={invoices}
            currentInvoice={currentInvoice}
            role={currentUser.role}
          />
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <DetailSection title="Core details">
            <DetailField label="Description" value={workOrder.description} fullWidth />
            <DetailField label="Category" value={workOrder.category} />
            <DetailField
              label="Requested service date"
              value={formatDate(workOrder.requestedServiceDate)}
            />
          </DetailSection>

          <DetailSection title="Client and location">
            <DetailField
              label="Client name"
              value={
                <Link href={`/clients/${workOrder.clientId}?role=${currentUser.role}`} className="underline-offset-4 hover:underline">
                  {workOrder.clientName}
                </Link>
              }
            />
            <DetailField
              label="Location name"
              value={
                <Link href={`/locations/${workOrder.locationId}?role=${currentUser.role}`} className="underline-offset-4 hover:underline">
                  {workOrder.locationName}
                </Link>
              }
            />
            <DetailField label="Location address" value={workOrder.locationAddress} fullWidth />
            <DetailField label="Contact name" value={workOrder.contactName} />
            <DetailField label="Contact phone" value={workOrder.contactPhone} />
          </DetailSection>

          <DetailSection title="Assignment">
            <DetailField label="Assigned coordinator" value={workOrder.assignedCoordinatorName} />
            <DetailField label="Assigned manager" value={workOrder.assignedManagerName} />
            <DetailField
              label="Assigned contractor"
              value={
                workOrder.assignedContractorId ? (
                  <Link href={`/contractors/${workOrder.assignedContractorId}?role=${currentUser.role}`} className="underline-offset-4 hover:underline">
                    {workOrder.assignedContractorName}
                  </Link>
                ) : (
                  "Unassigned"
                )
              }
            />
            <DetailField
              label="Assignment control"
              value={
                <ContractorAssignmentForm
                  role={currentUser.role}
                  workOrder={workOrder}
                  contractors={activeContractors}
                />
              }
              fullWidth
            />
            <DetailField
              label="Contractor assigned at"
              value={
                workOrder.contractorAssignedAt
                  ? formatDateTime(workOrder.contractorAssignedAt)
                  : null
              }
            />
            <DetailField label="Contractor assigned by" value={workOrder.contractorAssignedBy} />
          </DetailSection>

          <DetailSection title="Notes">
            <DetailField label="Internal notes" value={workOrder.internalNotes} fullWidth />
            <DetailField label="Completion notes" value={workOrder.completionNotes} fullWidth />
          </DetailSection>
        </div>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-neutral-950">Activity timeline</h2>
          <div className="mt-4">
            <ActivityTimeline entries={activity} />
          </div>
        </section>
      </div>
    </InternalShell>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
