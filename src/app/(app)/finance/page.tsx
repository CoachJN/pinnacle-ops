import { requireUserWithRole } from "@/lib/auth/guards";
import { APP_ROLES } from "@/lib/rbac/roles";
import { FinanceQueuePage } from "@/components/invoices/finance-queue-page";
import {
  authorizeFinanceQueueRead,
  getWorkOrderApiContext,
  listScopeForActor,
} from "@/server/api/work-orders";
import {
  buildFinanceQueue,
  filterFinanceQueueItems,
  FINANCE_QUEUE_FILTERS,
  parseFinanceQueueFilter,
  type FinanceQueueFilter,
} from "@/modules/finance";

interface FinancePageProps {
  searchParams: Promise<{
    view?: string;
  }>;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  await requireUserWithRole([
    APP_ROLES.Manager,
    APP_ROLES.FinanceAdmin,
    APP_ROLES.Owner,
  ] as const);
  const { view } = await searchParams;
  const context = await getWorkOrderApiContext();
  authorizeFinanceQueueRead(context);

  const filter = readFinanceQueueFilter(view);
  const scope = listScopeForActor(context.actor, 200);
  const [invoiceQueue, workOrders] = await Promise.all([
    context.services.invoices.listFinanceQueue({ limit: scope.limit }),
    context.services.workOrders.list(scope),
  ]);

  if (!invoiceQueue.ok) {
    throw invoiceQueue.error;
  }
  if (!workOrders.ok) {
    throw workOrders.error;
  }

  const allItems = buildFinanceQueue({
    workOrders: workOrders.value.map((workOrder) => ({
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      status: workOrder.status,
      priority: workOrder.priority,
      clientOrganizationId: workOrder.clientOrganizationId,
      locationId: workOrder.locationId,
      currentInvoiceId: workOrder.currentInvoiceId,
      clientSnapshot: workOrder.clientSnapshot,
      locationSnapshot: workOrder.locationSnapshot,
      completedAt: workOrder.completedAt,
      updatedAt: workOrder.updatedAt,
    })),
    invoices: invoiceQueue.value.map((invoice) => ({
      id: invoice.id,
      workOrderId: invoice.workOrderId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      dueDate: invoice.dueDate,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      sentAt: invoice.sentAt,
      viewedAt: invoice.viewedAt,
      paidAt: invoice.paidAt,
      updatedAt: invoice.updatedAt,
    })),
  });

  const counts = Object.fromEntries(
    FINANCE_QUEUE_FILTERS.map((entry) => [
      entry,
      filterFinanceQueueItems(allItems, entry).length,
    ]),
  ) as Record<FinanceQueueFilter, number>;

  return (
    <FinanceQueuePage
      counts={counts}
      filter={filter}
      items={filterFinanceQueueItems(allItems, filter).map((item) => ({
        id: item.id,
        state: item.state,
        requiresAttention: item.requiresAttention,
        workOrder: item.workOrder,
        invoice: item.invoice,
      }))}
    />
  );
}

function readFinanceQueueFilter(value: string | undefined): FinanceQueueFilter {
  try {
    return parseFinanceQueueFilter(value ?? null).filter;
  } catch {
    return "all";
  }
}
