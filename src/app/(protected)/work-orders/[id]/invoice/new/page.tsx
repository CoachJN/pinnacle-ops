import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { InternalShell } from "@/components/internal/internal-shell";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { canCreateInvoice } from "@/lib/permissions/invoice-permissions";
import { getWorkOrderById } from "@/lib/work-orders/repository";

type Params = Promise<{ id?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewInvoicePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!id?.trim()) {
    notFound();
  }

  const currentUser = getMockCurrentUser(readParam(query.role));
  const workOrder = await getWorkOrderById(id);
  if (!workOrder) {
    notFound();
  }

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/work-orders/${workOrder.id}?role=${currentUser.role}`}
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        >
          Back to work order
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            {workOrder.workOrderNumber}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Create invoice draft
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Draft invoices stay internal and keep the work order completed until issued.
          </p>
        </div>
        <div className="mt-6">
          {canCreateInvoice(currentUser.role, workOrder) ? (
            <InvoiceForm
              mode="create"
              role={currentUser.role}
              workOrder={workOrder}
            />
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              Your current role or work order state cannot create an invoice here.
            </div>
          )}
        </div>
      </div>
    </InternalShell>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
