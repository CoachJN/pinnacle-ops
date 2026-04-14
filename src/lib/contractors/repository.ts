import type {
  Contractor,
  ContractorStatus,
  CreateContractorInput,
  UpdateContractorInput,
} from "../../types/contractor.ts";
import type { EntityId } from "../../types/entity.ts";
import type { WorkOrderRepositoryActor } from "../work-orders/repository.ts";
import { listWorkOrders } from "../work-orders/repository.ts";

export interface ContractorListFilters {
  status?: ContractorStatus | null;
  query?: string | null;
  sort?: "companyName" | "updatedAt";
}

const initialContractors: Contractor[] = [
  {
    id: "contractor-summit-mechanical",
    companyName: "Summit Mechanical",
    contactName: "Talia Brooks",
    email: "dispatch@summit-mechanical.example",
    phone: "416-555-0201",
    status: "active",
    serviceCategories: ["HVAC", "Mechanical"],
    notes: "Preferred contractor for Northstar HVAC quote work.",
    createdAt: "2026-03-25T12:00:00.000Z",
    updatedAt: "2026-04-10T09:45:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "contractor-rapid-plumbing",
    companyName: "Rapid Plumbing",
    contactName: "Nolan Singh",
    email: "service@rapid-plumbing.example",
    phone: "416-555-0202",
    status: "active",
    serviceCategories: ["Plumbing"],
    notes: "Emergency leak response coverage.",
    createdAt: "2026-03-21T10:30:00.000Z",
    updatedAt: "2026-04-10T13:10:00.000Z",
    createdBy: "Morgan Manager",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "contractor-signalworks",
    companyName: "SignalWorks",
    contactName: "Priya Shah",
    email: "ops@signalworks.example",
    phone: "416-555-0203",
    status: "active",
    serviceCategories: ["AV", "Low voltage"],
    notes: null,
    createdAt: "2026-03-29T15:00:00.000Z",
    updatedAt: "2026-04-10T15:00:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "contractor-metro-gate",
    companyName: "Metro Gate Service",
    contactName: "Elena Ruiz",
    email: "dispatch@metrogate.example",
    phone: "416-555-0204",
    status: "active",
    serviceCategories: ["Access control", "Doors"],
    notes: "Used for garage and access reader calls.",
    createdAt: "2026-03-20T11:15:00.000Z",
    updatedAt: "2026-04-10T15:30:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "contractor-retired-maintenance",
    companyName: "Retired Maintenance Co.",
    contactName: "Devon Price",
    email: "inactive@retired-maintenance.example",
    phone: "416-555-0299",
    status: "inactive",
    serviceCategories: ["General maintenance"],
    notes: "Inactive sample contractor retained to verify assignment blocking.",
    createdAt: "2026-02-11T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
    createdBy: "Finley Finance",
    lastUpdatedBy: "Finley Finance",
  },
];

const store = globalThis as typeof globalThis & {
  __pinnacleContractors?: Contractor[];
  __pinnacleContractorSequence?: number;
};

const contractors = store.__pinnacleContractors ?? initialContractors;
store.__pinnacleContractors = contractors;
store.__pinnacleContractorSequence = store.__pinnacleContractorSequence ?? 3001;

export async function listContractors(
  filters: ContractorListFilters = {},
): Promise<Contractor[]> {
  const query = filters.query?.trim().toLowerCase();
  const rows = contractors.filter((contractor) => {
    return (
      (!filters.status || contractor.status === filters.status) &&
      (!query ||
        contractor.companyName.toLowerCase().includes(query) ||
        contractor.contactName.toLowerCase().includes(query) ||
        contractor.serviceCategories.some((category) =>
          category.toLowerCase().includes(query),
        ))
    );
  });

  return [...rows].sort((a, b) => sortContractors(a, b, filters.sort));
}

export async function listActiveContractors(): Promise<Contractor[]> {
  return listContractors({ status: "active", sort: "companyName" });
}

export async function getContractorById(
  id: EntityId,
): Promise<Contractor | null> {
  if (!id.trim()) {
    return null;
  }

  return contractors.find((contractor) => contractor.id === id) ?? null;
}

export async function getContractorByCompanyName(
  companyName: string | null | undefined,
): Promise<Contractor | null> {
  const normalized = companyName?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    contractors.find(
      (contractor) => contractor.companyName.toLowerCase() === normalized,
    ) ?? null
  );
}

export async function createContractor(
  input: CreateContractorInput,
  actor: WorkOrderRepositoryActor,
): Promise<Contractor> {
  const now = new Date().toISOString();
  const sequence = store.__pinnacleContractorSequence ?? 3001;
  store.__pinnacleContractorSequence = sequence + 1;

  const contractor: Contractor = {
    ...input,
    id: `contractor-${sequence}`,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.name,
    lastUpdatedBy: actor.name,
  };

  contractors.unshift(contractor);
  return contractor;
}

export async function updateContractor(
  id: EntityId,
  input: UpdateContractorInput,
  actor: WorkOrderRepositoryActor,
): Promise<Contractor | null> {
  const contractor = await getContractorById(id);
  if (!contractor) {
    return null;
  }

  Object.assign(contractor, input, {
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: actor.name,
  });

  return contractor;
}

export async function listWorkOrdersForContractor(
  contractorId: EntityId,
  limit = 8,
) {
  const workOrders = await listWorkOrders({ sort: "updatedAt" });
  return workOrders
    .filter((workOrder) => workOrder.assignedContractorId === contractorId)
    .slice(0, limit);
}

function sortContractors(
  a: Contractor,
  b: Contractor,
  sort: ContractorListFilters["sort"] = "companyName",
): number {
  if (sort === "updatedAt") {
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  }

  return a.companyName.localeCompare(b.companyName);
}
