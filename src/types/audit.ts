import type { UserRole } from "@/types/auth";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  ClientQuoteStatus,
  ContractorQuoteStatus,
  InvoiceStatus,
} from "@/types/financial";
import type { AssignmentStatus, WorkOrderStatus } from "@/types/work-order";

export type AuditEntityType =
  | "Role"
  | "User"
  | "ClientOrganization"
  | "Location"
  | "ContractorOrganization"
  | "WorkOrder"
  | "Assignment"
  | "ContractorQuote"
  | "ClientQuote"
  | "Invoice"
  | "Comment"
  | "Attachment";

export type CoreWorkflowEntityType =
  | "WorkOrder"
  | "Assignment"
  | "ContractorQuote"
  | "ClientQuote"
  | "Invoice";

export interface CoreWorkflowStatusByEntity {
  WorkOrder: WorkOrderStatus;
  Assignment: AssignmentStatus;
  ContractorQuote: ContractorQuoteStatus;
  ClientQuote: ClientQuoteStatus;
  Invoice: InvoiceStatus;
}

export interface AuditUserActor {
  actorType: "user";
  userId: EntityId;
  role?: UserRole;
  displayName?: string;
}

export interface AuditSystemActor {
  actorType: "system";
  systemId: string;
  displayName?: string;
}

export type AuditActor = AuditUserActor | AuditSystemActor;

export type AuditFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly AuditFieldValue[]
  | { readonly [key: string]: AuditFieldValue };

export type ChangedFieldType =
  | "text"
  | "number"
  | "boolean"
  | "date_time"
  | "status"
  | "relationship"
  | "money"
  | "structured";

export interface ChangedFieldSummary<FieldName extends string = string> {
  field: FieldName;
  fieldType: ChangedFieldType;
  previousValue?: AuditFieldValue;
  newValue?: AuditFieldValue;
  previousValueSummary?: string;
  newValueSummary?: string;
  isRedacted?: boolean;
}

export type WorkOrderAuditAction =
  | "work_order.created"
  | "work_order.updated"
  | "work_order.status_changed"
  | "work_order.submitted"
  | "work_order.assigned"
  | "work_order.approved"
  | "work_order.scheduled"
  | "work_order.completed"
  | "work_order.invoiced"
  | "work_order.closed"
  | "work_order.cancelled";

export type AssignmentAuditAction =
  | "assignment.created"
  | "assignment.updated"
  | "assignment.status_changed"
  | "assignment.accepted"
  | "assignment.declined"
  | "assignment.completed"
  | "assignment.cancelled";

export type ContractorQuoteAuditAction =
  | "contractor_quote.created"
  | "contractor_quote.updated"
  | "contractor_quote.status_changed"
  | "contractor_quote.submitted"
  | "contractor_quote.accepted"
  | "contractor_quote.rejected"
  | "contractor_quote.expired"
  | "contractor_quote.cancelled";

export type ClientQuoteAuditAction =
  | "client_quote.created"
  | "client_quote.updated"
  | "client_quote.status_changed"
  | "client_quote.sent"
  | "client_quote.approved"
  | "client_quote.rejected"
  | "client_quote.expired"
  | "client_quote.cancelled";

export type InvoiceAuditAction =
  | "invoice.created"
  | "invoice.updated"
  | "invoice.status_changed"
  | "invoice.issued"
  | "invoice.sent"
  | "invoice.overdue"
  | "invoice.disputed"
  | "invoice.resolved"
  | "invoice.paid"
  | "invoice.voided"
  | "invoice.cancelled";

export type OrganizationAuditAction =
  | "client_organization.created"
  | "client_organization.updated"
  | "client_organization.status_changed"
  | "location.created"
  | "location.updated"
  | "location.status_changed"
  | "contractor_organization.created"
  | "contractor_organization.updated"
  | "contractor_organization.status_changed";

export type AccessControlAuditAction =
  | "user.created"
  | "user.updated"
  | "user.deactivated"
  | "user.reactivated"
  | "user.role_changed"
  | "role.created"
  | "role.updated";

export type CollaborationAuditAction =
  | "comment.created"
  | "comment.updated"
  | "comment.deleted"
  | "attachment.created"
  | "attachment.updated"
  | "attachment.deleted";

export type ActivityLogAction =
  | WorkOrderAuditAction
  | AssignmentAuditAction
  | ContractorQuoteAuditAction
  | ClientQuoteAuditAction
  | InvoiceAuditAction
  | OrganizationAuditAction
  | AccessControlAuditAction
  | CollaborationAuditAction;

export interface ActivityLogActionByEntity {
  Role: Extract<AccessControlAuditAction, `role.${string}`>;
  User: Extract<AccessControlAuditAction, `user.${string}`>;
  ClientOrganization: Extract<
    OrganizationAuditAction,
    `client_organization.${string}`
  >;
  Location: Extract<OrganizationAuditAction, `location.${string}`>;
  ContractorOrganization: Extract<
    OrganizationAuditAction,
    `contractor_organization.${string}`
  >;
  WorkOrder: WorkOrderAuditAction;
  Assignment: AssignmentAuditAction;
  ContractorQuote: ContractorQuoteAuditAction;
  ClientQuote: ClientQuoteAuditAction;
  Invoice: InvoiceAuditAction;
  Comment: Extract<CollaborationAuditAction, `comment.${string}`>;
  Attachment: Extract<CollaborationAuditAction, `attachment.${string}`>;
}

export interface ActivityLogEntry<
  EntityType extends AuditEntityType = AuditEntityType,
  FieldName extends string = string,
> {
  id: EntityId;
  organizationId: EntityId;
  entityType: EntityType;
  entityId: EntityId;
  action: ActivityLogActionByEntity[EntityType];
  actor: AuditActor;
  occurredAt: IsoDateTimeString;
  changedFields?: readonly ChangedFieldSummary<FieldName>[];
  reason?: string;
  relatedActivityLogEntryId?: EntityId;
  relatedStatusHistoryEntryId?: EntityId;
  correlationId?: string;
}

export type AnyActivityLogEntry = {
  [EntityType in AuditEntityType]: ActivityLogEntry<EntityType>;
}[AuditEntityType];

export interface StatusHistoryActionByEntity {
  WorkOrder: Exclude<WorkOrderAuditAction, "work_order.updated">;
  Assignment: Exclude<AssignmentAuditAction, "assignment.updated">;
  ContractorQuote: Exclude<
    ContractorQuoteAuditAction,
    "contractor_quote.updated"
  >;
  ClientQuote: Exclude<ClientQuoteAuditAction, "client_quote.updated">;
  Invoice: Exclude<InvoiceAuditAction, "invoice.updated">;
}

export interface StatusHistoryEntry<
  EntityType extends CoreWorkflowEntityType = CoreWorkflowEntityType,
> {
  id: EntityId;
  organizationId: EntityId;
  entityType: EntityType;
  entityId: EntityId;
  action: StatusHistoryActionByEntity[EntityType];
  actor: AuditActor;
  occurredAt: IsoDateTimeString;
  previousStatus?: CoreWorkflowStatusByEntity[EntityType];
  newStatus: CoreWorkflowStatusByEntity[EntityType];
  reason?: string;
  activityLogEntryId?: EntityId;
}

export type CoreWorkflowStatusHistoryEntry = {
  [EntityType in CoreWorkflowEntityType]: StatusHistoryEntry<EntityType>;
}[CoreWorkflowEntityType];
