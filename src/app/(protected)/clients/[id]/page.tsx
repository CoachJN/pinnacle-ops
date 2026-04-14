import Link from "next/link";
import { notFound } from "next/navigation";
import { InternalShell } from "@/components/internal/internal-shell";
import { DetailField, DetailSection } from "@/components/work-orders/detail-section";
import { EmptyState } from "@/components/work-orders/empty-state";
import { formatDateTime } from "@/components/work-orders/formatting";
import { WorkOrderTable } from "@/components/work-orders/work-order-table";
import {
  canEditClient,
  canViewClients,
} from "@/lib/permissions/client-permissions";
import { canCreateLocation } from "@/lib/permissions/location-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { getClientById } from "@/lib/clients/repository";
import { listLocationsForClient } from "@/lib/locations/repository";
import { listWorkOrdersForClient } from "@/lib/work-orders/repository";
import type { Location } from "@/types/client";
import type { InternalUserRole } from "@/types/permissions";

type Params = Promise<{ id?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClientDetailPage({
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
  if (!canViewClients(currentUser.role)) {
    return (
      <InternalShell currentUser={currentUser}>
        <section className="mx-auto mt-6 max-w-5xl rounded-lg border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-rose-800">
            Unauthorized
          </h1>
          <p className="mt-2 text-sm text-rose-700">
            Your current mock role cannot view this client.
          </p>
          <Link
            href={`/clients?role=${currentUser.role}`}
            className="mt-4 inline-flex rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-500"
          >
            Back to clients
          </Link>
        </section>
      </InternalShell>
    );
  }

  const [client, locations, workOrders] = await Promise.all([
    getClientById(id),
    listLocationsForClient(id),
    listWorkOrdersForClient(id),
  ]);

  if (!client) {
    notFound();
  }

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-5xl">
        <Link href={`/clients?role=${currentUser.role}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
          Back to clients
        </Link>

        <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
                Client organization
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
                {client.name}
              </h1>
              <p className="mt-2 text-sm text-neutral-600">
                Updated {formatDateTime(client.updatedAt)}
              </p>
            </div>
            <StatusPill status={client.status} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {canEditClient(currentUser.role, client) ? (
              <Link href={`/clients/${client.id}/edit?role=${currentUser.role}`} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                Edit client
              </Link>
            ) : (
              <span className="rounded-md border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-600">
                Read-only
              </span>
            )}
            {canCreateLocation(currentUser.role) ? (
              <Link href={`/locations/new?clientId=${client.id}&role=${currentUser.role}`} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500">
                Create location
              </Link>
            ) : null}
          </div>
        </section>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <DetailSection title="Primary contact">
            <DetailField label="Contact name" value={client.primaryContactName} />
            <DetailField label="Contact email" value={client.primaryContactEmail} />
            <DetailField label="Contact phone" value={client.primaryContactPhone} />
            <DetailField label="Notes" value={client.notes} fullWidth />
          </DetailSection>
        </div>

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-neutral-950">Locations</h2>
            {canCreateLocation(currentUser.role) ? (
              <Link href={`/locations/new?clientId=${client.id}&role=${currentUser.role}`} className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500">
                Create location
              </Link>
            ) : null}
          </div>
          <div className="mt-4">
            {locations.length > 0 ? (
              <ClientLocationsTable locations={locations} role={currentUser.role} />
            ) : (
              <EmptyState title="No locations yet" message="Create the first service location for this client." />
            )}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-neutral-950">Recent work orders</h2>
          <div className="mt-4">
            {workOrders.length > 0 ? (
              <WorkOrderTable workOrders={workOrders} role={currentUser.role} />
            ) : (
              <EmptyState title="No work orders yet" message="Work orders linked to this client will appear here." />
            )}
          </div>
        </section>
      </div>
    </InternalShell>
  );
}

function ClientLocationsTable({
  locations,
  role,
}: {
  locations: Location[];
  role: InternalUserRole;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
          <tr>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">City</th>
            <th className="px-4 py-3">Province/state</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {locations.map((location) => (
            <tr key={location.id} className="hover:bg-stone-50">
              <td className="px-4 py-3 font-semibold">
                <Link href={`/locations/${location.id}?role=${role}`} className="underline-offset-4 hover:underline">
                  {location.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-neutral-700">{location.city}</td>
              <td className="px-4 py-3 text-neutral-700">{location.provinceOrState}</td>
              <td className="px-4 py-3"><StatusPill status={location.status} /></td>
              <td className="px-4 py-3 text-neutral-700">{formatDateTime(location.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: "active" | "inactive" }) {
  return (
    <span className="inline-flex rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-xs font-semibold uppercase tracking-normal text-neutral-700">
      {status}
    </span>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
