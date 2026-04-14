import Link from "next/link";
import { InternalShell } from "@/components/internal/internal-shell";
import { EmptyState } from "@/components/work-orders/empty-state";
import { WorkOrderFilters } from "@/components/work-orders/work-order-filters";
import { WorkOrderTable } from "@/components/work-orders/work-order-table";
import { QueuePresets } from "@/components/work-orders/queue-presets";
import { getInvoiceOperationalFlags } from "@/lib/flags/operational-flags";
import { listInvoices } from "@/lib/invoices/repository";
import {
  canCreateWorkOrder,
  canViewWorkOrders,
} from "@/lib/permissions/work-order-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { parseWorkOrderPriority } from "@/lib/work-orders/constants";
import { listWorkOrders, type WorkOrderListFilters } from "@/lib/work-orders/repository";
import { parseWorkOrderStatus } from "@/lib/work-orders/status";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function WorkOrderListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const role = readParam(params.role);
  const currentUser = getMockCurrentUser(role);
  const status = parseWorkOrderStatus(readParam(params.status));
  const view = parseView(readParam(params.view));
  const priority = parseWorkOrderPriority(readParam(params.priority));
  const client = readParam(params.client);
  const sort = parseSort(readParam(params.sort));
  const filters: WorkOrderListFilters = {
    status,
    view,
    priority,
    client,
    sort,
    assignedTo: view === "mine" ? currentUser.name : null,
  };
  const [invoices, workOrders] = await Promise.all([
    listInvoices(),
    listWorkOrders(filters),
  ]);
  const filteredWorkOrders =
    view === "overdue_invoice"
      ? workOrders.filter((workOrder) =>
          invoices.some(
            (invoice) =>
              invoice.id === workOrder.currentInvoiceId &&
              getInvoiceOperationalFlags(invoice).isOverdue,
          ),
        )
      : workOrders;

  return (
    <InternalShell currentUser={currentUser}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
              Work orders
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              Internal work order index
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Review intake, current operational state, ownership, and service timing.
            </p>
          </div>
          {canCreateWorkOrder(currentUser.role) ? (
            <Link
              href={`/work-orders/new?role=${currentUser.role}`}
              className="inline-flex rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Create work order
            </Link>
          ) : null}
        </div>

        <WorkOrderFilters
          role={currentUser.role}
          view={view ?? ""}
          status={status ?? ""}
          priority={priority ?? ""}
          client={client ?? ""}
          sort={sort}
        />
        <QueuePresets role={currentUser.role} activeView={view} />

        {!canViewWorkOrders(currentUser.role) ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            Your current mock role cannot view work orders.
          </div>
        ) : filteredWorkOrders.length > 0 ? (
          <WorkOrderTable
            workOrders={filteredWorkOrders}
            role={currentUser.role}
            invoices={invoices}
          />
        ) : (
          <EmptyState
            title="No work orders found"
            message="Adjust filters or choose another queue."
          />
        )}
      </div>
    </InternalShell>
  );
}

function parseView(value: string | undefined): WorkOrderListFilters["view"] {
  if (
    value === "active" ||
    value === "needs_review" ||
    value === "awaiting_payment" ||
    value === "terminal" ||
    value === "quote_requested" ||
    value === "quote_received" ||
    value === "pending_client_approval" ||
    value === "approved_to_proceed" ||
    value === "in_progress" ||
    value === "ready_to_invoice" ||
    value === "completed" ||
    value === "invoiced" ||
    value === "paid" ||
    value === "overdue_invoice" ||
    value === "closed" ||
    value === "cancelled" ||
    value === "mine"
  ) {
    return value;
  }

  return null;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseSort(value: string | undefined): WorkOrderListFilters["sort"] {
  if (
    value === "updatedAt" ||
    value === "requestedServiceDate" ||
    value === "priority"
  ) {
    return value;
  }

  return "updatedAt";
}
