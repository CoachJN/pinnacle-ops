import Link from "next/link";
import { InternalShell } from "@/components/internal/internal-shell";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { canCreateWorkOrder } from "@/lib/permissions/work-order-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { listAllClients } from "@/lib/clients/repository";
import { listAllLocations } from "@/lib/locations/repository";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = getMockCurrentUser(readParam(params.role));
  const [clients, locations] = await Promise.all([
    listAllClients(),
    listAllLocations(),
  ]);

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/work-orders?role=${currentUser.role}`}
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        >
          Back to work orders
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            Intake
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Create work order
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Capture the operational details needed to start work in the new state.
          </p>
        </div>
        <div className="mt-6">
          {canCreateWorkOrder(currentUser.role) ? (
            <WorkOrderForm
              mode="create"
              role={currentUser.role}
              clients={clients}
              locations={locations}
            />
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              Your current mock role cannot create work orders.
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
