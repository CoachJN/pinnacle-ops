import {
  activityLogPolicy,
  assignmentPolicy,
  billingDataPolicy,
  clientOrganizationPolicy,
  clientQuotePolicy,
  contractorOrganizationPolicy,
  contractorQuotePolicy,
  internalNotePolicy,
  invoicePolicy,
  locationPolicy,
  paymentStatusPolicy,
  workOrderPolicy,
  type AssignmentRelationshipContext,
} from "@/lib/access-policy";
import type { AccessActor, User } from "@/types/auth";
import type {
  AnyActivityLogEntry,
  CoreWorkflowStatusHistoryEntry,
} from "@/types/audit";
import type { Comment } from "@/types/collaboration";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  ClientQuote,
  ContractorQuote,
  CurrencyCode,
  Invoice,
  MoneyAmountCents,
} from "@/types/financial";
import type {
  ClientOrganization,
  ContractorOrganization,
  Location,
} from "@/types/organization";
import {
  FINANCIAL_VISIBILITY_LAYERS,
  type FinancialVisibilityLayer,
  roleCanViewFinancialLayer,
} from "@/types/financial-controls";
import type { Assignment, WorkOrder } from "@/types/work-order";

type ExternalEntityFields = Pick<
  WorkOrder,
  | "id"
  | "organizationId"
  | "recordStatus"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

export type InternalWorkOrderView = WorkOrder;

export type ClientWorkOrderView = ExternalEntityFields &
  Pick<
    WorkOrder,
    | "clientOrganizationId"
    | "locationId"
    | "requestedByUserId"
    | "title"
    | "description"
    | "status"
    | "priority"
    | "submittedAt"
    | "approvedAt"
    | "completedAt"
    | "closedAt"
  >;

export type ContractorWorkOrderView = ExternalEntityFields &
  Pick<
    WorkOrder,
    | "title"
    | "description"
    | "status"
    | "priority"
    | "submittedAt"
    | "completedAt"
    | "closedAt"
  >;

export type VisibleWorkOrder =
  | InternalWorkOrderView
  | ClientWorkOrderView
  | ContractorWorkOrderView;

export type InternalAssignmentView = Assignment;

export type ContractorAssignmentView = Pick<
  Assignment,
  | "id"
  | "organizationId"
  | "workOrderId"
  | "contractorOrganizationId"
  | "status"
  | "assignedAt"
  | "respondedAt"
  | "completedAt"
  | "notes"
  | "recordStatus"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

export type VisibleAssignment = InternalAssignmentView | ContractorAssignmentView;

export type InternalContractorQuoteView = ContractorQuote;

export type ContractorQuoteView = Pick<
  ContractorQuote,
  | "id"
  | "organizationId"
  | "workOrderId"
  | "contractorOrganizationId"
  | "quoteNumber"
  | "status"
  | "currencyCode"
  | "scopeOfWork"
  | "subtotalAmountCents"
  | "taxAmountCents"
  | "totalAmountCents"
  | "submittedAt"
  | "expiresAt"
  | "recordStatus"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

export type VisibleContractorQuote = InternalContractorQuoteView | ContractorQuoteView;

export type InternalClientQuoteView = ClientQuote;

export type ClientQuoteView = Pick<
  ClientQuote,
  | "id"
  | "organizationId"
  | "workOrderId"
  | "clientOrganizationId"
  | "locationId"
  | "quoteNumber"
  | "status"
  | "currencyCode"
  | "scopeOfWork"
  | "subtotalAmountCents"
  | "taxAmountCents"
  | "totalAmountCents"
  | "sentAt"
  | "respondedAt"
  | "expiresAt"
  | "recordStatus"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

export type VisibleClientQuote = InternalClientQuoteView | ClientQuoteView;

export type InternalInvoiceView = Invoice;

export type ClientInvoiceView = Pick<
  Invoice,
  | "id"
  | "organizationId"
  | "workOrderId"
  | "clientOrganizationId"
  | "locationId"
  | "clientQuoteId"
  | "invoiceNumber"
  | "status"
  | "currencyCode"
  | "subtotalAmountCents"
  | "taxAmountCents"
  | "totalAmountCents"
  | "issuedAt"
  | "dueAt"
  | "overdueAt"
  | "disputedAt"
  | "resolvedAt"
  | "paidAt"
  | "recordStatus"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

export type VisibleInvoice = InternalInvoiceView | ClientInvoiceView;

type WorkOrderStatusHistoryEntry = Extract<
  CoreWorkflowStatusHistoryEntry,
  { entityType: "WorkOrder" }
>;

export type ExternalWorkOrderHistoryEntry = Pick<
  WorkOrderStatusHistoryEntry,
  | "id"
  | "organizationId"
  | "entityType"
  | "entityId"
  | "action"
  | "occurredAt"
  | "previousStatus"
  | "newStatus"
>;

export type VisibleWorkOrderHistoryEntry =
  | CoreWorkflowStatusHistoryEntry
  | ExternalWorkOrderHistoryEntry;

export type ClientOrganizationView = Pick<
  ClientOrganization,
  | "id"
  | "organizationId"
  | "name"
  | "displayName"
  | "status"
  | "primaryContactEmail"
  | "primaryContactPhone"
  | "recordStatus"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

export type LocationView = Pick<
  Location,
  | "id"
  | "organizationId"
  | "clientOrganizationId"
  | "name"
  | "code"
  | "status"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "region"
  | "postalCode"
  | "countryCode"
  | "recordStatus"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

export type ContractorOrganizationView = Pick<
  ContractorOrganization,
  | "id"
  | "organizationId"
  | "name"
  | "displayName"
  | "status"
  | "primaryContactEmail"
  | "primaryContactPhone"
  | "recordStatus"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

export type UserProfileView = Pick<
  User,
  | "id"
  | "organizationId"
  | "email"
  | "displayName"
  | "roleCode"
  | "isActive"
  | "clientOrganizationId"
  | "contractorOrganizationId"
  | "locationId"
  | "recordStatus"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

export interface BillingRecordView {
  id: EntityId;
  organizationId: EntityId;
  workOrderId?: EntityId;
  clientOrganizationId?: EntityId;
  contractorOrganizationId?: EntityId;
  currencyCode: CurrencyCode;
  subtotalAmountCents: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents: MoneyAmountCents;
  issuedAt?: IsoDateTimeString;
  paidAt?: IsoDateTimeString;
}

export interface MarginMarkupView {
  workOrderId: EntityId;
  organizationId: EntityId;
  currencyCode: CurrencyCode;
  contractorCostAmountCents: MoneyAmountCents;
  clientSellAmountCents: MoneyAmountCents;
  marginAmountCents: MoneyAmountCents;
  markupPercent?: number;
}

export interface WorkOrderDataVisibilityBundle {
  workOrder: WorkOrder;
  assignments?: readonly Assignment[];
  contractorQuotes?: readonly ContractorQuote[];
  clientQuotes?: readonly ClientQuote[];
  invoices?: readonly Invoice[];
  history?: readonly CoreWorkflowStatusHistoryEntry[];
  internalNotes?: readonly Comment[];
  activityLogs?: readonly AnyActivityLogEntry[];
  clientOrganization?: ClientOrganization;
  location?: Location;
  contractorOrganizations?: readonly ContractorOrganization[];
  users?: readonly User[];
  billingRecords?: readonly BillingRecordView[];
  marginMarkup?: MarginMarkupView;
}

export interface VisibleWorkOrderDataBundle {
  workOrder: VisibleWorkOrder;
  assignments: VisibleAssignment[];
  contractorQuotes: VisibleContractorQuote[];
  clientQuotes: VisibleClientQuote[];
  invoices: VisibleInvoice[];
  history: VisibleWorkOrderHistoryEntry[];
  internalNotes: Comment[];
  activityLogs: AnyActivityLogEntry[];
  clientOrganization?: ClientOrganizationView;
  location?: LocationView;
  contractorOrganizations: ContractorOrganizationView[];
  users: UserProfileView[];
  billingRecords: BillingRecordView[];
  marginMarkup?: MarginMarkupView;
}

export function exposeWorkOrderDataBundle(
  actor: AccessActor,
  bundle: WorkOrderDataVisibilityBundle,
  context: AssignmentRelationshipContext = {},
): VisibleWorkOrderDataBundle | null {
  const relationshipContext = {
    assignments: [...(context.assignments ?? []), ...(bundle.assignments ?? [])],
  };

  const workOrder = exposeWorkOrder(actor, bundle.workOrder, relationshipContext);

  if (!workOrder) {
    return null;
  }

  return {
    workOrder,
    assignments: exposeAssignments(actor, bundle.assignments ?? []),
    contractorQuotes: exposeContractorQuotes(
      actor,
      bundle.contractorQuotes ?? [],
      relationshipContext,
    ),
    clientQuotes: exposeClientQuotes(actor, bundle.clientQuotes ?? []),
    invoices: exposeInvoices(actor, bundle.invoices ?? []),
    history: exposeWorkOrderHistory(
      actor,
      bundle.workOrder,
      bundle.history ?? [],
      relationshipContext,
    ),
    internalNotes: exposeInternalNotes(actor, bundle.internalNotes ?? []),
    activityLogs: exposeActivityLogs(actor, bundle.activityLogs ?? []),
    clientOrganization: bundle.clientOrganization
      ? exposeClientOrganization(actor, bundle.clientOrganization)
      : undefined,
    location: bundle.location ? exposeLocation(actor, bundle.location) : undefined,
    contractorOrganizations: exposeContractorOrganizations(
      actor,
      bundle.contractorOrganizations ?? [],
      bundle.assignments ?? [],
    ),
    users: exposeUsersWithinScope(actor, bundle.users ?? []),
    billingRecords: exposeBillingRecords(actor, bundle.billingRecords ?? []),
    marginMarkup: bundle.marginMarkup
      ? exposeMarginMarkup(actor, bundle.marginMarkup)
      : undefined,
  };
}

export function exposeWorkOrder(
  actor: AccessActor,
  workOrder: WorkOrder,
  context: AssignmentRelationshipContext = {},
): VisibleWorkOrder | null {
  if (!workOrderPolicyCanRead(actor, workOrder, context)) {
    return null;
  }

  if (actor.actorType === "internal") {
    return workOrder;
  }

  if (actor.actorType === "client") {
    return {
      id: workOrder.id,
      organizationId: workOrder.organizationId,
      clientOrganizationId: workOrder.clientOrganizationId,
      locationId: workOrder.locationId,
      requestedByUserId: workOrder.requestedByUserId,
      title: workOrder.title,
      description: workOrder.description,
      status: workOrder.status,
      priority: workOrder.priority,
      submittedAt: workOrder.submittedAt,
      approvedAt: workOrder.approvedAt,
      completedAt: workOrder.completedAt,
      closedAt: workOrder.closedAt,
      recordStatus: workOrder.recordStatus,
      isDeleted: workOrder.isDeleted,
      createdAt: workOrder.createdAt,
      updatedAt: workOrder.updatedAt,
    };
  }

  return {
    id: workOrder.id,
    organizationId: workOrder.organizationId,
    title: workOrder.title,
    description: workOrder.description,
    status: workOrder.status,
    priority: workOrder.priority,
    submittedAt: workOrder.submittedAt,
    completedAt: workOrder.completedAt,
    closedAt: workOrder.closedAt,
    recordStatus: workOrder.recordStatus,
    isDeleted: workOrder.isDeleted,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
  };
}

export function exposeAssignments(
  actor: AccessActor,
  assignments: readonly Assignment[],
): VisibleAssignment[] {
  return assignments.flatMap<VisibleAssignment>((assignment) => {
    if (!assignmentPolicy.canRead(actor, assignment)) {
      return [];
    }

    if (actor.actorType === "internal") {
      return [assignment];
    }

    if (actor.actorType !== "contractor") {
      return [];
    }

    return [
      {
        id: assignment.id,
        organizationId: assignment.organizationId,
        workOrderId: assignment.workOrderId,
        contractorOrganizationId: assignment.contractorOrganizationId,
        status: assignment.status,
        assignedAt: assignment.assignedAt,
        respondedAt: assignment.respondedAt,
        completedAt: assignment.completedAt,
        notes: assignment.notes,
        recordStatus: assignment.recordStatus,
        isDeleted: assignment.isDeleted,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      },
    ];
  });
}

export function exposeContractorQuotes(
  actor: AccessActor,
  contractorQuotes: readonly ContractorQuote[],
  context: AssignmentRelationshipContext = {},
): VisibleContractorQuote[] {
  return contractorQuotes.flatMap<VisibleContractorQuote>((contractorQuote) => {
    if (!contractorQuotePolicy.canRead(actor, contractorQuote, context)) {
      return [];
    }

    if (actor.actorType === "internal") {
      return [contractorQuote];
    }

    if (actor.actorType !== "contractor") {
      return [];
    }

    return [
      {
        id: contractorQuote.id,
        organizationId: contractorQuote.organizationId,
        workOrderId: contractorQuote.workOrderId,
        contractorOrganizationId: contractorQuote.contractorOrganizationId,
        quoteNumber: contractorQuote.quoteNumber,
        status: contractorQuote.status,
        currencyCode: contractorQuote.currencyCode,
        scopeOfWork: contractorQuote.scopeOfWork,
        subtotalAmountCents: contractorQuote.subtotalAmountCents,
        taxAmountCents: contractorQuote.taxAmountCents,
        totalAmountCents: contractorQuote.totalAmountCents,
        submittedAt: contractorQuote.submittedAt,
        expiresAt: contractorQuote.expiresAt,
        recordStatus: contractorQuote.recordStatus,
        isDeleted: contractorQuote.isDeleted,
        createdAt: contractorQuote.createdAt,
        updatedAt: contractorQuote.updatedAt,
      },
    ];
  });
}

export function exposeClientQuotes(
  actor: AccessActor,
  clientQuotes: readonly ClientQuote[],
): VisibleClientQuote[] {
  return clientQuotes.flatMap<VisibleClientQuote>((clientQuote) => {
    if (!clientQuotePolicy.canRead(actor, clientQuote)) {
      return [];
    }

    if (actor.actorType === "internal") {
      return [clientQuote];
    }

    if (actor.actorType !== "client") {
      return [];
    }

    return [
      {
        id: clientQuote.id,
        organizationId: clientQuote.organizationId,
        workOrderId: clientQuote.workOrderId,
        clientOrganizationId: clientQuote.clientOrganizationId,
        locationId: clientQuote.locationId,
        quoteNumber: clientQuote.quoteNumber,
        status: clientQuote.status,
        currencyCode: clientQuote.currencyCode,
        scopeOfWork: clientQuote.scopeOfWork,
        subtotalAmountCents: clientQuote.subtotalAmountCents,
        taxAmountCents: clientQuote.taxAmountCents,
        totalAmountCents: clientQuote.totalAmountCents,
        sentAt: clientQuote.sentAt,
        respondedAt: clientQuote.respondedAt,
        expiresAt: clientQuote.expiresAt,
        recordStatus: clientQuote.recordStatus,
        isDeleted: clientQuote.isDeleted,
        createdAt: clientQuote.createdAt,
        updatedAt: clientQuote.updatedAt,
      },
    ];
  });
}

export function exposeInvoices(
  actor: AccessActor,
  invoices: readonly Invoice[],
): VisibleInvoice[] {
  return invoices.flatMap<VisibleInvoice>((invoice) => {
    if (!invoicePolicy.canRead(actor, invoice)) {
      return [];
    }

    if (actor.actorType === "internal") {
      return [invoice];
    }

    if (actor.actorType !== "client") {
      return [];
    }

    return [
      {
        id: invoice.id,
        organizationId: invoice.organizationId,
        workOrderId: invoice.workOrderId,
        clientOrganizationId: invoice.clientOrganizationId,
        locationId: invoice.locationId,
        clientQuoteId: invoice.clientQuoteId,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        currencyCode: invoice.currencyCode,
        subtotalAmountCents: invoice.subtotalAmountCents,
        taxAmountCents: invoice.taxAmountCents,
        totalAmountCents: invoice.totalAmountCents,
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        overdueAt: invoice.overdueAt,
        disputedAt: invoice.disputedAt,
        resolvedAt: invoice.resolvedAt,
        paidAt: invoice.paidAt,
        recordStatus: invoice.recordStatus,
        isDeleted: invoice.isDeleted,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      },
    ];
  });
}

export function exposeWorkOrderHistory(
  actor: AccessActor,
  workOrder: WorkOrder,
  history: readonly CoreWorkflowStatusHistoryEntry[],
  context: AssignmentRelationshipContext = {},
): VisibleWorkOrderHistoryEntry[] {
  if (!workOrderPolicy.canRead(actor, workOrder, context)) {
    return [];
  }

  if (actor.actorType === "internal") {
    return history.filter(
      (entry) =>
        entry.entityType === "WorkOrder" &&
        entry.entityId === workOrder.id &&
        entry.organizationId === workOrder.organizationId,
    );
  }

  return history.flatMap((entry) => {
    if (
      entry.entityType === "WorkOrder" &&
      entry.entityId === workOrder.id &&
      actor.scope.organizationId === entry.organizationId
    ) {
      return [
        {
          id: entry.id,
          organizationId: entry.organizationId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          occurredAt: entry.occurredAt,
          previousStatus: entry.previousStatus,
          newStatus: entry.newStatus,
        },
      ];
    }

    return [];
  });
}

export function exposeInternalNotes(
  actor: AccessActor,
  internalNotes: readonly Comment[],
): Comment[] {
  return internalNotes.filter((note) =>
    internalNotePolicy.canRead(actor, { organizationId: note.organizationId }),
  );
}

export function exposeActivityLogs(
  actor: AccessActor,
  activityLogs: readonly AnyActivityLogEntry[],
): AnyActivityLogEntry[] {
  return activityLogs.filter((entry) =>
    activityLogPolicy.canRead(actor, { organizationId: entry.organizationId }),
  );
}

export function exposeClientOrganization(
  actor: AccessActor,
  clientOrganization: ClientOrganization,
): ClientOrganizationView | undefined {
  if (!clientOrganizationPolicy.canRead(actor, clientOrganization)) {
    return undefined;
  }

  return {
    id: clientOrganization.id,
    organizationId: clientOrganization.organizationId,
    name: clientOrganization.name,
    displayName: clientOrganization.displayName,
    status: clientOrganization.status,
    primaryContactEmail: clientOrganization.primaryContactEmail,
    primaryContactPhone: clientOrganization.primaryContactPhone,
    recordStatus: clientOrganization.recordStatus,
    isDeleted: clientOrganization.isDeleted,
    createdAt: clientOrganization.createdAt,
    updatedAt: clientOrganization.updatedAt,
  };
}

export function exposeLocation(
  actor: AccessActor,
  location: Location,
): LocationView | undefined {
  if (!locationPolicy.canRead(actor, location)) {
    return undefined;
  }

  return {
    id: location.id,
    organizationId: location.organizationId,
    clientOrganizationId: location.clientOrganizationId,
    name: location.name,
    code: location.code,
    status: location.status,
    addressLine1: location.addressLine1,
    addressLine2: location.addressLine2,
    city: location.city,
    region: location.region,
    postalCode: location.postalCode,
    countryCode: location.countryCode,
    recordStatus: location.recordStatus,
    isDeleted: location.isDeleted,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}

export function exposeContractorOrganizations(
  actor: AccessActor,
  contractorOrganizations: readonly ContractorOrganization[],
  assignments: readonly Assignment[] = [],
): ContractorOrganizationView[] {
  if (actor.actorType === "client") {
    return [];
  }

  const assignedContractorIds = new Set(
    assignments
      .filter((assignment) => assignmentPolicy.canRead(actor, assignment))
      .map((assignment) => assignment.contractorOrganizationId),
  );

  return contractorOrganizations.flatMap((contractorOrganization) => {
    const canRead =
      contractorOrganizationPolicy.canRead(actor, contractorOrganization) ||
      assignedContractorIds.has(contractorOrganization.id);

    if (!canRead) {
      return [];
    }

    return [
      {
        id: contractorOrganization.id,
        organizationId: contractorOrganization.organizationId,
        name: contractorOrganization.name,
        displayName: contractorOrganization.displayName,
        status: contractorOrganization.status,
        primaryContactEmail: contractorOrganization.primaryContactEmail,
        primaryContactPhone: contractorOrganization.primaryContactPhone,
        recordStatus: contractorOrganization.recordStatus,
        isDeleted: contractorOrganization.isDeleted,
        createdAt: contractorOrganization.createdAt,
        updatedAt: contractorOrganization.updatedAt,
      },
    ];
  });
}

export function exposeUsersWithinScope(
  actor: AccessActor,
  users: readonly User[],
): UserProfileView[] {
  return users.flatMap((user) => {
    if (!canReadUserProfile(actor, user)) {
      return [];
    }

    return [
      {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        displayName: user.displayName,
        roleCode: user.roleCode,
        isActive: user.isActive,
        clientOrganizationId: user.clientOrganizationId,
        contractorOrganizationId: user.contractorOrganizationId,
        locationId: user.locationId,
        recordStatus: user.recordStatus,
        isDeleted: user.isDeleted,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    ];
  });
}

export function canReadUserProfile(actor: AccessActor, user: User): boolean {
  if (actor.scope.organizationId !== user.organizationId) {
    return false;
  }

  if (actor.actorType === "internal") {
    return true;
  }

  if (actor.actorType === "client") {
    if (actor.scope.clientOrganizationId !== user.clientOrganizationId) {
      return false;
    }

    if (actor.scope.locationAccess.kind === "all_client_locations") {
      return true;
    }

    return Boolean(
      user.locationId &&
        actor.scope.locationAccess.locationIds.includes(user.locationId),
    );
  }

  return actor.scope.contractorOrganizationId === user.contractorOrganizationId;
}

export function exposeBillingRecords(
  actor: AccessActor,
  billingRecords: readonly BillingRecordView[],
): BillingRecordView[] {
  return billingRecords.filter((billingRecord) =>
    billingDataPolicy.canRead(actor, {
      organizationId: billingRecord.organizationId,
    }),
  );
}

export function exposeMarginMarkup(
  actor: AccessActor,
  marginMarkup: MarginMarkupView,
): MarginMarkupView | undefined {
  if (!canReadMarginMarkup(actor, marginMarkup.organizationId)) {
    return undefined;
  }

  return marginMarkup;
}

export function canReadMarginMarkup(
  actor: AccessActor,
  organizationId: EntityId,
): boolean {
  return canReadFinancialLayer(
    actor,
    organizationId,
    FINANCIAL_VISIBILITY_LAYERS.MarkupMargin,
  );
}

export function canReadContractorRawPricing(
  actor: AccessActor,
  organizationId: EntityId,
): boolean {
  return canReadFinancialLayer(
    actor,
    organizationId,
    FINANCIAL_VISIBILITY_LAYERS.ContractorRawPricing,
  );
}

export function canReadClientSellPrice(
  actor: AccessActor,
  organizationId: EntityId,
): boolean {
  return canReadFinancialLayer(
    actor,
    organizationId,
    FINANCIAL_VISIBILITY_LAYERS.ClientSellPrice,
  );
}

export function canReadFinancialLayer(
  actor: AccessActor,
  organizationId: EntityId,
  layer: FinancialVisibilityLayer,
): boolean {
  return (
    actor.scope.organizationId === organizationId &&
    roleCanViewFinancialLayer(actor.role, layer)
  );
}

export function exposePaymentStatus(
  actor: AccessActor,
  invoice: Invoice,
): Invoice["status"] | undefined {
  if (!paymentStatusPolicy.canRead(actor, invoice)) {
    return undefined;
  }

  return invoice.status;
}

function workOrderPolicyCanRead(
  actor: AccessActor,
  workOrder: WorkOrder,
  context: AssignmentRelationshipContext,
): boolean {
  return workOrderPolicy.canRead(actor, workOrder, context);
}
