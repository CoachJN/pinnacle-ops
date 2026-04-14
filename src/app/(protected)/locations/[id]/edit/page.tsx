import Link from "next/link";
import { notFound } from "next/navigation";
import { InternalShell } from "@/components/internal/internal-shell";
import { LocationForm } from "@/components/locations/location-form";
import { canEditLocation } from "@/lib/permissions/location-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { listAllClients } from "@/lib/clients/repository";
import { getLocationById } from "@/lib/locations/repository";
import { countWorkOrdersForLocation } from "@/lib/work-orders/repository";

type Params = Promise<{ id?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EditLocationPage({
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
  const [location, clients, workOrderCount] = await Promise.all([
    getLocationById(id),
    listAllClients(),
    countWorkOrdersForLocation(id),
  ]);
  if (!location) {
    notFound();
  }

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-4xl">
        <Link href={`/locations/${location.id}?role=${currentUser.role}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
          Back to location
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            {location.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Edit location
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Client reassignment is available only before work orders reference this location.
          </p>
        </div>
        <div className="mt-6">
          {canEditLocation(currentUser.role, location) ? (
            <LocationForm
              mode="edit"
              role={currentUser.role}
              clients={clients}
              location={location}
              canReassignClient={workOrderCount === 0}
            />
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              Your current mock role cannot edit locations.
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
