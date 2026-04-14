import type {
  CreateLocationInput,
  Location,
  OperationalRecordStatus,
  UpdateLocationInput,
} from "@/types/client";
import type { EntityId } from "@/types/entity";
import type { WorkOrderRepositoryActor } from "@/lib/work-orders/repository";

export interface LocationListFilters {
  clientId?: EntityId | null;
  status?: OperationalRecordStatus | null;
  query?: string | null;
  sort?: "name" | "clientName" | "updatedAt";
}

const initialLocations: Location[] = [
  {
    id: "loc-pinnacle-tower",
    clientId: "client-northstar",
    name: "Pinnacle Tower",
    addressLine1: "110 King St W",
    addressLine2: null,
    city: "Toronto",
    provinceOrState: "ON",
    postalCode: "M5H 1J9",
    country: "Canada",
    locationContactName: "Avery Hill",
    locationContactEmail: "avery.hill@northstar.example",
    locationContactPhone: "416-555-0119",
    accessNotes: "Check in with concierge at the east lobby desk.",
    status: "active",
    createdAt: "2026-03-20T14:30:00.000Z",
    updatedAt: "2026-04-08T13:30:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "loc-northstar-annex",
    clientId: "client-northstar",
    name: "Northstar Annex",
    addressLine1: "114 King St W",
    addressLine2: "Service entrance",
    city: "Toronto",
    provinceOrState: "ON",
    postalCode: "M5H 1J9",
    country: "Canada",
    locationContactName: "Mina Owens",
    locationContactEmail: null,
    locationContactPhone: "416-555-0190",
    accessNotes: null,
    status: "inactive",
    createdAt: "2026-03-25T12:30:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    createdBy: "Morgan Manager",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "loc-harbourview-garage",
    clientId: "client-harbourview",
    name: "Harbourview Garage",
    addressLine1: "88 Queens Quay E",
    addressLine2: "South garage",
    city: "Toronto",
    provinceOrState: "ON",
    postalCode: "M5E 1V3",
    country: "Canada",
    locationContactName: "Jordan Lee",
    locationContactEmail: "jordan.lee@harbourview.example",
    locationContactPhone: "416-555-0134",
    accessNotes: "Use loading bay P2 for contractor parking.",
    status: "active",
    createdAt: "2026-03-18T10:30:00.000Z",
    updatedAt: "2026-04-09T10:15:00.000Z",
    createdBy: "Morgan Manager",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "loc-harbourview-loading-dock",
    clientId: "client-harbourview",
    name: "Loading Dock",
    addressLine1: "88 Queens Quay E",
    addressLine2: "West service corridor",
    city: "Toronto",
    provinceOrState: "ON",
    postalCode: "M5E 1V3",
    country: "Canada",
    locationContactName: "Jordan Lee",
    locationContactEmail: "jordan.lee@harbourview.example",
    locationContactPhone: "416-555-0134",
    accessNotes: "Dock supervisor must unlock roll-up door.",
    status: "active",
    createdAt: "2026-03-18T11:00:00.000Z",
    updatedAt: "2026-04-02T16:00:00.000Z",
    createdBy: "Morgan Manager",
    lastUpdatedBy: "Finley Finance",
  },
  {
    id: "loc-cobalt-suite-1400",
    clientId: "client-cobalt",
    name: "Suite 1400",
    addressLine1: "40 University Ave",
    addressLine2: "Floor 14",
    city: "Toronto",
    provinceOrState: "ON",
    postalCode: "M5J 1T1",
    country: "Canada",
    locationContactName: "Sam Patel",
    locationContactEmail: "sam.patel@cobalt.example",
    locationContactPhone: "416-555-0155",
    accessNotes: "Security escort required after reception check-in.",
    status: "active",
    createdAt: "2026-03-22T09:30:00.000Z",
    updatedAt: "2026-04-10T13:10:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
];

const store = globalThis as typeof globalThis & {
  __pinnacleLocations?: Location[];
  __pinnacleLocationSequence?: number;
};

const locations = store.__pinnacleLocations ?? initialLocations;
store.__pinnacleLocations = locations;
store.__pinnacleLocationSequence = store.__pinnacleLocationSequence ?? 3001;

export async function listLocations(
  filters: LocationListFilters = {},
  clientNameById: Record<EntityId, string> = {},
): Promise<Location[]> {
  const query = filters.query?.trim().toLowerCase();
  const rows = locations.filter((location) => {
    return (
      (!filters.clientId || location.clientId === filters.clientId) &&
      (!filters.status || location.status === filters.status) &&
      (!query || location.name.toLowerCase().includes(query))
    );
  });

  return [...rows].sort((a, b) =>
    sortLocations(a, b, filters.sort, clientNameById),
  );
}

export async function listAllLocations(): Promise<Location[]> {
  return [...locations].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listLocationsForClient(
  clientId: EntityId,
): Promise<Location[]> {
  return locations
    .filter((location) => location.clientId === clientId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLocationById(id: EntityId): Promise<Location | null> {
  if (!id.trim()) {
    return null;
  }

  return locations.find((location) => location.id === id) ?? null;
}

export async function createLocation(
  input: CreateLocationInput,
  actor: WorkOrderRepositoryActor,
): Promise<Location> {
  const now = new Date().toISOString();
  const sequence = store.__pinnacleLocationSequence ?? 3001;
  store.__pinnacleLocationSequence = sequence + 1;

  const location: Location = {
    ...input,
    id: `loc-${sequence}`,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.name,
    lastUpdatedBy: actor.name,
  };

  locations.unshift(location);
  return location;
}

export async function updateLocation(
  id: EntityId,
  input: UpdateLocationInput,
  actor: WorkOrderRepositoryActor,
): Promise<Location | null> {
  const location = await getLocationById(id);
  if (!location) {
    return null;
  }

  Object.assign(location, input, {
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: actor.name,
  });

  return location;
}

function sortLocations(
  a: Location,
  b: Location,
  sort: LocationListFilters["sort"] = "name",
  clientNameById: Record<EntityId, string>,
): number {
  if (sort === "updatedAt") {
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  }

  if (sort === "clientName") {
    return (clientNameById[a.clientId] ?? "").localeCompare(
      clientNameById[b.clientId] ?? "",
    );
  }

  return a.name.localeCompare(b.name);
}
