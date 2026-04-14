import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";
import { InvoiceDetailCard } from "@/components/invoices/invoice-detail-card";
import { InvoiceHistoryList } from "@/components/work-orders/invoice-history-list";
import {
  authorizeInvoiceRead,
  getWorkOrderApiContext,
} from "@/server/api/work-orders";

interface InvoiceViewPageProps {
  params: Promise<{
    workOrderId: string;
    invoiceId: string;
  }>;
}

export default async function InvoiceViewPage({
  params,
}: InvoiceViewPageProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { workOrderId, invoiceId } = await params;
  const context = await getWorkOrderApiContext();
  const [workOrder, invoiceResult, invoices] = await Promise.all([
    context.services.workOrders.getById(workOrderId),
    context.services.invoices.getById(invoiceId),
    context.services.invoices.listByWorkOrderId(workOrderId),
  ]);

  if (
    !workOrder.ok ||
    !invoiceResult.ok ||
    !invoices.ok ||
    invoiceResult.value.workOrderId !== workOrderId
  ) {
    notFound();
  }

  await authorizeInvoiceRead(context, workOrder.value, invoiceResult.value);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <Link
        className="inline-flex text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href={`/dashboard/work-orders/${workOrderId}`}
      >
        Back to work order
      </Link>

      <InvoiceDetailCard invoice={invoiceResult.value} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-950">Invoice history</h2>
        <InvoiceHistoryList
          buildInvoiceHref={(invoice) =>
            `/dashboard/work-orders/${workOrderId}/invoice/${invoice.id}`
          }
          invoices={invoices.value}
        />
      </section>
    </section>
  );
}
