import Link from "next/link";
import { InternalShell } from "@/components/internal/internal-shell";
import { EmptyState } from "@/components/work-orders/empty-state";
import { formatDateTime } from "@/components/work-orders/formatting";
import {
  canCreateLocation,
  canViewLocations,
} from "@/lib/permissions/location-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { listAllClients } from "@/lib/clients/repository";
import { listLocations, type LocationListFilters } from "@/lib/locations/repository";
import type { ClientOrganization, Location, OperationalRecordStatus } from "@/types/client";
import type { InternalUserRole } from "@/types/permissions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LocationListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = getMockCurrentUser(readParam(params.role));
  const clients = await listAllClients();
  const clientNameById = Object.fromEntries(
    clients.map((client) => [client.id, client.name]),
  );
  const filters: LocationListFilters = {
    clientId: readParam(params.clientId) || null,
    status: parseStatus(readParam(params.status)),
    query: readParam(params.query),
    sort: parseSort(readParam(params.sort)),
  };
  const locations = await listLocations(filters, clientNameById);

  return (
    <InternalShell currentUser={currentUser}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
              Locations
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              Service locations
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Operational location records nested under client organizations.
            </p>
          </div>
          {canCreateLocation(currentUser.role) ? (
            <Link href={`/locations/new?role=${currentUser.role}`} className="inline-flex rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
              Create location
            </Link>
          ) : null}
        </div>

        <LocationFilters role={currentUser.role} filters={filters} clients={clients} />

        {!canViewLocations(currentUser.role) ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            Your current mock role cannot view locations.
          </div>
        ) : locations.length > 0 ? (
          <LocationTable
            locations={locations}
            clientsById={Object.fromEntries(clients.map((client) => [client.id, client]))}
            role={currentUser.role}
          />
        ) : (
          <EmptyState
            title="No locations found"
            message="Adjust filters or create a location under a client."
          />
        )}
      </div>
    </InternalShell>
  );
}

function LocationFilters({
  role,
  filters,
  clients,
}: {
  role: InternalUserRole;
  filters: LocationListFilters;
  clients: ClientOrganization[];
}) {
  return (
    <form className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-5" action="/locations">
      <input type="hidden" name="role" value={role} />
      <label className="text-sm font-medium text-neutral-700">
        Client
        <select name="clientId" defaultValue={filters.clientId ?? ""} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Status
        <select name="status" defaultValue={filters.status ?? ""} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700 md:col-span-2">
        Location name
        <input name="query" defaultValue={filters.query ?? ""} placeholder="Search location name" className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Sort
        <select name="sort" defaultValue={filters.sort ?? "name"} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="name">Location name</option>
          <option value="clientName">Client name</option>
          <option value="updatedAt">Updated at</option>
        </select>
      </label>
      <div className="flex gap-2 md:col-span-5">
        <button type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
          Apply filters
        </button>
        <Link href={`/locations?role=${role}`} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500">
          Reset
        </Link>
      </div>
    </form>
  );
}

function LocationTable({
  locations,
  clientsById,
  role,
}: {
  locations: Location[];
  clientsById: Record<string, ClientOrganization>;
  role: InternalUserRole;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
            <tr>
              <th className="px-4 py-3">Location name</th>
              <th className="px-4 py-3">Client name</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Province/state</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Location contact</th>
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
                <td className="px-4 py-3 text-neutral-700">
                  <Link href={`/clients/${location.clientId}?role=${role}`} className="underline-offset-4 hover:underline">
                    {clientsById[location.clientId]?.name ?? "Unknown client"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-700">{location.city}</td>
                <td className="px-4 py-3 text-neutral-700">{location.provinceOrState}</td>
                <td className="px-4 py-3"><StatusPill status={location.status} /></td>
                <td className="px-4 py-3 text-neutral-700">{location.locationContactName}</td>
                <td className="px-4 py-3 text-neutral-700">{formatDateTime(location.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function parseStatus(value: string | undefined): OperationalRecordStatus | null {
  return value === "active" || value === "inactive" ? value : null;
}

function parseSort(value: string | undefined): LocationListFilters["sort"] {
  if (value === "clientName" || value === "updatedAt") {
    return value;
  }

  return "name";
}
