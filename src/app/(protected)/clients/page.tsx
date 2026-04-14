import Link from "next/link";
import { InternalShell } from "@/components/internal/internal-shell";
import { EmptyState } from "@/components/work-orders/empty-state";
import { formatDateTime } from "@/components/work-orders/formatting";
import { canCreateClient, canViewClients } from "@/lib/permissions/client-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { listClients, type ClientListFilters } from "@/lib/clients/repository";
import { listAllLocations } from "@/lib/locations/repository";
import type { ClientOrganization, OperationalRecordStatus } from "@/types/client";
import type { InternalUserRole } from "@/types/permissions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClientListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = getMockCurrentUser(readParam(params.role));
  const filters: ClientListFilters = {
    status: parseStatus(readParam(params.status)),
    query: readParam(params.query),
    sort: parseSort(readParam(params.sort)),
  };
  const [clients, locations] = await Promise.all([
    listClients(filters),
    listAllLocations(),
  ]);
  const locationCountByClient = locations.reduce<Record<string, number>>(
    (counts, location) => ({
      ...counts,
      [location.clientId]: (counts[location.clientId] ?? 0) + 1,
    }),
    {},
  );

  return (
    <InternalShell currentUser={currentUser}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
              Clients
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              Client organizations
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Internal client records, primary contacts, and location counts.
            </p>
          </div>
          {canCreateClient(currentUser.role) ? (
            <Link
              href={`/clients/new?role=${currentUser.role}`}
              className="inline-flex rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Create client
            </Link>
          ) : null}
        </div>

        <ClientFilters role={currentUser.role} filters={filters} />

        {!canViewClients(currentUser.role) ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            Your current mock role cannot view clients.
          </div>
        ) : clients.length > 0 ? (
          <ClientTable
            clients={clients}
            locationCountByClient={locationCountByClient}
            role={currentUser.role}
          />
        ) : (
          <EmptyState
            title="No clients found"
            message="Adjust filters or create a client organization."
          />
        )}
      </div>
    </InternalShell>
  );
}

function ClientFilters({
  role,
  filters,
}: {
  role: InternalUserRole;
  filters: ClientListFilters;
}) {
  return (
    <form className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-4" action="/clients">
      <input type="hidden" name="role" value={role} />
      <label className="text-sm font-medium text-neutral-700 md:col-span-2">
        Client name
        <input name="query" defaultValue={filters.query ?? ""} placeholder="Search client name" className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Status
        <select name="status" defaultValue={filters.status ?? ""} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Sort
        <select name="sort" defaultValue={filters.sort ?? "name"} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="name">Name</option>
          <option value="updatedAt">Updated at</option>
        </select>
      </label>
      <div className="flex gap-2 md:col-span-4">
        <button type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
          Apply filters
        </button>
        <Link href={`/clients?role=${role}`} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500">
          Reset
        </Link>
      </div>
    </form>
  );
}

function ClientTable({
  clients,
  locationCountByClient,
  role,
}: {
  clients: ClientOrganization[];
  locationCountByClient: Record<string, number>;
  role: InternalUserRole;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
            <tr>
              <th className="px-4 py-3">Client name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Primary contact</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Locations</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-semibold">
                  <Link className="underline-offset-4 hover:underline" href={`/clients/${client.id}?role=${role}`}>
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3"><StatusPill status={client.status} /></td>
                <td className="px-4 py-3 text-neutral-700">{client.primaryContactName}</td>
                <td className="px-4 py-3 text-neutral-700">{client.primaryContactEmail ?? "Not set"}</td>
                <td className="px-4 py-3 text-neutral-700">{client.primaryContactPhone}</td>
                <td className="px-4 py-3 text-neutral-700">{locationCountByClient[client.id] ?? 0}</td>
                <td className="px-4 py-3 text-neutral-700">{formatDateTime(client.updatedAt)}</td>
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

function parseSort(value: string | undefined): ClientListFilters["sort"] {
  return value === "updatedAt" ? "updatedAt" : "name";
}
