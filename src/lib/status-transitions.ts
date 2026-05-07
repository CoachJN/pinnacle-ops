import type {
  ClientQuoteStatus,
  ContractorQuoteStatus,
} from "../types/quote";
import type { InvoiceStatus } from "../types/invoice";
import { authorizeLifecycleTransition } from "./workflows/rbac-transition/index.ts";
import {
  applyInvoiceTransition,
  applyQuoteTransition,
  applyWorkOrderTransition,
  type LifecycleTransitionRepositories,
  type TransitionApplyResult,
} from "./workflows/transition-service/index.ts";
import {
  PERMISSION_ENTITIES,
  USER_ROLES,
  roleCanAccessEntity,
  type PermissionEntity,
  type UserRole,
} from "../types/permissions.ts";
import type { AssignmentStatus, WorkOrderStatus } from "../types/work-order.ts";

// Legacy RBAC transition helper.
//
// Phase 2 lifecycle status legality is centralized in
// "@/lib/workflows/transition-engine". This module still gates legacy lowercase
// app status models with role checks for existing authorization callers; do not
// add new work-order, quote, or invoice lifecycle legality rules here.
type StatusTransitionMap = {
  work_order: WorkOrderStatus;
  assignment: AssignmentStatus;
  contractor_quote: ContractorQuoteStatus;
  client_quote: ClientQuoteStatus;
  invoice: InvoiceStatus;
};

export type StatusTransitionEntity = keyof StatusTransitionMap;

export type StatusTransitionKind =
  | "standard"
  | "operational_completion"
  | "quote_approval"
  | "invoice_issuance"
  | "payment_completion"
  | "payment_overdue"
  | "invoice_dispute"
  | "invoice_resolution"
  | "reopen"
  | "override";

export interface StatusTransitionRule<
  TEntity extends StatusTransitionEntity = StatusTransitionEntity,
> {
  entity: TEntity;
  from: StatusTransitionMap[TEntity];
  to: StatusTransitionMap[TEntity];
  roles: readonly UserRole[];
  kind: StatusTransitionKind;
  description: string;
}

export interface StatusTransitionDecision<
  TEntity extends StatusTransitionEntity = StatusTransitionEntity,
> {
  allowed: boolean;
  entity: TEntity;
  from: StatusTransitionMap[TEntity];
  to: StatusTransitionMap[TEntity];
  role: UserRole;
  rule?: StatusTransitionRule<TEntity>;
  reason?: string;
}

export interface StatusLockDecision {
  locked: boolean;
  reason?: string;
  overrideRoles: readonly UserRole[];
}

export interface ApplyStatusTransitionInput<TEntity extends StatusTransitionEntity> {
  readonly entity: TEntity;
  readonly entityId: string;
  readonly to: StatusTransitionMap[TEntity] | string;
  readonly actorType: "USER" | "SYSTEM" | string;
  readonly role?: UserRole | string | null;
  readonly actorUserId?: string;
  readonly repositories?: LifecycleTransitionRepositories;
  readonly contextOverrides?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type StatusTransitionApplyResult =
  | TransitionApplyResult<"work-order">
  | TransitionApplyResult<"invoice">
  | TransitionApplyResult<"quote">;

const coordinatorOperationsRoles = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

const managerOverrideRoles = [
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

const ownerOverrideRoles = [
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

const contractorDraftRoles = [
  USER_ROLES.ContractorUser,
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

const contractorAssignmentRoles = [
  USER_ROLES.ContractorUser,
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

const clientApprovalRoles = [
  USER_ROLES.ClientUser,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

const clientQuoteControlRoles = [
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

const financeRoles = [
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

const invoiceDisputeRoles = [
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
  USER_ROLES.ClientUser,
] as const satisfies readonly UserRole[];

export const WORK_ORDER_TRANSITION_RULES = [
  workOrderRule("new", "triage", coordinatorOperationsRoles, "standard"),
  workOrderRule("triage", "assigned", coordinatorOperationsRoles, "standard"),
  workOrderRule("triage", "quote_required", coordinatorOperationsRoles, "standard"),
  workOrderRule("triage", "cancelled", managerOverrideRoles, "override"),
  workOrderRule("assigned", "awaiting_contractor_response", coordinatorOperationsRoles, "standard"),
  workOrderRule("assigned", "contractor_scheduled", coordinatorOperationsRoles, "standard"),
  workOrderRule("assigned", "quote_required", coordinatorOperationsRoles, "standard"),
  workOrderRule("awaiting_contractor_response", "assigned", coordinatorOperationsRoles, "reopen"),
  workOrderRule("awaiting_contractor_response", "contractor_scheduled", coordinatorOperationsRoles, "standard"),
  workOrderRule("quote_required", "contractor_quote_received", contractorAssignmentRoles, "standard"),
  workOrderRule("contractor_quote_received", "quote_under_review", managerOverrideRoles, "standard"),
  workOrderRule("quote_under_review", "client_approval_requested", managerOverrideRoles, "standard"),
  workOrderRule("quote_under_review", "quote_required", managerOverrideRoles, "reopen"),
  workOrderRule("client_approval_requested", "client_approved", clientApprovalRoles, "quote_approval"),
  workOrderRule("client_approval_requested", "quote_required", managerOverrideRoles, "reopen"),
  workOrderRule("client_approved", "assigned", coordinatorOperationsRoles, "standard"),
  workOrderRule("client_approved", "contractor_scheduled", coordinatorOperationsRoles, "standard"),
  workOrderRule("contractor_scheduled", "in_progress", contractorAssignmentRoles, "standard"),
  workOrderRule("in_progress", "work_completed", coordinatorOperationsRoles, "operational_completion"),
  workOrderRule("work_completed", "completion_review", managerOverrideRoles, "standard"),
  workOrderRule("completion_review", "ready_for_invoicing", managerOverrideRoles, "invoice_issuance"),
  workOrderRule("completion_review", "assigned", managerOverrideRoles, "reopen"),
  workOrderRule("ready_for_invoicing", "invoiced", financeRoles, "invoice_issuance"),
  workOrderRule("invoiced", "paid", financeRoles, "payment_completion"),
  workOrderRule("paid", "closed", financeRoles, "payment_completion"),
  ...([
    "triage",
    "assigned",
    "awaiting_contractor_response",
    "quote_required",
    "contractor_quote_received",
    "quote_under_review",
    "client_approval_requested",
    "client_approved",
    "contractor_scheduled",
    "in_progress",
    "work_completed",
    "completion_review",
    "ready_for_invoicing",
    "invoiced",
    "on_hold",
    "escalated",
  ] as const).map((status) =>
    workOrderRule(status, "cancelled", managerOverrideRoles, "override"),
  ),
] as const satisfies readonly StatusTransitionRule<"work_order">[];

export const ASSIGNMENT_TRANSITION_RULES = [
  assignmentRule("assigned", "accepted", contractorAssignmentRoles, "standard"),
  assignmentRule("assigned", "declined", contractorAssignmentRoles, "standard"),
  assignmentRule("assigned", "cancelled", coordinatorOperationsRoles, "standard"),
  assignmentRule("accepted", "completed", contractorAssignmentRoles, "standard"),
  assignmentRule("accepted", "cancelled", managerOverrideRoles, "override"),
  assignmentRule("declined", "assigned", managerOverrideRoles, "reopen"),
  assignmentRule("cancelled", "assigned", ownerOverrideRoles, "override"),
  assignmentRule("completed", "accepted", managerOverrideRoles, "reopen"),
] as const satisfies readonly StatusTransitionRule<"assignment">[];

export const CONTRACTOR_QUOTE_TRANSITION_RULES = [
  contractorQuoteRule("draft", "submitted", contractorDraftRoles, "standard"),
  contractorQuoteRule("draft", "cancelled", contractorDraftRoles, "standard"),
  contractorQuoteRule(
    "submitted",
    "accepted",
    managerOverrideRoles,
    "quote_approval",
  ),
  contractorQuoteRule("submitted", "rejected", managerOverrideRoles, "standard"),
  contractorQuoteRule("submitted", "expired", coordinatorOperationsRoles, "standard"),
  contractorQuoteRule("submitted", "cancelled", managerOverrideRoles, "override"),
  contractorQuoteRule("accepted", "submitted", managerOverrideRoles, "reopen"),
  contractorQuoteRule("rejected", "submitted", managerOverrideRoles, "reopen"),
  contractorQuoteRule("expired", "submitted", managerOverrideRoles, "reopen"),
  contractorQuoteRule("cancelled", "draft", ownerOverrideRoles, "override"),
] as const satisfies readonly StatusTransitionRule<"contractor_quote">[];

export const CLIENT_QUOTE_TRANSITION_RULES = [
  clientQuoteRule("draft", "sent", clientQuoteControlRoles, "standard"),
  clientQuoteRule("draft", "cancelled", clientQuoteControlRoles, "standard"),
  clientQuoteRule("sent", "approved", clientApprovalRoles, "quote_approval"),
  clientQuoteRule("sent", "rejected", clientApprovalRoles, "standard"),
  clientQuoteRule("sent", "expired", clientQuoteControlRoles, "standard"),
  clientQuoteRule("sent", "cancelled", managerOverrideRoles, "override"),
  clientQuoteRule("approved", "sent", managerOverrideRoles, "reopen"),
  clientQuoteRule("rejected", "sent", managerOverrideRoles, "reopen"),
  clientQuoteRule("expired", "sent", managerOverrideRoles, "reopen"),
  clientQuoteRule("cancelled", "draft", ownerOverrideRoles, "override"),
] as const satisfies readonly StatusTransitionRule<"client_quote">[];

export const INVOICE_TRANSITION_RULES = [
  invoiceRule("draft", "issued", financeRoles, "invoice_issuance"),
  invoiceRule("draft", "cancelled", financeRoles, "standard"),
  invoiceRule("issued", "sent", financeRoles, "standard"),
  invoiceRule("issued", "overdue", financeRoles, "payment_overdue"),
  invoiceRule("sent", "overdue", financeRoles, "payment_overdue"),
  invoiceRule("issued", "disputed", invoiceDisputeRoles, "invoice_dispute"),
  invoiceRule("sent", "disputed", invoiceDisputeRoles, "invoice_dispute"),
  invoiceRule("overdue", "disputed", invoiceDisputeRoles, "invoice_dispute"),
  invoiceRule("paid", "disputed", invoiceDisputeRoles, "invoice_dispute"),
  invoiceRule("disputed", "resolved", financeRoles, "invoice_resolution"),
  invoiceRule("resolved", "sent", financeRoles, "standard"),
  invoiceRule("resolved", "paid", financeRoles, "payment_completion"),
  invoiceRule("issued", "paid", financeRoles, "payment_completion"),
  invoiceRule("sent", "paid", financeRoles, "payment_completion"),
  invoiceRule("overdue", "paid", financeRoles, "payment_completion"),
  invoiceRule("issued", "void", financeRoles, "override"),
  invoiceRule("sent", "void", financeRoles, "override"),
  invoiceRule("overdue", "void", financeRoles, "override"),
  invoiceRule("disputed", "void", financeRoles, "override"),
  invoiceRule("resolved", "void", financeRoles, "override"),
  invoiceRule("issued", "draft", ownerOverrideRoles, "override"),
  invoiceRule("sent", "issued", ownerOverrideRoles, "override"),
  invoiceRule("overdue", "sent", ownerOverrideRoles, "override"),
  invoiceRule("disputed", "sent", ownerOverrideRoles, "override"),
  invoiceRule("resolved", "disputed", ownerOverrideRoles, "override"),
  invoiceRule("void", "draft", ownerOverrideRoles, "override"),
  invoiceRule("cancelled", "draft", ownerOverrideRoles, "override"),
  invoiceRule("paid", "sent", ownerOverrideRoles, "override"),
] as const satisfies readonly StatusTransitionRule<"invoice">[];

export const STATUS_TRANSITION_RULES = {
  work_order: WORK_ORDER_TRANSITION_RULES,
  assignment: ASSIGNMENT_TRANSITION_RULES,
  contractor_quote: CONTRACTOR_QUOTE_TRANSITION_RULES,
  client_quote: CLIENT_QUOTE_TRANSITION_RULES,
  invoice: INVOICE_TRANSITION_RULES,
} as const satisfies {
  readonly [TEntity in StatusTransitionEntity]: readonly StatusTransitionRule<TEntity>[];
};

const permissionEntityByTransitionEntity = {
  work_order: PERMISSION_ENTITIES.WorkOrders,
  assignment: PERMISSION_ENTITIES.Assignments,
  contractor_quote: PERMISSION_ENTITIES.ContractorQuotes,
  client_quote: PERMISSION_ENTITIES.ClientFacingQuotes,
  invoice: PERMISSION_ENTITIES.Invoices,
} as const satisfies Record<StatusTransitionEntity, PermissionEntity>;

export function getStatusTransitionDecision<
  TEntity extends StatusTransitionEntity,
>(
  entity: TEntity,
  from: StatusTransitionMap[TEntity],
  to: StatusTransitionMap[TEntity],
  role: UserRole,
): StatusTransitionDecision<TEntity> {
  const permissionEntity = permissionEntityByTransitionEntity[entity];
  if (!roleCanAccessEntity(role, permissionEntity, "transition")) {
    return {
      allowed: false,
      entity,
      from,
      to,
      role,
      reason: `${role} does not have transition authority for ${permissionEntity}.`,
    };
  }

  if (from === to) {
    return { allowed: true, entity, from, to, role };
  }

  const lifecycleDecision = getLifecycleStatusTransitionDecision(
    entity,
    from,
    to,
    role,
  );
  if (lifecycleDecision) {
    return lifecycleDecision;
  }

  const rule = STATUS_TRANSITION_RULES[entity].find(
    (candidate) =>
      candidate.from === from &&
      candidate.to === to &&
      (candidate.roles as readonly UserRole[]).includes(role),
  ) as StatusTransitionRule<TEntity> | undefined;

  if (!rule) {
    return {
      allowed: false,
      entity,
      from,
      to,
      role,
      reason: `No transition rule allows ${role} to move ${entity} from ${from} to ${to}.`,
    };
  }

  return { allowed: true, entity, from, to, role, rule };
}

function getLifecycleStatusTransitionDecision<
  TEntity extends StatusTransitionEntity,
>(
  entity: TEntity,
  from: StatusTransitionMap[TEntity],
  to: StatusTransitionMap[TEntity],
  role: UserRole,
): StatusTransitionDecision<TEntity> | null {
  if (entity !== "work_order" && entity !== "invoice") {
    return null;
  }

  const authorization = authorizeLifecycleTransition({
    lifecycle: entity,
    from,
    to,
    actorType: "USER",
    role,
  });

  return {
    allowed: authorization.ok,
    entity,
    from,
    to,
    role,
    reason: authorization.ok ? undefined : authorization.message,
  };
}

export function canTransitionEntityStatus<TEntity extends StatusTransitionEntity>(
  entity: TEntity,
  from: StatusTransitionMap[TEntity],
  to: StatusTransitionMap[TEntity],
  role: UserRole,
): boolean {
  return getStatusTransitionDecision(entity, from, to, role).allowed;
}

export async function applyStatusTransition<TEntity extends StatusTransitionEntity>(
  input: ApplyStatusTransitionInput<TEntity>,
): Promise<StatusTransitionApplyResult> {
  if (input.entity === "work_order") {
    return applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: input.entityId,
      to: input.to,
      actorType: input.actorType,
      role: input.role,
      actorUserId: input.actorUserId,
      contextOverrides: input.contextOverrides,
      metadata: input.metadata,
      repositories: input.repositories,
    });
  }

  if (input.entity === "invoice") {
    return applyInvoiceTransition({
      lifecycle: "invoice",
      entityType: "invoice",
      entityId: input.entityId,
      to: input.to,
      actorType: input.actorType,
      role: input.role,
      actorUserId: input.actorUserId,
      contextOverrides: input.contextOverrides,
      metadata: input.metadata,
      repositories: input.repositories,
    });
  }

  if (input.entity === "contractor_quote" || input.entity === "client_quote") {
    return applyQuoteTransition({
      lifecycle: "quote",
      entityType: "quote",
      entityId: input.entityId,
      to: input.to,
      actorType: input.actorType,
      role: input.role,
      actorUserId: input.actorUserId,
      metadata: input.metadata,
      repositories: input.repositories,
    });
  }

  return {
    ok: false,
    lifecycle: "quote",
    entityType: "quote",
    entityId: input.entityId,
    from: undefined,
    to: String(input.to),
    failureCode: "UNSUPPORTED_RUNTIME_PATH",
    message: `Status transition application is not supported for ${input.entity}.`,
  };
}

export function assertStatusTransition<TEntity extends StatusTransitionEntity>(
  entity: TEntity,
  from: StatusTransitionMap[TEntity],
  to: StatusTransitionMap[TEntity],
  role: UserRole,
): void {
  const decision = getStatusTransitionDecision(entity, from, to, role);

  if (!decision.allowed) {
    throw new Error(decision.reason);
  }
}

export function getStatusLockDecision<TEntity extends StatusTransitionEntity>(
  entity: TEntity,
  status: StatusTransitionMap[TEntity],
): StatusLockDecision {
  if (entity === "contractor_quote" && status === "accepted") {
    return {
      locked: true,
      reason: "Contractor quotes are locked after quote approval.",
      overrideRoles: ownerOverrideRoles,
    };
  }

  if (entity === "client_quote" && status === "approved") {
    return {
      locked: true,
      reason: "Client-facing quotes are locked after quote approval.",
      overrideRoles: ownerOverrideRoles,
    };
  }

  if (entity === "invoice" && status === "paid") {
    return {
      locked: true,
      reason: "Invoices are locked after payment completion.",
      overrideRoles: ownerOverrideRoles,
    };
  }

  if (
    entity === "invoice" &&
    (status === "issued" ||
      status === "sent" ||
      status === "overdue" ||
      status === "disputed" ||
      status === "resolved" ||
      status === "void")
  ) {
    return {
      locked: true,
      reason: "Invoices are locked after issuance.",
      overrideRoles: ownerOverrideRoles,
    };
  }

  return { locked: false, overrideRoles: [] };
}

export function canEditStatusControlledEntityDetails<
  TEntity extends StatusTransitionEntity,
>(
  entity: TEntity,
  status: StatusTransitionMap[TEntity],
  role: UserRole,
): boolean {
  const lock = getStatusLockDecision(entity, status);

  return !lock.locked || lock.overrideRoles.includes(role);
}

function workOrderRule(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  roles: readonly UserRole[],
  kind: StatusTransitionKind,
): StatusTransitionRule<"work_order"> {
  return {
    entity: "work_order",
    from,
    to,
    roles,
    kind,
    description: `${from} -> ${to}`,
  };
}

function contractorQuoteRule(
  from: ContractorQuoteStatus,
  to: ContractorQuoteStatus,
  roles: readonly UserRole[],
  kind: StatusTransitionKind,
): StatusTransitionRule<"contractor_quote"> {
  return {
    entity: "contractor_quote",
    from,
    to,
    roles,
    kind,
    description: `${from} -> ${to}`,
  };
}

function assignmentRule(
  from: AssignmentStatus,
  to: AssignmentStatus,
  roles: readonly UserRole[],
  kind: StatusTransitionKind,
): StatusTransitionRule<"assignment"> {
  return {
    entity: "assignment",
    from,
    to,
    roles,
    kind,
    description: `${from} -> ${to}`,
  };
}

function clientQuoteRule(
  from: ClientQuoteStatus,
  to: ClientQuoteStatus,
  roles: readonly UserRole[],
  kind: StatusTransitionKind,
): StatusTransitionRule<"client_quote"> {
  return {
    entity: "client_quote",
    from,
    to,
    roles,
    kind,
    description: `${from} -> ${to}`,
  };
}

function invoiceRule(
  from: InvoiceStatus,
  to: InvoiceStatus,
  roles: readonly UserRole[],
  kind: StatusTransitionKind,
): StatusTransitionRule<"invoice"> {
  return {
    entity: "invoice",
    from,
    to,
    roles,
    kind,
    description: `${from} -> ${to}`,
  };
}
