import type {
  ActivityEntry,
  PhaseOneCreateWorkOrderInput,
  PhaseOneUpdateWorkOrderInput,
  PhaseOneWorkOrder,
  PhaseOneWorkOrderStatus,
} from "../../types/work-order.ts";
import type { UserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import type { Contractor } from "../../types/contractor.ts";
import { getClientById } from "../clients/repository.ts";
import {
  getContractorByCompanyName,
  getContractorById,
} from "../contractors/repository.ts";
import { getLocationById } from "../locations/repository.ts";

export interface WorkOrderListFilters {
  status?: PhaseOneWorkOrderStatus | null;
  view?: WorkOrderListView | null;
  priority?: PhaseOneWorkOrder["priority"] | null;
  client?: string | null;
  assignedTo?: string | null;
  sort?: "updatedAt" | "requestedServiceDate" | "priority";
}

export type WorkOrderListView =
  | "active"
  | "needs_review"
  | "awaiting_payment"
  | "terminal"
  | "ready_to_invoice"
  | "quote_requested"
  | "quote_received"
  | "pending_client_approval"
  | "approved_to_proceed"
  | "in_progress"
  | "completed"
  | "invoiced"
  | "paid"
  | "overdue_invoice"
  | "closed"
  | "cancelled"
  | "mine";

export type WorkOrderRepositoryActorRole = UserRole | "system";

export interface WorkOrderRepositoryActor {
  name: string;
  role: WorkOrderRepositoryActorRole;
}

const roleLabelByRole = {
  [USER_ROLES.Coordinator]: "Coordinator",
  [USER_ROLES.Manager]: "Manager",
  [USER_ROLES.FinanceAdmin]: "Finance/Admin",
  [USER_ROLES.Owner]: "Owner",
  [USER_ROLES.ClientUser]: "Client",
  [USER_ROLES.ContractorUser]: "Contractor",
  system: "system",
} as const satisfies Record<WorkOrderRepositoryActorRole, string>;

const priorityRank = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const satisfies Record<PhaseOneWorkOrder["priority"], number>;

const initialWorkOrders: PhaseOneWorkOrder[] = [
  {
    id: "wo-1001",
    workOrderNumber: "WO-1001",
    status: "new",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: null,
    priority: "high",
    title: "Lobby HVAC not cooling",
    description: "Main lobby temperature is rising during business hours.",
    clientId: "client-northstar",
    locationId: "loc-pinnacle-tower",
    clientName: "Northstar Properties",
    locationName: "Pinnacle Tower",
    locationAddress: "110 King St W, Toronto, ON",
    contactName: "Avery Hill",
    contactPhone: "416-555-0119",
    createdAt: "2026-04-08T13:30:00.000Z",
    updatedAt: "2026-04-08T13:30:00.000Z",
    requestedServiceDate: "2026-04-14",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: null,
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "HVAC",
    internalNotes: "Client reports issue is limited to the east lobby.",
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "wo-1002",
    workOrderNumber: "WO-1002",
    status: "in_review",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: null,
    priority: "medium",
    title: "Parking gate sensor fault",
    description: "South garage gate intermittently stays open.",
    clientId: "client-harbourview",
    locationId: "loc-harbourview-garage",
    clientName: "Harbourview Offices",
    locationName: "Harbourview Garage",
    locationAddress: "88 Queens Quay E, Toronto, ON",
    contactName: "Jordan Lee",
    contactPhone: "416-555-0134",
    createdAt: "2026-04-07T15:20:00.000Z",
    updatedAt: "2026-04-09T10:15:00.000Z",
    requestedServiceDate: "2026-04-15",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: "contractor-metro-gate",
    assignedContractorName: "Metro Gate Service",
    contractorAssignedAt: "2026-04-09T10:15:00.000Z",
    contractorAssignedBy: "Morgan Manager",
    category: "Access control",
    internalNotes: null,
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "wo-1003",
    workOrderNumber: "WO-1003",
    status: "dispatched",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: null,
    priority: "urgent",
    title: "Water leak in tenant kitchen",
    description: "Active leak under the kitchen sink on floor 14.",
    clientId: "client-cobalt",
    locationId: "loc-cobalt-suite-1400",
    clientName: "Cobalt Workspace",
    locationName: "Suite 1400",
    locationAddress: "40 University Ave, Toronto, ON",
    contactName: "Sam Patel",
    contactPhone: "416-555-0155",
    createdAt: "2026-04-10T12:45:00.000Z",
    updatedAt: "2026-04-10T13:10:00.000Z",
    requestedServiceDate: "2026-04-10",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: "contractor-rapid-plumbing",
    assignedContractorName: "Rapid Plumbing",
    contractorAssignedAt: "2026-04-10T13:10:00.000Z",
    contractorAssignedBy: "Morgan Manager",
    category: "Plumbing",
    internalNotes: "Security will escort contractor after check-in.",
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "wo-1004",
    workOrderNumber: "WO-1004",
    status: "completed",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: null,
    priority: "low",
    title: "Replace hallway bulbs",
    description: "Three bulbs out near the west elevator bank.",
    clientId: "client-northstar",
    locationId: "loc-pinnacle-tower",
    clientName: "Northstar Properties",
    locationName: "Pinnacle Tower",
    locationAddress: "110 King St W, Toronto, ON",
    contactName: "Avery Hill",
    contactPhone: "416-555-0119",
    createdAt: "2026-04-05T09:00:00.000Z",
    updatedAt: "2026-04-09T18:00:00.000Z",
    requestedServiceDate: "2026-04-09",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: "Brightline Electrical",
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "Electrical",
    internalNotes: null,
    completionNotes: "Bulbs replaced and area inspected.",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "wo-1005",
    workOrderNumber: "WO-1005",
    status: "closed",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: "inv-1005",
    priority: "medium",
    title: "Loading dock door adjustment",
    description: "Door was rubbing against the frame when opened.",
    clientId: "client-harbourview",
    locationId: "loc-harbourview-loading-dock",
    clientName: "Harbourview Offices",
    locationName: "Loading Dock",
    locationAddress: "88 Queens Quay E, Toronto, ON",
    contactName: "Jordan Lee",
    contactPhone: "416-555-0134",
    createdAt: "2026-03-28T11:00:00.000Z",
    updatedAt: "2026-04-02T16:00:00.000Z",
    requestedServiceDate: "2026-04-01",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: "DockWorks",
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "Doors",
    internalNotes: null,
    completionNotes: "Track aligned and door tested.",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Finley Finance",
  },
  {
    id: "wo-1007",
    workOrderNumber: "WO-1007",
    status: "in_progress",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: null,
    priority: "high",
    title: "Suite entry keypad failure",
    description: "Tenant entry keypad is accepting codes intermittently.",
    clientId: "client-harbourview",
    locationId: "loc-harbourview-garage",
    clientName: "Harbourview Offices",
    locationName: "Harbourview Garage",
    locationAddress: "88 Queens Quay E, Toronto, ON",
    contactName: "Jordan Lee",
    contactPhone: "416-555-0134",
    createdAt: "2026-04-09T08:45:00.000Z",
    updatedAt: "2026-04-10T15:30:00.000Z",
    requestedServiceDate: "2026-04-11",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: "contractor-metro-gate",
    assignedContractorName: "Metro Gate Service",
    contractorAssignedAt: "2026-04-10T09:45:00.000Z",
    contractorAssignedBy: "Casey Coordinator",
    category: "Access control",
    internalNotes: "Contractor is testing the replacement reader before closeout.",
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "wo-1006",
    workOrderNumber: "WO-1006",
    status: "cancelled",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: null,
    priority: "medium",
    title: "Conference room paint touch-up",
    description: "Request cancelled after client moved the booking.",
    clientId: "client-cobalt",
    locationId: "loc-cobalt-suite-1400",
    clientName: "Cobalt Workspace",
    locationName: "Suite 1400",
    locationAddress: "40 University Ave, Toronto, ON",
    contactName: "Sam Patel",
    contactPhone: "416-555-0155",
    createdAt: "2026-04-01T14:00:00.000Z",
    updatedAt: "2026-04-03T09:30:00.000Z",
    requestedServiceDate: null,
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: null,
    assignedContractorId: null,
    assignedContractorName: null,
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "Paint",
    internalNotes: "Client will reopen if needed next month.",
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "wo-1008",
    workOrderNumber: "WO-1008",
    status: "quote_requested",
    requiresQuote: true,
    currentQuoteId: null,
    currentInvoiceId: null,
    priority: "medium",
    title: "Rooftop unit compressor replacement quote",
    description: "Contractor quote needed before compressor replacement is approved.",
    clientId: "client-northstar",
    locationId: "loc-pinnacle-tower",
    clientName: "Northstar Properties",
    locationName: "Pinnacle Tower",
    locationAddress: "110 King St W, Toronto, ON",
    contactName: "Avery Hill",
    contactPhone: "416-555-0119",
    createdAt: "2026-04-09T09:00:00.000Z",
    updatedAt: "2026-04-10T09:45:00.000Z",
    requestedServiceDate: "2026-04-18",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: "contractor-summit-mechanical",
    assignedContractorName: "Summit Mechanical",
    contractorAssignedAt: "2026-04-10T09:45:00.000Z",
    contractorAssignedBy: "Casey Coordinator",
    category: "HVAC",
    internalNotes: "Awaiting contractor breakdown before client approval.",
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "wo-1009",
    workOrderNumber: "WO-1009",
    status: "quote_received",
    requiresQuote: true,
    currentQuoteId: "quote-1009-v1",
    currentInvoiceId: null,
    priority: "high",
    title: "Emergency generator repair estimate",
    description: "Generator repair requires manager quote review before client approval.",
    clientId: "client-harbourview",
    locationId: "loc-harbourview-loading-dock",
    clientName: "Harbourview Offices",
    locationName: "Loading Dock",
    locationAddress: "88 Queens Quay E, Toronto, ON",
    contactName: "Jordan Lee",
    contactPhone: "416-555-0134",
    createdAt: "2026-04-08T16:00:00.000Z",
    updatedAt: "2026-04-10T11:20:00.000Z",
    requestedServiceDate: "2026-04-16",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: "Northline Power",
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "Electrical",
    internalNotes: "Quote received for failed transfer switch components.",
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "wo-1010",
    workOrderNumber: "WO-1010",
    status: "pending_client_approval",
    requiresQuote: true,
    currentQuoteId: "quote-1010-v1",
    currentInvoiceId: null,
    priority: "medium",
    title: "Suite glass replacement approval",
    description: "Glass replacement quote is ready for client approval.",
    clientId: "client-cobalt",
    locationId: "loc-cobalt-suite-1400",
    clientName: "Cobalt Workspace",
    locationName: "Suite 1400",
    locationAddress: "40 University Ave, Toronto, ON",
    contactName: "Sam Patel",
    contactPhone: "416-555-0155",
    createdAt: "2026-04-06T12:00:00.000Z",
    updatedAt: "2026-04-10T14:30:00.000Z",
    requestedServiceDate: "2026-04-19",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: "Clearline Glass",
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "Glass",
    internalNotes: "Manager approved for client decision.",
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "wo-1011",
    workOrderNumber: "WO-1011",
    status: "approved_to_proceed",
    requiresQuote: true,
    currentQuoteId: "quote-1011-v1",
    currentInvoiceId: null,
    priority: "medium",
    title: "Boardroom AV cabling approved work",
    description: "Client approved quote and work can now be dispatched.",
    clientId: "client-northstar",
    locationId: "loc-pinnacle-tower",
    clientName: "Northstar Properties",
    locationName: "Pinnacle Tower",
    locationAddress: "110 King St W, Toronto, ON",
    contactName: "Avery Hill",
    contactPhone: "416-555-0119",
    createdAt: "2026-04-03T10:00:00.000Z",
    updatedAt: "2026-04-10T15:00:00.000Z",
    requestedServiceDate: "2026-04-17",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: "contractor-signalworks",
    assignedContractorName: "SignalWorks",
    contractorAssignedAt: "2026-04-10T15:00:00.000Z",
    contractorAssignedBy: "Morgan Manager",
    category: "AV",
    internalNotes: "Client approved quote verbally, recorded by manager.",
    completionNotes: null,
    createdBy: "Morgan Manager",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "wo-1012",
    workOrderNumber: "WO-1012",
    status: "quote_requested",
    requiresQuote: true,
    currentQuoteId: "quote-1012-v2",
    currentInvoiceId: null,
    priority: "high",
    title: "Lobby stone repair revised quote",
    description: "Client rejected initial stone repair quote; revised quote is in draft.",
    clientId: "client-harbourview",
    locationId: "loc-harbourview-garage",
    clientName: "Harbourview Offices",
    locationName: "Harbourview Garage",
    locationAddress: "88 Queens Quay E, Toronto, ON",
    contactName: "Jordan Lee",
    contactPhone: "416-555-0134",
    createdAt: "2026-04-02T09:30:00.000Z",
    updatedAt: "2026-04-10T16:15:00.000Z",
    requestedServiceDate: "2026-04-20",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: "Stonecraft Restoration",
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "Masonry",
    internalNotes: "Client asked for smaller repair scope.",
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "wo-1013",
    workOrderNumber: "WO-1013",
    status: "completed",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: "inv-1013",
    priority: "medium",
    title: "Replace loading dock keypad",
    description: "Finance draft is being prepared after operational completion.",
    clientId: "client-harbourview",
    locationId: "loc-harbourview-loading-dock",
    clientName: "Harbourview Offices",
    locationName: "Loading Dock",
    locationAddress: "88 Queens Quay E, Toronto, ON",
    contactName: "Jordan Lee",
    contactPhone: "416-555-0134",
    createdAt: "2026-04-04T13:15:00.000Z",
    updatedAt: "2026-04-10T17:15:00.000Z",
    requestedServiceDate: "2026-04-10",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: "contractor-metro-gate",
    assignedContractorName: "Metro Gate Service",
    contractorAssignedAt: "2026-04-10T17:15:00.000Z",
    contractorAssignedBy: "Casey Coordinator",
    category: "Access control",
    internalNotes: null,
    completionNotes: "Keypad replaced and tested.",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Finley Finance",
  },
  {
    id: "wo-1014",
    workOrderNumber: "WO-1014",
    status: "invoiced",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: "inv-1014",
    priority: "low",
    title: "Suite lock repair",
    description: "Invoice has been issued and is awaiting payment.",
    clientId: "client-cobalt",
    locationId: "loc-cobalt-suite-1400",
    clientName: "Cobalt Workspace",
    locationName: "Suite 1400",
    locationAddress: "40 University Ave, Toronto, ON",
    contactName: "Sam Patel",
    contactPhone: "416-555-0155",
    createdAt: "2026-03-30T14:00:00.000Z",
    updatedAt: "2026-04-09T19:00:00.000Z",
    requestedServiceDate: "2026-04-08",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: "SecureLine",
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "Doors",
    internalNotes: null,
    completionNotes: "Lock cylinder replaced.",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Finley Finance",
  },
  {
    id: "wo-1015",
    workOrderNumber: "WO-1015",
    status: "invoiced",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: "inv-1015",
    priority: "high",
    title: "Emergency ceiling tile replacement",
    description: "Issued invoice is past due and needs finance follow-up.",
    clientId: "client-northstar",
    locationId: "loc-pinnacle-tower",
    clientName: "Northstar Properties",
    locationName: "Pinnacle Tower",
    locationAddress: "110 King St W, Toronto, ON",
    contactName: "Avery Hill",
    contactPhone: "416-555-0119",
    createdAt: "2026-03-20T11:00:00.000Z",
    updatedAt: "2026-04-01T17:00:00.000Z",
    requestedServiceDate: "2026-03-21",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: "Brightline Electrical",
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "General maintenance",
    internalNotes: "Manual overdue status recorded by finance.",
    completionNotes: "Ceiling tiles replaced after leak remediation.",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Finley Finance",
  },
  {
    id: "wo-1016",
    workOrderNumber: "WO-1016",
    status: "paid",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: "inv-1016",
    priority: "medium",
    title: "Washroom exhaust fan service",
    description: "Paid work order is ready for internal closeout.",
    clientId: "client-harbourview",
    locationId: "loc-harbourview-garage",
    clientName: "Harbourview Offices",
    locationName: "Harbourview Garage",
    locationAddress: "88 Queens Quay E, Toronto, ON",
    contactName: "Jordan Lee",
    contactPhone: "416-555-0134",
    createdAt: "2026-03-25T09:30:00.000Z",
    updatedAt: "2026-04-08T16:15:00.000Z",
    requestedServiceDate: "2026-04-03",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: "contractor-summit-mechanical",
    assignedContractorName: "Summit Mechanical",
    contractorAssignedAt: "2026-04-08T16:15:00.000Z",
    contractorAssignedBy: "Casey Coordinator",
    category: "HVAC",
    internalNotes: null,
    completionNotes: "Fan cleaned and belt replaced.",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Finley Finance",
  },
  {
    id: "wo-1017",
    workOrderNumber: "WO-1017",
    status: "completed",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: "inv-1017b",
    priority: "low",
    title: "Tenant signage removal",
    description: "Original invoice was voided and a replacement draft is current.",
    clientId: "client-cobalt",
    locationId: "loc-cobalt-suite-1400",
    clientName: "Cobalt Workspace",
    locationName: "Suite 1400",
    locationAddress: "40 University Ave, Toronto, ON",
    contactName: "Sam Patel",
    contactPhone: "416-555-0155",
    createdAt: "2026-04-02T10:30:00.000Z",
    updatedAt: "2026-04-10T18:00:00.000Z",
    requestedServiceDate: "2026-04-08",
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: "DockWorks",
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "General maintenance",
    internalNotes: "Replacement invoice draft reflects corrected signage quantity.",
    completionNotes: "Signage removed and wall patched.",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Finley Finance",
  },
];

const initialActivityEntries: ActivityEntry[] = initialWorkOrders.flatMap((workOrder) => [
  {
    id: `act-${workOrder.id}-created`,
    workOrderId: workOrder.id,
    type: "created",
    message: `Created ${workOrder.workOrderNumber}.`,
    createdAt: workOrder.createdAt,
    actorName: workOrder.createdBy,
    actorRole: roleLabelByRole[USER_ROLES.Coordinator],
  },
  ...(workOrder.createdAt === workOrder.updatedAt
    ? []
    : [
        {
          id: `act-${workOrder.id}-updated`,
          workOrderId: workOrder.id,
          type: "edited" as const,
          message: `Updated ${workOrder.workOrderNumber}.`,
          createdAt: workOrder.updatedAt,
          actorName: workOrder.lastUpdatedBy,
          actorRole: roleLabelByRole[USER_ROLES.Manager],
        },
      ]),
]);

const store = globalThis as typeof globalThis & {
  __pinnaclePhaseOneWorkOrders?: PhaseOneWorkOrder[];
  __pinnaclePhaseOneActivityEntries?: ActivityEntry[];
  __pinnaclePhaseOneSequence?: number;
};

const workOrders = store.__pinnaclePhaseOneWorkOrders ?? initialWorkOrders;
const activityEntries =
  store.__pinnaclePhaseOneActivityEntries ?? initialActivityEntries;

store.__pinnaclePhaseOneWorkOrders = workOrders;
store.__pinnaclePhaseOneActivityEntries = activityEntries;
store.__pinnaclePhaseOneSequence = store.__pinnaclePhaseOneSequence ?? 1018;

export async function listWorkOrders(
  filters: WorkOrderListFilters = {},
): Promise<PhaseOneWorkOrder[]> {
  const clientQuery = filters.client?.trim().toLowerCase();
  const assignedTo = filters.assignedTo?.trim().toLowerCase();
  const rows = workOrders.filter((workOrder) => {
    return (
      matchesWorkOrderView(workOrder, filters.view, assignedTo) &&
      (!filters.status || workOrder.status === filters.status) &&
      (!filters.priority || workOrder.priority === filters.priority) &&
      (!clientQuery ||
        workOrder.clientName.toLowerCase().includes(clientQuery))
    );
  });

  return [...rows].sort((a, b) => sortWorkOrders(a, b, filters.sort));
}

function matchesWorkOrderView(
  workOrder: PhaseOneWorkOrder,
  view: WorkOrderListView | null | undefined,
  assignedTo: string | null | undefined,
): boolean {
  if (!view) {
    return true;
  }

  if (view === "active") {
    return (
      workOrder.status === "new" ||
      workOrder.status === "in_review" ||
      workOrder.status === "quote_requested" ||
      workOrder.status === "quote_received" ||
      workOrder.status === "pending_client_approval" ||
      workOrder.status === "approved_to_proceed" ||
      workOrder.status === "dispatched" ||
      workOrder.status === "in_progress"
    );
  }

  if (view === "ready_to_invoice") {
    return workOrder.status === "completed" && !workOrder.currentInvoiceId;
  }

  if (view === "needs_review") {
    return (
      workOrder.status === "new" ||
      workOrder.status === "in_review" ||
      workOrder.status === "quote_received"
    );
  }

  if (view === "awaiting_payment") {
    return workOrder.status === "invoiced" && Boolean(workOrder.currentInvoiceId);
  }

  if (view === "terminal") {
    return workOrder.status === "closed" || workOrder.status === "cancelled";
  }

  if (view === "overdue_invoice") {
    return workOrder.status === "invoiced" && Boolean(workOrder.currentInvoiceId);
  }

  if (view === "mine") {
    if (!assignedTo) {
      return false;
    }

    return [
      workOrder.assignedCoordinatorName,
      workOrder.assignedManagerName,
    ].some((assignee) => assignee?.toLowerCase() === assignedTo);
  }

  return workOrder.status === view;
}

export async function getWorkOrderById(
  id: string,
): Promise<PhaseOneWorkOrder | null> {
  if (!id.trim()) {
    return null;
  }

  return workOrders.find((workOrder) => workOrder.id === id) ?? null;
}

export async function getActivityForWorkOrder(
  workOrderId: string,
): Promise<ActivityEntry[]> {
  return activityEntries
    .filter((entry) => entry.workOrderId === workOrderId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function listWorkOrdersForClient(
  clientId: string,
  limit = 8,
): Promise<PhaseOneWorkOrder[]> {
  return workOrders
    .filter((workOrder) => workOrder.clientId === clientId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, limit);
}

export async function listWorkOrdersForLocation(
  locationId: string,
  limit = 8,
): Promise<PhaseOneWorkOrder[]> {
  return workOrders
    .filter((workOrder) => workOrder.locationId === locationId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, limit);
}

export async function countWorkOrdersForLocation(
  locationId: string,
): Promise<number> {
  return workOrders.filter((workOrder) => workOrder.locationId === locationId)
    .length;
}

export async function createWorkOrder(
  input: PhaseOneCreateWorkOrderInput,
  actor: WorkOrderRepositoryActor,
): Promise<PhaseOneWorkOrder> {
  const linkedFields = await buildLinkedDisplayFields(
    input.clientId,
    input.locationId,
  );
  const now = new Date().toISOString();
  const sequence = store.__pinnaclePhaseOneSequence ?? 1007;
  store.__pinnaclePhaseOneSequence = sequence + 1;

  const workOrder: PhaseOneWorkOrder = {
    ...input,
    ...linkedFields,
    id: `wo-${sequence}`,
    workOrderNumber: `WO-${sequence}`,
    status: "new",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: null,
    createdAt: now,
    updatedAt: now,
    assignedContractorName: null,
    assignedContractorId: null,
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    completionNotes: null,
    createdBy: actor.name,
    lastUpdatedBy: actor.name,
  };

  workOrders.unshift(workOrder);
  addActivity(workOrder.id, {
    type: "created",
    message: `Created ${workOrder.workOrderNumber}.`,
    actor,
  });

  return workOrder;
}

export async function setWorkOrderQuoteRequirement(
  id: string,
  requiresQuote: boolean,
  actor: WorkOrderRepositoryActor,
): Promise<PhaseOneWorkOrder | null> {
  const workOrder = await getWorkOrderById(id);
  if (!workOrder) {
    return null;
  }

  workOrder.requiresQuote = requiresQuote;
  workOrder.updatedAt = new Date().toISOString();
  workOrder.lastUpdatedBy = actor.name;

  addActivity(workOrder.id, {
    type: "edited",
    message: requiresQuote
      ? "Marked this work order as requiring a quote."
      : "Marked this work order as not requiring a quote.",
    actor,
  });

  return workOrder;
}

export async function setCurrentQuoteForWorkOrder(
  workOrderId: string,
  quoteId: string | null,
  actor: WorkOrderRepositoryActor,
): Promise<PhaseOneWorkOrder | null> {
  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder) {
    return null;
  }

  workOrder.currentQuoteId = quoteId;
  workOrder.updatedAt = new Date().toISOString();
  workOrder.lastUpdatedBy = actor.name;

  return workOrder;
}

export async function assignContractorToWorkOrder(
  workOrderId: string,
  contractorId: string | null,
  actor: WorkOrderRepositoryActor,
): Promise<PhaseOneWorkOrder | null> {
  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder) {
    return null;
  }

  const contractor = contractorId ? await getContractorById(contractorId) : null;
  if (contractorId && (!contractor || contractor.status !== "active")) {
    return null;
  }

  const previousContractorName =
    workOrder.assignedContractorName ?? "Unassigned";
  const now = new Date().toISOString();
  workOrder.assignedContractorId = contractor?.id ?? null;
  workOrder.assignedContractorName = contractor?.companyName ?? null;
  workOrder.contractorAssignedAt = contractor ? now : null;
  workOrder.contractorAssignedBy = contractor ? actor.name : null;
  workOrder.updatedAt = now;
  workOrder.lastUpdatedBy = actor.name;

  addActivity(workOrder.id, {
    type: "contractor_assigned",
    message: contractor
      ? `Assigned contractor changed from ${previousContractorName} to ${contractor.companyName}.`
      : `Contractor assignment cleared from ${previousContractorName}.`,
    actor,
  });

  return workOrder;
}

export async function ensureWorkOrderContractorLink(
  workOrder: PhaseOneWorkOrder,
): Promise<Contractor | null> {
  if (workOrder.assignedContractorId) {
    return getContractorById(workOrder.assignedContractorId);
  }

  const contractor = await getContractorByCompanyName(
    workOrder.assignedContractorName,
  );
  if (!contractor) {
    return null;
  }

  workOrder.assignedContractorId = contractor.id;
  workOrder.assignedContractorName = contractor.companyName;
  return contractor;
}

export async function setCurrentInvoiceForWorkOrder(
  workOrderId: string,
  invoiceId: string | null,
  actor: WorkOrderRepositoryActor,
): Promise<PhaseOneWorkOrder | null> {
  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder) {
    return null;
  }

  workOrder.currentInvoiceId = invoiceId;
  workOrder.updatedAt = new Date().toISOString();
  workOrder.lastUpdatedBy = actor.name;

  return workOrder;
}

export async function updateWorkOrder(
  id: string,
  input: PhaseOneUpdateWorkOrderInput,
  actor: WorkOrderRepositoryActor,
): Promise<PhaseOneWorkOrder | null> {
  const workOrder = await getWorkOrderById(id);
  if (!workOrder) {
    return null;
  }

  const nextClientId = input.clientId ?? workOrder.clientId;
  const nextLocationId = input.locationId ?? workOrder.locationId;
  const linkedFields = await buildLinkedDisplayFields(nextClientId, nextLocationId);

  Object.assign(workOrder, input, linkedFields, {
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: actor.name,
  });

  addActivity(workOrder.id, {
    type: "edited",
    message: `Edited ${workOrder.workOrderNumber}.`,
    actor,
  });

  return workOrder;
}

async function buildLinkedDisplayFields(
  clientId: string,
  locationId: string,
): Promise<
  Pick<
    PhaseOneWorkOrder,
    | "clientName"
    | "locationName"
    | "locationAddress"
    | "contactName"
    | "contactPhone"
  >
> {
  const [client, location] = await Promise.all([
    getClientById(clientId),
    getLocationById(locationId),
  ]);

  return {
    clientName: client?.name ?? "Unknown client",
    locationName: location?.name ?? "Unknown location",
    locationAddress: location ? formatLocationAddress(location) : "Unknown address",
    contactName: location?.locationContactName ?? client?.primaryContactName ?? "",
    contactPhone: location?.locationContactPhone ?? client?.primaryContactPhone ?? "",
  };
}

function formatLocationAddress(location: Awaited<ReturnType<typeof getLocationById>> & {}): string {
  return [
    location.addressLine1,
    location.addressLine2,
    location.city,
    location.provinceOrState,
    location.postalCode,
    location.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function transitionWorkOrderStatus(
  id: string,
  status: PhaseOneWorkOrderStatus,
  actor: WorkOrderRepositoryActor,
  options: {
    activityMessage?: string;
    suppressActivity?: boolean;
  } = {},
): Promise<PhaseOneWorkOrder | null> {
  const workOrder = await getWorkOrderById(id);
  if (!workOrder) {
    return null;
  }

  const previousStatus = workOrder.status;
  workOrder.status = status;
  workOrder.updatedAt = new Date().toISOString();
  workOrder.lastUpdatedBy = actor.name;

  if (!options.suppressActivity) {
    addActivity(workOrder.id, {
      type: "status_changed",
      message:
        options.activityMessage ??
        `Changed status from ${previousStatus} to ${status}.`,
      actor,
    });
  }

  return workOrder;
}

export async function updateContractorExecutionStatus(
  id: string,
  status: Extract<PhaseOneWorkOrderStatus, "in_progress" | "completed">,
  completionNotes: string | null,
  actor: WorkOrderRepositoryActor,
): Promise<PhaseOneWorkOrder | null> {
  const workOrder = await getWorkOrderById(id);
  if (!workOrder) {
    return null;
  }

  const previousStatus = workOrder.status;
  const now = new Date().toISOString();
  workOrder.status = status;
  if (status === "completed") {
    workOrder.completionNotes = completionNotes;
  }
  workOrder.updatedAt = now;
  workOrder.lastUpdatedBy = actor.name;

  addActivity(workOrder.id, {
    type: "contractor_status_updated",
    message: `Contractor changed status from ${previousStatus} to ${status}.`,
    actor,
  });

  if (status === "completed" && completionNotes) {
    addActivity(workOrder.id, {
      type: "contractor_completion_notes_added",
      message: "Contractor submitted completion notes.",
      actor,
    });
  }

  return workOrder;
}

function addActivity(
  workOrderId: string,
  input: {
    type: ActivityEntry["type"];
    message: string;
    actor: WorkOrderRepositoryActor;
  },
): ActivityEntry {
  const entry: ActivityEntry = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    workOrderId,
    type: input.type,
    message: input.message,
    createdAt: new Date().toISOString(),
    actorName: input.actor.name,
    actorRole: roleLabelByRole[input.actor.role],
  };

  activityEntries.unshift(entry);
  return entry;
}

export async function addWorkOrderActivity(
  workOrderId: string,
  input: {
    type: ActivityEntry["type"];
    message: string;
    actor: WorkOrderRepositoryActor;
  },
): Promise<ActivityEntry> {
  return addActivity(workOrderId, input);
}

function sortWorkOrders(
  a: PhaseOneWorkOrder,
  b: PhaseOneWorkOrder,
  sort: WorkOrderListFilters["sort"] = "updatedAt",
): number {
  if (sort === "requestedServiceDate") {
    return compareNullableDate(b.requestedServiceDate, a.requestedServiceDate);
  }

  if (sort === "priority") {
    return priorityRank[b.priority] - priorityRank[a.priority];
  }

  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function compareNullableDate(a: string | null, b: string | null): number {
  if (!a && !b) {
    return 0;
  }

  if (!a) {
    return 1;
  }

  if (!b) {
    return -1;
  }

  return Date.parse(a) - Date.parse(b);
}
