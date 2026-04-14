import Link from "next/link";
import { notFound } from "next/navigation";
import { InternalShell } from "@/components/internal/internal-shell";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { canEditWorkOrder } from "@/lib/permissions/work-order-permissions";
import { listAllClients } from "@/lib/clients/repository";
import { listAllLocations } from "@/lib/locations/repository";
import { getWorkOrderById } from "@/lib/work-orders/repository";

type Params = Promise<{ id?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EditWorkOrderPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!id || !id.trim()) {
    notFound();
  }

  const currentUser = getMockCurrentUser(readParam(query.role));
  const requestedClientId = readParam(query.clientId);
  const [workOrder, clients, locations] = await Promise.all([
    getWorkOrderById(id),
    listAllClients(),
    listAllLocations(),
  ]);
  if (!workOrder) {
    notFound();
  }

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/work-orders/${workOrder.id}?role=${currentUser.role}`}
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        >
          Back to detail
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            {workOrder.workOrderNumber}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Edit work order
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Update operational fields and notes for the work order hub.
          </p>
        </div>
        <div className="mt-6">
          {canEditWorkOrder(currentUser.role, workOrder) ? (
            <WorkOrderForm
              mode="edit"
              role={currentUser.role}
              workOrder={workOrder}
              clients={clients}
              locations={locations}
              defaultClientId={requestedClientId}
            />
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              This work order is read-only for your current mock role or terminal state.
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
