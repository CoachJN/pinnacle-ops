import Link from "next/link";
import { notFound } from "next/navigation";
import { InternalShell } from "@/components/internal/internal-shell";
import { DetailField, DetailSection } from "@/components/work-orders/detail-section";
import { EmptyState } from "@/components/work-orders/empty-state";
import { formatDateTime } from "@/components/work-orders/formatting";
import { WorkOrderTable } from "@/components/work-orders/work-order-table";
import { canEditLocation } from "@/lib/permissions/location-permissions";
import { canViewLocations } from "@/lib/permissions/location-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { getClientById } from "@/lib/clients/repository";
import { getLocationById } from "@/lib/locations/repository";
import { listWorkOrdersForLocation } from "@/lib/work-orders/repository";

type Params = Promise<{ id?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LocationDetailPage({
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
  const location = await getLocationById(id);
  if (!location) {
    notFound();
  }
  if (!canViewLocations(currentUser.role)) {
    return (
      <InternalShell currentUser={currentUser}>
        <section className="mx-auto mt-6 max-w-5xl rounded-lg border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-rose-800">
            Unauthorized
          </h1>
          <p className="mt-2 text-sm text-rose-700">
            Your current mock role cannot view this location.
          </p>
          <Link
            href={`/locations?role=${currentUser.role}`}
            className="mt-4 inline-flex rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-500"
          >
            Back to locations
          </Link>
        </section>
      </InternalShell>
    );
  }

  const [client, workOrders] = await Promise.all([
    getClientById(location.clientId),
    listWorkOrdersForLocation(location.id),
  ]);

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-5xl">
        <Link href={`/locations?role=${currentUser.role}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
          Back to locations
        </Link>

        <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-500">
                {client?.name ?? "Unknown client"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
                {location.name}
              </h1>
              <p className="mt-2 text-sm text-neutral-600">
                Updated {formatDateTime(location.updatedAt)}
              </p>
            </div>
            <StatusPill status={location.status} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {canEditLocation(currentUser.role, location) ? (
              <Link href={`/locations/${location.id}/edit?role=${currentUser.role}`} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                Edit location
              </Link>
            ) : (
              <span className="rounded-md border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-600">
                Read-only
              </span>
            )}
            {client ? (
              <Link href={`/clients/${client.id}?role=${currentUser.role}`} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500">
                Open client
              </Link>
            ) : null}
          </div>
        </section>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <DetailSection title="Address">
            <DetailField label="Address line 1" value={location.addressLine1} />
            <DetailField label="Address line 2" value={location.addressLine2} />
            <DetailField label="City" value={location.city} />
            <DetailField label="Province/state" value={location.provinceOrState} />
            <DetailField label="Postal code" value={location.postalCode} />
            <DetailField label="Country" value={location.country} />
          </DetailSection>
          <DetailSection title="Location contact">
            <DetailField label="Contact name" value={location.locationContactName} />
            <DetailField label="Contact email" value={location.locationContactEmail} />
            <DetailField label="Contact phone" value={location.locationContactPhone} />
            <DetailField label="Access notes" value={location.accessNotes} fullWidth />
          </DetailSection>
          <DetailSection title="Related client">
            <DetailField label="Client" value={client?.name ?? "Unknown client"} />
            <DetailField label="Primary contact" value={client?.primaryContactName} />
            <DetailField label="Primary phone" value={client?.primaryContactPhone} />
          </DetailSection>
        </div>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-neutral-950">Recent work orders</h2>
          <div className="mt-4">
            {workOrders.length > 0 ? (
              <WorkOrderTable workOrders={workOrders} role={currentUser.role} />
            ) : (
              <EmptyState title="No work orders yet" message="Work orders linked to this location will appear here." />
            )}
          </div>
        </section>
      </div>
    </InternalShell>
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
