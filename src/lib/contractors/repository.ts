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
    name: "Talia Brooks",
    company: "Summit Mechanical",
    companyName: "Summit Mechanical",
    contactName: "Talia Brooks",
    email: "dispatch@summit-mechanical.example",
    phone: "416-555-0201",
    status: "active",
    serviceCategories: ["HVAC", "Mechanical"],
    serviceAreas: ["Toronto"],
    notes: "Preferred contractor for Northstar HVAC quote work.",
    createdAt: "2026-03-25T12:00:00.000Z",
    updatedAt: "2026-04-10T09:45:00.000Z",
    createdByUserId: "Casey Coordinator",
    updatedByUserId: "Casey Coordinator",
    recordStatus: "active",
    isAssignable: true,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "contractor-rapid-plumbing",
    name: "Nolan Singh",
    company: "Rapid Plumbing",
    companyName: "Rapid Plumbing",
    contactName: "Nolan Singh",
    email: "service@rapid-plumbing.example",
    phone: "416-555-0202",
    status: "active",
    serviceCategories: ["Plumbing"],
    serviceAreas: ["Toronto"],
    notes: "Emergency leak response coverage.",
    createdAt: "2026-03-21T10:30:00.000Z",
    updatedAt: "2026-04-10T13:10:00.000Z",
    createdByUserId: "Morgan Manager",
    updatedByUserId: "Morgan Manager",
    recordStatus: "active",
    isAssignable: true,
    createdBy: "Morgan Manager",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "contractor-signalworks",
    name: "Priya Shah",
    company: "SignalWorks",
    companyName: "SignalWorks",
    contactName: "Priya Shah",
    email: "ops@signalworks.example",
    phone: "416-555-0203",
    status: "active",
    serviceCategories: ["AV", "Low voltage"],
    serviceAreas: ["Toronto"],
    notes: null,
    createdAt: "2026-03-29T15:00:00.000Z",
    updatedAt: "2026-04-10T15:00:00.000Z",
    createdByUserId: "Casey Coordinator",
    updatedByUserId: "Morgan Manager",
    recordStatus: "active",
    isAssignable: true,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "contractor-metro-gate",
    name: "Elena Ruiz",
    company: "Metro Gate Service",
    companyName: "Metro Gate Service",
    contactName: "Elena Ruiz",
    email: "dispatch@metrogate.example",
    phone: "416-555-0204",
    status: "active",
    serviceCategories: ["Access control", "Doors"],
    serviceAreas: ["Toronto"],
    notes: "Used for garage and access reader calls.",
    createdAt: "2026-03-20T11:15:00.000Z",
    updatedAt: "2026-04-10T15:30:00.000Z",
    createdByUserId: "Casey Coordinator",
    updatedByUserId: "Casey Coordinator",
    recordStatus: "active",
    isAssignable: true,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "contractor-retired-maintenance",
    name: "Devon Price",
    company: "Retired Maintenance Co.",
    companyName: "Retired Maintenance Co.",
    contactName: "Devon Price",
    email: "inactive@retired-maintenance.example",
    phone: "416-555-0299",
    status: "inactive",
    serviceCategories: ["General maintenance"],
    serviceAreas: ["Toronto"],
    notes: "Inactive sample contractor retained to verify assignment blocking.",
    createdAt: "2026-02-11T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
    createdByUserId: "Finley Finance",
    updatedByUserId: "Finley Finance",
    recordStatus: "active",
    isAssignable: false,
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
    name: input.name,
    company: input.company ?? null,
    companyName: input.company ?? input.name,
    contactName: input.name,
    email: input.email,
    phone: input.phone,
    status: input.status,
    serviceCategories: input.serviceCategories,
    serviceAreas: input.serviceAreas,
    notes: input.notes ?? null,
    id: `contractor-${sequence}`,
    createdAt: now,
    updatedAt: now,
    createdByUserId: actor.name,
    updatedByUserId: actor.name,
    recordStatus: "active",
    isAssignable: input.status === "active" && input.serviceCategories.length > 0,
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
    name: input.name ?? contractor.name,
    company:
      input.company === undefined ? contractor.company : input.company ?? null,
    companyName:
      input.company === undefined
        ? contractor.companyName
        : (input.company ?? contractor.name),
    contactName: input.name ?? contractor.contactName,
    serviceAreas: input.serviceAreas ?? contractor.serviceAreas,
    isAssignable:
      (input.status ?? contractor.status) === "active" &&
      (input.serviceCategories ?? contractor.serviceCategories).length > 0,
    updatedAt: new Date().toISOString(),
    updatedByUserId: actor.name,
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
