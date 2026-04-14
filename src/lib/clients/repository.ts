import type {
  ClientOrganization,
  CreateClientOrganizationInput,
  OperationalRecordStatus,
  UpdateClientOrganizationInput,
} from "@/types/client";
import type { EntityId } from "@/types/entity";
import type { WorkOrderRepositoryActor } from "@/lib/work-orders/repository";

export interface ClientListFilters {
  status?: OperationalRecordStatus | null;
  query?: string | null;
  sort?: "name" | "updatedAt";
}

const initialClients: ClientOrganization[] = [
  {
    id: "client-northstar",
    name: "Northstar Properties",
    status: "active",
    primaryContactName: "Avery Hill",
    primaryContactEmail: "avery.hill@northstar.example",
    primaryContactPhone: "416-555-0119",
    notes: "Prefers morning service windows for tenant-facing spaces.",
    createdAt: "2026-03-20T14:00:00.000Z",
    updatedAt: "2026-04-08T13:30:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "client-harbourview",
    name: "Harbourview Offices",
    status: "active",
    primaryContactName: "Jordan Lee",
    primaryContactEmail: "jordan.lee@harbourview.example",
    primaryContactPhone: "416-555-0134",
    notes: null,
    createdAt: "2026-03-18T10:00:00.000Z",
    updatedAt: "2026-04-09T10:15:00.000Z",
    createdBy: "Morgan Manager",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "client-cobalt",
    name: "Cobalt Workspace",
    status: "active",
    primaryContactName: "Sam Patel",
    primaryContactEmail: "sam.patel@cobalt.example",
    primaryContactPhone: "416-555-0155",
    notes: "Security escort required for contractor access after 6 p.m.",
    createdAt: "2026-03-22T09:00:00.000Z",
    updatedAt: "2026-04-10T13:10:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "client-archstone",
    name: "Archstone Retail Group",
    status: "inactive",
    primaryContactName: "Riley Quinn",
    primaryContactEmail: null,
    primaryContactPhone: "416-555-0188",
    notes: "Inactive sample account retained for filtering checks.",
    createdAt: "2026-02-15T12:00:00.000Z",
    updatedAt: "2026-03-30T16:00:00.000Z",
    createdBy: "Finley Finance",
    lastUpdatedBy: "Finley Finance",
  },
];

const store = globalThis as typeof globalThis & {
  __pinnacleClients?: ClientOrganization[];
  __pinnacleClientSequence?: number;
};

const clients = store.__pinnacleClients ?? initialClients;
store.__pinnacleClients = clients;
store.__pinnacleClientSequence = store.__pinnacleClientSequence ?? 2001;

export async function listClients(
  filters: ClientListFilters = {},
): Promise<ClientOrganization[]> {
  const query = filters.query?.trim().toLowerCase();
  const rows = clients.filter((client) => {
    return (
      (!filters.status || client.status === filters.status) &&
      (!query || client.name.toLowerCase().includes(query))
    );
  });

  return [...rows].sort((a, b) => sortClients(a, b, filters.sort));
}

export async function listAllClients(): Promise<ClientOrganization[]> {
  return [...clients].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getClientById(
  id: EntityId,
): Promise<ClientOrganization | null> {
  if (!id.trim()) {
    return null;
  }

  return clients.find((client) => client.id === id) ?? null;
}

export async function createClient(
  input: CreateClientOrganizationInput,
  actor: WorkOrderRepositoryActor,
): Promise<ClientOrganization> {
  const now = new Date().toISOString();
  const sequence = store.__pinnacleClientSequence ?? 2001;
  store.__pinnacleClientSequence = sequence + 1;

  const client: ClientOrganization = {
    ...input,
    id: `client-${sequence}`,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.name,
    lastUpdatedBy: actor.name,
  };

  clients.unshift(client);
  return client;
}

export async function updateClient(
  id: EntityId,
  input: UpdateClientOrganizationInput,
  actor: WorkOrderRepositoryActor,
): Promise<ClientOrganization | null> {
  const client = await getClientById(id);
  if (!client) {
    return null;
  }

  Object.assign(client, input, {
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: actor.name,
  });

  return client;
}

function sortClients(
  a: ClientOrganization,
  b: ClientOrganization,
  sort: ClientListFilters["sort"] = "name",
): number {
  if (sort === "updatedAt") {
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  }

  return a.name.localeCompare(b.name);
}
