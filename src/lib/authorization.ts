import {
  activityLogPolicy,
  assignmentPolicy,
  billingDataPolicy,
  clientOrganizationPolicy,
  clientQuotePolicy,
  contractorOrganizationPolicy,
  contractorQuotePolicy,
  dashboardPolicy,
  internalNotePolicy,
  invoicePolicy,
  locationPolicy,
  paymentStatusPolicy,
  workOrderPolicy,
  type AssignmentAccessTarget,
  type AssignmentRelationshipContext,
  type BillingDataAccessTarget,
  type ClientOrganizationAccessTarget,
  type ContractorOrganizationAccessTarget,
  type ClientQuoteAccessTarget,
  type ContractorQuoteAccessTarget,
  type InternalOnlyTarget,
  type InvoiceAccessTarget,
  type LocationAccessTarget,
  type PaymentStatusAccessTarget,
  type TenantScopedTarget,
  type WorkOrderAccessTarget,
} from "@/lib/access-policy";
import {
  createAuthorizationAuditLogger,
  defaultSecurityAuditLogger,
} from "@/lib/audit-log";
import { getStatusTransitionDecision } from "@/lib/status-transitions";
import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";
import type {
  ClientQuote,
  ContractorQuote,
  Invoice,
} from "@/types/financial";
import type { PermissionEntity } from "@/types/permissions";
import { PERMISSION_ENTITIES } from "@/types/permissions";
import type { Assignment, WorkOrder } from "@/types/work-order";

export type AuthorizationAction =
  | "create"
  | "read"
  | "edit"
  | "update"
  | "submit"
  | "approve"
  | "reject"
  | "revise"
  | "reopen"
  | "issue_send"
  | "mark_paid"
  | "mark_overdue"
  | "dispute"
  | "resolve"
  | "transition";

export type AuthorizableEntity =
  | "work_order"
  | "assignment"
  | "contractor_quote"
  | "client_quote"
  | "invoice"
  | "client_organization"
  | "location"
  | "contractor_organization"
  | "activity_log"
  | "dashboard"
  | "internal_note"
  | "payment_status"
  | "billing_data";

export type AuthorizationAuditEventKind =
  | "approval"
  | "financial_control"
  | "override"
  | "quote_submission"
  | "reopen"
  | "unauthorized_attempt";

type TransitionStatusByEntity = {
  work_order: WorkOrder["status"];
  assignment: Assignment["status"];
  contractor_quote: ContractorQuote["status"];
  client_quote: ClientQuote["status"];
  invoice: Invoice["status"];
};

type TransitionEntity = keyof TransitionStatusByEntity;

type AuthorizationTargetByEntity = {
  work_order: WorkOrderAccessTarget;
  assignment: AssignmentAccessTarget;
  contractor_quote: ContractorQuoteAccessTarget;
  client_quote: ClientQuoteAccessTarget;
  invoice: InvoiceAccessTarget;
  client_organization: ClientOrganizationAccessTarget | TenantScopedTarget;
  location: LocationAccessTarget | TenantScopedTarget;
  contractor_organization: ContractorOrganizationAccessTarget | TenantScopedTarget;
  activity_log: InternalOnlyTarget;
  dashboard: InternalOnlyTarget;
  internal_note: InternalOnlyTarget;
  payment_status: PaymentStatusAccessTarget;
  billing_data: BillingDataAccessTarget;
};

type AuthorizationRequestByEntity = {
  [Entity in AuthorizableEntity]: {
    actor: AccessActor;
    entity: Entity;
    action: AuthorizationAction;
    target: AuthorizationTargetByEntity[Entity];
    context?: AssignmentRelationshipContext;
    nextStatus?: Entity extends TransitionEntity
      ? TransitionStatusByEntity[Entity]
      : never;
    reason?: string;
    correlationId?: string;
    logger?: AuthorizationAuditLogger;
  };
};

export type AuthorizationRequest =
  AuthorizationRequestByEntity[AuthorizableEntity];

export interface AuthorizationDecision {
  allowed: boolean;
  reason?: string;
  auditEvent?: AuthorizationAuditEvent;
}

export interface AuthorizationAuditEvent {
  eventType: "authorization";
  kind: AuthorizationAuditEventKind;
  action: AuthorizationAction;
  entity: AuthorizableEntity;
  permissionEntity?: PermissionEntity;
  targetEntityId?: EntityId;
  organizationId?: EntityId;
  actor: {
    actorType: AccessActor["actorType"];
    userId: EntityId;
    role: AccessActor["role"];
  };
  currentStatus?: string;
  nextStatus?: string;
  reason?: string;
  correlationId?: string;
}

export type AuthorizationAuditLogger = (
  event: AuthorizationAuditEvent,
) => void | Promise<void>;

export class AuthorizationError extends Error {
  readonly decision: AuthorizationDecision;

  constructor(decision: AuthorizationDecision) {
    super(decision.reason ?? "Unauthorized.");
    this.name = "AuthorizationError";
    this.decision = decision;
  }
}

export function getAuthorizationDecision(
  request: AuthorizationRequest,
): AuthorizationDecision {
  const allowed = canPerformAuthorizedAction(request);

  if (!allowed) {
    return {
      allowed: false,
      reason: getUnauthorizedReason(request),
      auditEvent: createAuthorizationAuditEvent(
        request,
        "unauthorized_attempt",
        getUnauthorizedReason(request),
      ),
    };
  }

  const auditKind = getAllowedAuditKind(request);

  return {
    allowed: true,
    auditEvent: auditKind
      ? createAuthorizationAuditEvent(request, auditKind, request.reason)
      : undefined,
  };
}

export function authorize(request: AuthorizationRequest): AuthorizationDecision {
  const decision = getAuthorizationDecision(request);
  logAuthorizationDecision(request, decision);
  return decision;
}

export function assertAuthorized(request: AuthorizationRequest): void {
  const decision = authorize(request);

  if (!decision.allowed) {
    throw new AuthorizationError(decision);
  }
}

function canPerformAuthorizedAction(request: AuthorizationRequest): boolean {
  switch (request.entity) {
    case "work_order":
      return canAccessWorkOrder(request);
    case "assignment":
      return canAccessAssignment(request);
    case "contractor_quote":
      return canAccessContractorQuote(request);
    case "client_quote":
      return canAccessClientQuote(request);
    case "invoice":
      return canAccessInvoice(request);
    case "client_organization":
      return canAccessClientOrganization(request);
    case "location":
      return canAccessLocation(request);
    case "contractor_organization":
      return canAccessContractorOrganization(request);
    case "activity_log":
      return canAccessActivityLog(request);
    case "dashboard":
      return canAccessDashboard(request);
    case "internal_note":
      return canAccessInternalNote(request);
    case "payment_status":
      return canAccessPaymentStatus(request);
    case "billing_data":
      return canAccessBillingData(request);
    default:
      return false;
  }
}

function canAccessWorkOrder(
  request: AuthorizationRequestByEntity["work_order"],
): boolean {
  switch (request.action) {
    case "create":
      return workOrderPolicy.canCreate(request.actor, request.target);
    case "read":
      return workOrderPolicy.canRead(
        request.actor,
        request.target,
        request.context,
      );
    case "edit":
    case "update":
      return workOrderPolicy.canUpdate(request.actor, request.target);
    case "approve":
      return workOrderPolicy.canApprove(request.actor, request.target);
    case "transition":
      return Boolean(
        request.nextStatus &&
          request.target.status &&
          workOrderPolicy.canTransitionTo(
            request.actor,
            request.target as WorkOrderAccessTarget & Pick<WorkOrder, "status">,
            request.nextStatus,
          ),
      );
    default:
      return false;
  }
}

function canAccessAssignment(
  request: AuthorizationRequestByEntity["assignment"],
): boolean {
  switch (request.action) {
    case "create":
      return assignmentPolicy.canCreate(request.actor, request.target);
    case "read":
      return assignmentPolicy.canRead(request.actor, request.target);
    case "edit":
    case "update":
      return assignmentPolicy.canUpdate(request.actor, request.target);
    case "approve":
      return assignmentPolicy.canApprove(request.actor, request.target);
    case "transition":
      return Boolean(
        request.nextStatus &&
          request.target.status &&
          assignmentPolicy.canTransitionTo(
            request.actor,
            request.target as AssignmentAccessTarget & Pick<Assignment, "status">,
            request.nextStatus,
          ),
      );
    default:
      return false;
  }
}

function canAccessContractorQuote(
  request: AuthorizationRequestByEntity["contractor_quote"],
): boolean {
  switch (request.action) {
    case "create":
      return contractorQuotePolicy.canCreate(
        request.actor,
        request.target,
        request.context,
      );
    case "read":
      return contractorQuotePolicy.canRead(
        request.actor,
        request.target,
        request.context,
      );
    case "edit":
    case "update":
      return contractorQuotePolicy.canUpdate(
        request.actor,
        request.target,
        request.context,
      );
    case "approve":
      return contractorQuotePolicy.canApprove(request.actor, request.target);
    case "submit":
      return contractorQuotePolicy.canSubmit(
        request.actor,
        request.target,
        request.context,
      );
    case "reject":
      return contractorQuotePolicy.canReject(request.actor, request.target);
    case "revise":
      return contractorQuotePolicy.canRevise(
        request.actor,
        request.target,
        request.context,
      );
    case "reopen":
      return contractorQuotePolicy.canReopen(request.actor, request.target);
    case "transition":
      return Boolean(
        request.nextStatus &&
          request.target.status &&
          contractorQuotePolicy.canTransitionTo(
            request.actor,
            request.target as ContractorQuoteAccessTarget &
              Pick<ContractorQuote, "status">,
            request.nextStatus,
            request.context,
          ),
      );
    default:
      return false;
  }
}

function canAccessClientQuote(
  request: AuthorizationRequestByEntity["client_quote"],
): boolean {
  switch (request.action) {
    case "create":
      return clientQuotePolicy.canCreate(request.actor, request.target);
    case "read":
      return clientQuotePolicy.canRead(request.actor, request.target);
    case "edit":
    case "update":
      return clientQuotePolicy.canUpdate(request.actor, request.target);
    case "approve":
      return clientQuotePolicy.canApprove(request.actor, request.target);
    case "submit":
      return clientQuotePolicy.canSubmit(request.actor, request.target);
    case "reject":
      return clientQuotePolicy.canReject(request.actor, request.target);
    case "revise":
      return clientQuotePolicy.canRevise(request.actor, request.target);
    case "reopen":
      return clientQuotePolicy.canReopen(request.actor, request.target);
    case "transition":
      return Boolean(
        request.nextStatus &&
          request.target.status &&
          clientQuotePolicy.canTransitionTo(
            request.actor,
            request.target as ClientQuoteAccessTarget & Pick<ClientQuote, "status">,
            request.nextStatus,
          ),
      );
    default:
      return false;
  }
}

function canAccessInvoice(
  request: AuthorizationRequestByEntity["invoice"],
): boolean {
  switch (request.action) {
    case "create":
      return invoicePolicy.canCreate(request.actor, request.target);
    case "read":
      return invoicePolicy.canRead(request.actor, request.target);
    case "edit":
    case "update":
      return invoicePolicy.canUpdate(request.actor, request.target);
    case "approve":
      return invoicePolicy.canApprove(request.actor, request.target);
    case "issue_send":
      return invoicePolicy.canIssueSend(request.actor, request.target);
    case "mark_paid":
      return invoicePolicy.canMarkPaid(request.actor, request.target);
    case "mark_overdue":
      return invoicePolicy.canMarkOverdue(request.actor, request.target);
    case "dispute":
      return invoicePolicy.canDispute(request.actor, request.target);
    case "resolve":
      return invoicePolicy.canResolve(request.actor, request.target);
    case "reopen":
      return invoicePolicy.canReopen(request.actor, request.target);
    case "transition":
      return Boolean(
        request.nextStatus &&
          request.target.status &&
          invoicePolicy.canTransitionTo(
            request.actor,
            request.target as InvoiceAccessTarget & Pick<Invoice, "status">,
            request.nextStatus,
          ),
      );
    default:
      return false;
  }
}

function canAccessClientOrganization(
  request: AuthorizationRequestByEntity["client_organization"],
): boolean {
  switch (request.action) {
    case "create":
      return clientOrganizationPolicy.canCreate(request.actor, request.target);
    case "read":
      return (
        "id" in request.target &&
        clientOrganizationPolicy.canRead(request.actor, request.target)
      );
    case "edit":
    case "update":
      return (
        "id" in request.target &&
        clientOrganizationPolicy.canUpdate(request.actor, request.target)
      );
    case "approve":
      return (
        "id" in request.target &&
        clientOrganizationPolicy.canApprove(request.actor, request.target)
      );
    case "transition":
      return (
        "id" in request.target &&
        clientOrganizationPolicy.canTransition(request.actor, request.target)
      );
    default:
      return false;
  }
}

function canAccessLocation(
  request: AuthorizationRequestByEntity["location"],
): boolean {
  switch (request.action) {
    case "create":
      return locationPolicy.canCreate(request.actor, request.target);
    case "read":
      return "id" in request.target && locationPolicy.canRead(request.actor, request.target);
    case "edit":
    case "update":
      return "id" in request.target && locationPolicy.canUpdate(request.actor, request.target);
    case "approve":
      return "id" in request.target && locationPolicy.canApprove(request.actor, request.target);
    case "transition":
      return "id" in request.target && locationPolicy.canTransition(request.actor, request.target);
    default:
      return false;
  }
}

function canAccessContractorOrganization(
  request: AuthorizationRequestByEntity["contractor_organization"],
): boolean {
  switch (request.action) {
    case "create":
      return contractorOrganizationPolicy.canCreate(request.actor, request.target);
    case "read":
      return (
        "id" in request.target &&
        contractorOrganizationPolicy.canRead(request.actor, request.target)
      );
    case "edit":
    case "update":
      return (
        "id" in request.target &&
        contractorOrganizationPolicy.canUpdate(request.actor, request.target)
      );
    case "approve":
      return (
        "id" in request.target &&
        contractorOrganizationPolicy.canApprove(request.actor, request.target)
      );
    case "transition":
      return (
        "id" in request.target &&
        contractorOrganizationPolicy.canTransition(request.actor, request.target)
      );
    default:
      return false;
  }
}

function canAccessActivityLog(
  request: AuthorizationRequestByEntity["activity_log"],
): boolean {
  switch (request.action) {
    case "create":
      return activityLogPolicy.canCreate(request.actor, request.target);
    case "read":
      return activityLogPolicy.canRead(request.actor, request.target);
    case "edit":
    case "update":
      return activityLogPolicy.canUpdate(request.actor, request.target);
    case "approve":
      return activityLogPolicy.canApprove(request.actor, request.target);
    case "transition":
      return activityLogPolicy.canTransition(request.actor, request.target);
    default:
      return false;
  }
}

function canAccessDashboard(
  request: AuthorizationRequestByEntity["dashboard"],
): boolean {
  switch (request.action) {
    case "read":
      return dashboardPolicy.canRead(request.actor, request.target);
    default:
      return false;
  }
}

function canAccessInternalNote(
  request: AuthorizationRequestByEntity["internal_note"],
): boolean {
  switch (request.action) {
    case "create":
      return internalNotePolicy.canCreate(request.actor, request.target);
    case "read":
      return internalNotePolicy.canRead(request.actor, request.target);
    case "edit":
    case "update":
      return internalNotePolicy.canUpdate(request.actor, request.target);
    case "approve":
      return internalNotePolicy.canApprove(request.actor, request.target);
    case "transition":
      return internalNotePolicy.canTransition(request.actor, request.target);
    default:
      return false;
  }
}

function canAccessPaymentStatus(
  request: AuthorizationRequestByEntity["payment_status"],
): boolean {
  switch (request.action) {
    case "create":
      return paymentStatusPolicy.canCreate(request.actor, request.target);
    case "read":
      return paymentStatusPolicy.canRead(request.actor, request.target);
    case "edit":
    case "update":
      return paymentStatusPolicy.canUpdate(request.actor, request.target);
    case "approve":
      return paymentStatusPolicy.canApprove(request.actor, request.target);
    case "transition":
      return paymentStatusPolicy.canTransition(request.actor, request.target);
    default:
      return false;
  }
}

function canAccessBillingData(
  request: AuthorizationRequestByEntity["billing_data"],
): boolean {
  switch (request.action) {
    case "create":
      return billingDataPolicy.canCreate(request.actor, request.target);
    case "read":
      return billingDataPolicy.canRead(request.actor, request.target);
    case "edit":
    case "update":
      return billingDataPolicy.canUpdate(request.actor, request.target);
    case "approve":
      return billingDataPolicy.canApprove(request.actor, request.target);
    case "transition":
      return billingDataPolicy.canTransition(request.actor, request.target);
    default:
      return false;
  }
}

function getAllowedAuditKind(
  request: AuthorizationRequest,
): AuthorizationAuditEventKind | undefined {
  if (request.action === "submit") {
    return "quote_submission";
  }

  if (request.action === "approve" || request.action === "resolve") {
    return "approval";
  }

  if (
    request.action === "issue_send" ||
    request.action === "mark_paid" ||
    request.action === "mark_overdue" ||
    request.action === "dispute"
  ) {
    return "financial_control";
  }

  if (request.action === "reopen") {
    return "reopen";
  }

  if (!isTransitionRequest(request) || !request.target.status || !request.nextStatus) {
    return undefined;
  }

  const decision = getStatusTransitionDecision(
    request.entity,
    request.target.status,
    request.nextStatus,
    request.actor.role,
  );

  if (!decision.allowed || !decision.rule) {
    return undefined;
  }

  if (decision.rule.kind === "override") {
    return "override";
  }

  if (decision.rule.kind === "reopen") {
    return "reopen";
  }

  if (
    decision.rule.kind === "quote_approval" ||
    decision.rule.kind === "invoice_issuance" ||
    decision.rule.kind === "payment_completion"
  ) {
    return "approval";
  }

  return undefined;
}

function createAuthorizationAuditEvent(
  request: AuthorizationRequest,
  kind: AuthorizationAuditEventKind,
  reason?: string,
): AuthorizationAuditEvent {
  return {
    eventType: "authorization",
    kind,
    action: request.action,
    entity: request.entity,
    permissionEntity: permissionEntityByAuthorizationEntity[request.entity],
    targetEntityId: getTargetEntityId(request.target),
    organizationId: request.target.organizationId,
    actor: {
      actorType: request.actor.actorType,
      userId: request.actor.userId,
      role: request.actor.role,
    },
    currentStatus: isTransitionRequest(request)
      ? request.target.status
      : undefined,
    nextStatus: isTransitionRequest(request)
      ? request.nextStatus
      : undefined,
    reason,
    correlationId: request.correlationId,
  };
}

function getUnauthorizedReason(request: AuthorizationRequest): string {
  if (request.action === "transition" && isTransitionRequest(request)) {
    if (!request.target.status || !request.nextStatus) {
      return "State-aware transition authorization requires current and next status.";
    }

    const decision = getStatusTransitionDecision(
      request.entity,
      request.target.status,
      request.nextStatus,
      request.actor.role,
    );

    return decision.reason ?? "Transition is not authorized for this actor and scope.";
  }

  return "Action is not authorized for this actor, entity, and scope.";
}

function logAuthorizationDecision(
  request: AuthorizationRequest,
  decision: AuthorizationDecision,
): void {
  if (!decision.auditEvent) {
    return;
  }

  if (request.logger) {
    void request.logger(decision.auditEvent);
    return;
  }

  createAuthorizationAuditLogger(defaultSecurityAuditLogger)(decision.auditEvent);
}

function isTransitionRequest(
  request: AuthorizationRequest,
): request is AuthorizationRequestByEntity[TransitionEntity] {
  return (
    request.action === "transition" &&
    (request.entity === "work_order" ||
      request.entity === "assignment" ||
      request.entity === "contractor_quote" ||
      request.entity === "client_quote" ||
      request.entity === "invoice")
  );
}

function getTargetEntityId(target: AuthorizationRequest["target"]): EntityId | undefined {
  return "id" in target ? target.id : undefined;
}

const permissionEntityByAuthorizationEntity = {
  work_order: PERMISSION_ENTITIES.WorkOrders,
  assignment: PERMISSION_ENTITIES.Assignments,
  contractor_quote: PERMISSION_ENTITIES.ContractorQuotes,
  client_quote: PERMISSION_ENTITIES.ClientFacingQuotes,
  invoice: PERMISSION_ENTITIES.Invoices,
  client_organization: PERMISSION_ENTITIES.ClientOrganizations,
  location: PERMISSION_ENTITIES.Locations,
  contractor_organization: PERMISSION_ENTITIES.Contractors,
  activity_log: PERMISSION_ENTITIES.ActivityLogs,
  dashboard: PERMISSION_ENTITIES.DashboardAccess,
  internal_note: PERMISSION_ENTITIES.InternalNotes,
  payment_status: PERMISSION_ENTITIES.PaymentStatus,
  billing_data: PERMISSION_ENTITIES.BillingData,
} as const satisfies Record<AuthorizableEntity, PermissionEntity>;
