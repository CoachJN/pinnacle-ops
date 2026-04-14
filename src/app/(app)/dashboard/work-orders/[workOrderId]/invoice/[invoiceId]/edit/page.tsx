import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";
import { InvoiceEditorForm } from "@/components/invoices/invoice-editor-form";
import {
  authorizeInvoiceEdit,
  getWorkOrderApiContext,
} from "@/server/api/work-orders";

interface InvoiceEditPageProps {
  params: Promise<{
    workOrderId: string;
    invoiceId: string;
  }>;
}

export default async function InvoiceEditPage({
  params,
}: InvoiceEditPageProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { workOrderId, invoiceId } = await params;
  const context = await getWorkOrderApiContext();
  const [workOrder, invoice] = await Promise.all([
    context.services.workOrders.getById(workOrderId),
    context.services.invoices.getById(invoiceId),
  ]);

  if (!workOrder.ok || !invoice.ok || invoice.value.workOrderId !== workOrderId) {
    notFound();
  }

  await authorizeInvoiceEdit(context, workOrder.value, invoice.value);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <Link
        className="inline-flex text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href={`/dashboard/work-orders/${workOrderId}/invoice/${invoiceId}`}
      >
        Back to invoice
      </Link>

      <InvoiceEditorForm
        cancelHref={`/dashboard/work-orders/${workOrderId}/invoice/${invoiceId}`}
        invoice={invoice.value}
        method="PATCH"
        submitHref={`/api/work-orders/${workOrderId}/invoices/${invoiceId}`}
        successHref={`/dashboard/work-orders/${workOrderId}/invoice/${invoiceId}`}
        workOrder={{
          id: workOrder.value.id,
          workOrderNumber: workOrder.value.workOrderNumber,
          title: workOrder.value.title,
        }}
      />
    </section>
  );
}
