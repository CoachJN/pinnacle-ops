import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";
import { InvoiceEditorForm } from "@/components/invoices/invoice-editor-form";
import { getWorkOrderApiContext, authorizeInvoiceCreate } from "@/server/api/work-orders";
import { buildInvoiceCreationEligibility } from "@/modules/finance";

interface InvoiceCreatePageProps {
  params: Promise<{
    workOrderId: string;
  }>;
}

export default async function InvoiceCreatePage({
  params,
}: InvoiceCreatePageProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { workOrderId } = await params;
  const context = await getWorkOrderApiContext();
  const workOrder = await context.services.workOrders.getById(workOrderId);
  if (!workOrder.ok) {
    notFound();
  }

  await authorizeInvoiceCreate(context, workOrder.value);
  const invoices = await context.services.invoices.listByWorkOrderId(workOrderId);
  if (!invoices.ok) {
    throw invoices.error;
  }

  const eligibility = buildInvoiceCreationEligibility({
    workOrderStatus: workOrder.value.lifecycleStatus,
    hasActiveInvoice: invoices.value.some((invoice) => invoice.status !== "void"),
  });

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <Link
        className="inline-flex text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href={`/dashboard/work-orders/${workOrderId}`}
      >
        Back to work order
      </Link>

      {eligibility.eligible ? (
        <InvoiceEditorForm
          cancelHref={`/dashboard/work-orders/${workOrderId}`}
          method="POST"
          submitHref={`/api/work-orders/${workOrderId}/invoices`}
          successHref={`/dashboard/work-orders/${workOrderId}`}
          workOrder={{
            id: workOrder.value.id,
            workOrderNumber: workOrder.value.workOrderNumber,
            title: workOrder.value.title,
          }}
        />
      ) : (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900">
          {eligibility.reason}
        </div>
      )}
    </section>
  );
}
