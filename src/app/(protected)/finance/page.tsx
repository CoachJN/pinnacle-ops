import Link from "next/link";
import { InternalShell } from "@/components/internal/internal-shell";
import { EmptyState } from "@/components/work-orders/empty-state";
import { SummaryCardGrid } from "@/components/shared/summary-card";
import { WorkOrderTable } from "@/components/work-orders/work-order-table";
import {
  FINANCE_WORK_ORDER_QUEUE_PRESETS,
  QueuePresets,
} from "@/components/work-orders/queue-presets";
import { getInvoiceOperationalFlags } from "@/lib/flags/operational-flags";
import { isFinanceCloseoutRole } from "@/lib/permissions/roles";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { listInvoices } from "@/lib/invoices/repository";
import { listWorkOrders } from "@/lib/work-orders/repository";
import type { Invoice } from "@/types/invoice";
import type { PhaseOneWorkOrder } from "@/types/work-order";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type FinanceQueueKey = (typeof FINANCE_WORK_ORDER_QUEUE_PRESETS)[number][0];

type FinanceQueueSection = {
  key: FinanceQueueKey;
  label: string;
  description: string;
  items: PhaseOneWorkOrder[];
};

export default async function FinanceQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = getMockCurrentUser(readParam(params.role));

  if (!isFinanceCloseoutRole(currentUser.role)) {
    return (
      <InternalShell currentUser={currentUser}>
        <section className="mx-auto max-w-5xl rounded-lg border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-rose-800">
            Unauthorized
          </h1>
          <p className="mt-2 text-sm text-rose-700">
            Your current role cannot access the finance queue.
          </p>
          <Link
            href={`/dashboard?role=${currentUser.role}`}
            className="mt-4 inline-flex rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-500"
          >
            Back to dashboard
          </Link>
        </section>
      </InternalShell>
    );
  }

  const queue = parseQueue(readParam(params.queue));
  const [workOrders, invoices] = await Promise.all([
    listWorkOrders({ sort: "updatedAt" }),
    listInvoices(),
  ]);
  const queueData = buildFinanceQueues(workOrders, invoices);
  const activeQueue =
    queueData.find((entry) => entry.key === queue) ?? queueData[0]!;

  return (
    <InternalShell currentUser={currentUser}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
              Finance
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              Finance closeout queue
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Review completed, invoiced, overdue, and paid work orders through finance
              closeout controls.
            </p>
          </div>
        </section>

        <SummaryCardGrid
          items={queueData.map(({ key, label, items }) => ({
            label,
            value: items.length,
            href: `/finance?role=${currentUser.role}&queue=${key}`,
          }))}
        />

        <QueuePresets
          role={currentUser.role}
          activeView={queue}
          presets={FINANCE_WORK_ORDER_QUEUE_PRESETS}
          basePath="/finance"
          queryKey="queue"
        />

        <section className="rounded-lg border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-neutral-950">
              {activeQueue.label}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {activeQueue.description}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            {activeQueue.items.length > 0 ? (
              <WorkOrderTable
                workOrders={activeQueue.items}
                role={currentUser.role}
                invoices={invoices}
              />
            ) : (
              <EmptyState
                title={`${activeQueue.label} is empty`}
                message="Adjust filters, open an adjacent queue, or return to dashboard for broader context."
              />
            )}
          </div>
        </section>
      </div>
    </InternalShell>
  );
}

function buildFinanceQueues(
  workOrders: readonly PhaseOneWorkOrder[],
  invoices: readonly Invoice[],
): FinanceQueueSection[] {
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  const readyToInvoice = [...workOrders].filter(
    (workOrder) =>
      workOrder.status === "completed" && workOrder.currentInvoiceId == null,
  );

  const draftInvoices = filterByCurrentInvoiceStatus(
    workOrders,
    invoiceById,
    "draft",
  );

  const issuedInvoices = filterByCurrentInvoiceStatus(
    workOrders,
    invoiceById,
    "issued",
  );

  const overdueInvoices = [...workOrders].filter((workOrder) => {
    const currentInvoice = currentInvoiceFor(workOrder, invoiceById);
    return (
      currentInvoice != null &&
      getInvoiceOperationalFlags(currentInvoice).isOverdue
    );
  });

  const paid = [...workOrders].filter(
    (workOrder) =>
      workOrder.status === "paid" &&
      getCurrentInvoiceStatus(workOrder, invoiceById) === "paid",
  );

  return [
    {
      key: "ready_to_invoice",
      label: "Ready to invoice",
      description: "Completed work with no active invoice yet.",
      items: readyToInvoice,
    },
    {
      key: "draft_invoices",
      label: "Draft invoice cases",
      description: "Completed work waiting for draft-to-issued progression.",
      items: draftInvoices,
    },
    {
      key: "issued_invoices",
      label: "Invoiced not paid",
      description: "Invoices issued and waiting for payment.",
      items: issuedInvoices,
    },
    {
      key: "overdue_invoices",
      label: "Overdue invoices",
      description: "Invoices past due that need active follow-up.",
      items: overdueInvoices,
    },
    {
      key: "paid",
      label: "Paid ready for close",
      description: "Paid invoices whose work orders can be closed.",
      items: paid,
    },
  ];
}

function filterByCurrentInvoiceStatus(
  workOrders: readonly PhaseOneWorkOrder[],
  invoiceById: Map<string, Invoice>,
  status: Invoice["status"],
): PhaseOneWorkOrder[] {
  return [...workOrders].filter((workOrder) => {
    const currentInvoice = currentInvoiceFor(workOrder, invoiceById);
    return currentInvoice?.status === status;
  });
}

function currentInvoiceFor(
  workOrder: PhaseOneWorkOrder,
  invoiceById: Map<string, Invoice>,
): Invoice | null {
  if (!workOrder.currentInvoiceId) {
    return null;
  }

  return invoiceById.get(workOrder.currentInvoiceId) ?? null;
}

function getCurrentInvoiceStatus(
  workOrder: PhaseOneWorkOrder,
  invoiceById: Map<string, Invoice>,
): Invoice["status"] | null {
  return currentInvoiceFor(workOrder, invoiceById)?.status ?? null;
}

function parseQueue(value: string | undefined): FinanceQueueKey {
  if (
    value === "ready_to_invoice" ||
    value === "draft_invoices" ||
    value === "issued_invoices" ||
    value === "overdue_invoices" ||
    value === "paid"
  ) {
    return value;
  }

  return "ready_to_invoice";
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
