import type { EntityId } from "@/types/entity";
import type {
  ClientQuote,
  ClientQuoteOwnershipReference,
  ContractorQuote,
  ContractorQuoteOwnershipReference,
} from "@/types/quote";
import type {
  ClientInvoice as Invoice,
  InvoiceOwnershipReference,
} from "@/types/invoice";
import type { ClientOrganization } from "@/types/client-organization";
import type { ContractorOrganization } from "@/types/contractor";
import type { Location } from "@/types/location";
import type {
  Assignment,
  AssignmentOwnershipReference,
  WorkOrder,
  WorkOrderOwnershipReference,
} from "@/types/work-order";

type EntityWithTenant = {
  id: EntityId;
  organizationId: EntityId;
};

type RelationshipEntity<T extends EntityWithTenant> = Pick<
  T,
  "id" | "organizationId"
>;

type RelationshipWorkOrder = RelationshipEntity<WorkOrder> &
  WorkOrderOwnershipReference;

type RelationshipLocation = RelationshipEntity<Location> &
  Pick<Location, "clientOrganizationId">;

type RelationshipAssignment = RelationshipEntity<Assignment> &
  AssignmentOwnershipReference;

type RelationshipContractorQuote = RelationshipEntity<ContractorQuote> &
  ContractorQuoteOwnershipReference;

type RelationshipClientQuote = RelationshipEntity<ClientQuote> &
  ClientQuoteOwnershipReference &
  Pick<ClientQuote, "sourceContractorQuoteId">;

type RelationshipInvoice = RelationshipEntity<Invoice> &
  InvoiceOwnershipReference;

export interface CoreRelationshipGraph {
  clientOrganizations: Array<RelationshipEntity<ClientOrganization>>;
  locations: RelationshipLocation[];
  contractorOrganizations: Array<RelationshipEntity<ContractorOrganization>>;
  workOrders: RelationshipWorkOrder[];
  assignments?: RelationshipAssignment[];
  contractorQuotes?: RelationshipContractorQuote[];
  clientQuotes?: RelationshipClientQuote[];
  invoices?: RelationshipInvoice[];
}

export interface RelationshipIntegrityIssue {
  entityType:
    | "WorkOrder"
    | "Location"
    | "Assignment"
    | "ContractorQuote"
    | "ClientQuote"
    | "Invoice";
  entityId: EntityId;
  field: string;
  message: string;
}

export function validateCoreRelationshipIntegrity(
  graph: CoreRelationshipGraph,
): RelationshipIntegrityIssue[] {
  const issues: RelationshipIntegrityIssue[] = [];
  const clientOrganizations = indexById(graph.clientOrganizations);
  const locations = indexById(graph.locations);
  const contractorOrganizations = indexById(graph.contractorOrganizations);
  const workOrders = indexById(graph.workOrders);
  const contractorQuotes = indexById(graph.contractorQuotes ?? []);
  const clientQuotes = indexById(graph.clientQuotes ?? []);

  for (const location of graph.locations) {
    const clientOrganization = clientOrganizations.get(location.clientOrganizationId);

    if (!clientOrganization) {
      issues.push({
        entityType: "Location",
        entityId: location.id,
        field: "clientOrganizationId",
        message: "Location must belong to an existing ClientOrganization.",
      });
      continue;
    }

    if (location.organizationId !== clientOrganization.organizationId) {
      issues.push({
        entityType: "Location",
        entityId: location.id,
        field: "organizationId",
        message:
          "Location organizationId must match its ClientOrganization organizationId.",
      });
    }
  }

  for (const workOrder of graph.workOrders) {
    validateWorkOrderOwnership(workOrder, clientOrganizations, locations, issues);
  }

  for (const assignment of graph.assignments ?? []) {
    const workOrder = workOrders.get(assignment.workOrderId);
    const contractorOrganization = contractorOrganizations.get(
      assignment.contractorOrganizationId,
    );

    if (!workOrder) {
      issues.push({
        entityType: "Assignment",
        entityId: assignment.id,
        field: "workOrderId",
        message: "Assignment must belong to an existing WorkOrder.",
      });
    }

    if (!contractorOrganization) {
      issues.push({
        entityType: "Assignment",
        entityId: assignment.id,
        field: "contractorOrganizationId",
        message:
          "Assignment must belong to an existing ContractorOrganization.",
      });
    }

    validateTenantMatch("Assignment", assignment, workOrder, issues);
    validateTenantMatch(
      "Assignment",
      assignment,
      contractorOrganization,
      issues,
    );
  }

  for (const contractorQuote of graph.contractorQuotes ?? []) {
    const workOrder = workOrders.get(contractorQuote.workOrderId);
    const contractorOrganization =
      contractorQuote.contractorOrganizationId == null
        ? undefined
        : contractorOrganizations.get(contractorQuote.contractorOrganizationId);

    if (!workOrder) {
      issues.push({
        entityType: "ContractorQuote",
        entityId: contractorQuote.id,
        field: "workOrderId",
        message: "ContractorQuote must belong to an existing WorkOrder.",
      });
    }

    if (!contractorOrganization) {
      issues.push({
        entityType: "ContractorQuote",
        entityId: contractorQuote.id,
        field: "contractorOrganizationId",
        message:
          "ContractorQuote must belong to an existing ContractorOrganization.",
      });
    }

    validateTenantMatch("ContractorQuote", contractorQuote, workOrder, issues);
    validateTenantMatch(
      "ContractorQuote",
      contractorQuote,
      contractorOrganization,
      issues,
    );
  }

  for (const clientQuote of graph.clientQuotes ?? []) {
    const workOrder = workOrders.get(clientQuote.workOrderId);
    const contractorQuote = clientQuote.sourceContractorQuoteId
      ? contractorQuotes.get(clientQuote.sourceContractorQuoteId)
      : undefined;

    if (!workOrder) {
      issues.push({
        entityType: "ClientQuote",
        entityId: clientQuote.id,
        field: "workOrderId",
        message: "ClientQuote must belong to an existing WorkOrder.",
      });
    }

    if (workOrder) {
      validateWorkOrderChildOwnership(
        "ClientQuote",
        clientQuote,
        workOrder,
        issues,
      );
    }

    if (clientQuote.sourceContractorQuoteId) {
      validateClientQuoteContractorQuoteOwnership(
        clientQuote,
        contractorQuote,
        issues,
      );
    }
  }

  for (const invoice of graph.invoices ?? []) {
    const workOrder = workOrders.get(invoice.workOrderId);
    const clientOrganization = clientOrganizations.get(invoice.clientOrganizationId);

    if (!workOrder) {
      issues.push({
        entityType: "Invoice",
        entityId: invoice.id,
        field: "workOrderId",
        message: "Invoice must belong to an existing WorkOrder.",
      });
    }

    if (!clientOrganization) {
      issues.push({
        entityType: "Invoice",
        entityId: invoice.id,
        field: "clientOrganizationId",
        message: "Invoice must belong to an existing ClientOrganization.",
      });
    }

    if (workOrder) {
      validateWorkOrderChildOwnership("Invoice", invoice, workOrder, issues);
    }
  }

  return issues;
}

export function assertCoreRelationshipIntegrity(
  graph: CoreRelationshipGraph,
): void {
  const issues = validateCoreRelationshipIntegrity(graph);

  if (issues.length > 0) {
    throw new Error(
      issues
        .map(
          (issue) =>
            `${issue.entityType}(${issue.entityId}).${issue.field}: ${issue.message}`,
        )
        .join("\n"),
    );
  }
}

function validateWorkOrderOwnership(
  workOrder: RelationshipWorkOrder,
  clientOrganizations: Map<EntityId, RelationshipEntity<ClientOrganization>>,
  locations: Map<EntityId, RelationshipLocation>,
  issues: RelationshipIntegrityIssue[],
): void {
  const clientOrganization = clientOrganizations.get(workOrder.clientOrganizationId);
  const location = locations.get(workOrder.locationId);

  if (!clientOrganization) {
    issues.push({
      entityType: "WorkOrder",
      entityId: workOrder.id,
      field: "clientOrganizationId",
      message: "WorkOrder must belong to an existing ClientOrganization.",
    });
  }

  if (!location) {
    issues.push({
      entityType: "WorkOrder",
      entityId: workOrder.id,
      field: "locationId",
      message: "WorkOrder must belong to an existing Location.",
    });
    return;
  }

  if (location.clientOrganizationId !== workOrder.clientOrganizationId) {
    issues.push({
      entityType: "WorkOrder",
      entityId: workOrder.id,
      field: "locationId",
      message:
        "WorkOrder locationId must belong to the same ClientOrganization as the WorkOrder.",
    });
  }

  validateTenantMatch("WorkOrder", workOrder, clientOrganization, issues);
  validateTenantMatch("WorkOrder", workOrder, location, issues);
}

function validateWorkOrderChildOwnership(
  entityType: "ClientQuote" | "Invoice",
  entity: RelationshipClientQuote | RelationshipInvoice,
  workOrder: RelationshipWorkOrder,
  issues: RelationshipIntegrityIssue[],
): void {
  if (entity.clientOrganizationId !== workOrder.clientOrganizationId) {
    issues.push({
      entityType,
      entityId: entity.id,
      field: "clientOrganizationId",
      message:
        `${entityType} clientOrganizationId must match its WorkOrder clientOrganizationId.`,
    });
  }

  if (entity.locationId !== workOrder.locationId) {
    issues.push({
      entityType,
      entityId: entity.id,
      field: "locationId",
      message: `${entityType} locationId must match its WorkOrder locationId.`,
    });
  }

  validateTenantMatch(entityType, entity, workOrder, issues);
}

function validateClientQuoteContractorQuoteOwnership(
  clientQuote: RelationshipClientQuote,
  contractorQuote: RelationshipContractorQuote | undefined,
  issues: RelationshipIntegrityIssue[],
): void {
  if (!contractorQuote) {
    issues.push({
      entityType: "ClientQuote",
      entityId: clientQuote.id,
      field: "sourceContractorQuoteId",
      message:
        "ClientQuote sourceContractorQuoteId must reference an existing ContractorQuote.",
    });
    return;
  }

  if (clientQuote.workOrderId !== contractorQuote.workOrderId) {
    issues.push({
      entityType: "ClientQuote",
      entityId: clientQuote.id,
      field: "sourceContractorQuoteId",
      message:
        "ClientQuote sourceContractorQuoteId must belong to the same WorkOrder as the ClientQuote.",
    });
  }

  validateTenantMatch("ClientQuote", clientQuote, contractorQuote, issues);
}

function validateTenantMatch(
  entityType: RelationshipIntegrityIssue["entityType"],
  entity: EntityWithTenant,
  relatedEntity: EntityWithTenant | undefined,
  issues: RelationshipIntegrityIssue[],
): void {
  if (!relatedEntity || entity.organizationId === relatedEntity.organizationId) {
    return;
  }

  issues.push({
    entityType,
    entityId: entity.id,
    field: "organizationId",
    message: "Related records must share the same organizationId.",
  });
}

function indexById<T extends { id: EntityId }>(items: T[]): Map<EntityId, T> {
  return new Map(items.map((item) => [item.id, item]));
}
