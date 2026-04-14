import type {
  AuthorizableEntity,
  AuthorizationAction,
} from "@/lib/authorization";
import type {
  ClientQuoteStatus,
  ContractorQuoteStatus,
  InvoiceStatus,
} from "@/types/financial";
import {
  INVOICE_CONTROL_ACTIONS,
  QUOTE_CONTROL_ACTIONS,
  roleCanControlClientQuote,
  roleCanControlContractorQuote,
  roleCanControlInvoice,
} from "@/types/financial-controls";
import type { UserRole } from "@/types/permissions";
import { USER_ROLES } from "@/types/permissions";
import type { AssignmentStatus, WorkOrderStatus } from "@/types/work-order";

export class RuntimeInputValidationError extends Error {
  readonly fields: readonly string[];

  constructor(message: string, fields: readonly string[] = []) {
    super(message);
    this.name = "RuntimeInputValidationError";
    this.fields = fields;
  }
}

export type MutationInputKind = "create" | "update";

export interface MutationInputValidationRequest {
  entity: AuthorizableEntity;
  action: Extract<AuthorizationAction, "create" | "edit" | "update">;
  role: UserRole;
  input: unknown;
}

export type StatusTransitionInput =
  | { entity: "work_order"; nextStatus: WorkOrderStatus; reason?: string }
  | { entity: "assignment"; nextStatus: AssignmentStatus; reason?: string }
  | {
      entity: "contractor_quote";
      nextStatus: ContractorQuoteStatus;
      reason?: string;
    }
  | { entity: "client_quote"; nextStatus: ClientQuoteStatus; reason?: string }
  | { entity: "invoice"; nextStatus: InvoiceStatus; reason?: string };

const statusesByTransitionEntity = {
  work_order: [
    "draft",
    "submitted",
    "assigned",
    "in_progress",
    "waiting_on_contractor",
    "waiting_on_customer",
    "quoted",
    "approved",
    "scheduled",
    "completed",
    "invoiced",
    "closed",
    "cancelled",
  ],
  assignment: ["pending", "accepted", "declined", "cancelled", "completed"],
  contractor_quote: [
    "draft",
    "submitted",
    "accepted",
    "rejected",
    "expired",
    "cancelled",
  ],
  client_quote: ["draft", "sent", "approved", "rejected", "expired", "cancelled"],
  invoice: [
    "draft",
    "issued",
    "sent",
    "overdue",
    "disputed",
    "resolved",
    "paid",
    "void",
    "cancelled",
  ],
} as const satisfies Record<StatusTransitionInput["entity"], readonly string[]>;

const systemControlledFields = [
  "id",
  "createdAt",
  "updatedAt",
  "createdByUserId",
  "updatedByUserId",
  "recordStatus",
  "isDeleted",
  "deletedAt",
  "deletedByUserId",
] as const;

const timestampFields = [
  "submittedAt",
  "approvedAt",
  "completedAt",
  "closedAt",
  "assignedAt",
  "respondedAt",
  "sentAt",
  "issuedAt",
  "dueAt",
  "overdueAt",
  "disputedAt",
  "resolvedAt",
  "paidAt",
  "expiresAt",
] as const;

const ownershipFields = [
  "organizationId",
  "clientOrganizationId",
  "contractorOrganizationId",
  "locationId",
  "workOrderId",
  "requestedByUserId",
  "assignedByUserId",
  "clientQuoteId",
  "contractorQuoteId",
] as const;

const financialFields = [
  "currencyCode",
  "subtotalAmountCents",
  "taxAmountCents",
  "totalAmountCents",
] as const;

const commonRejectedUpdateFields = [
  ...systemControlledFields,
  ...ownershipFields,
  ...timestampFields,
] as const;

const rejectedCreateFieldsByEntity = {
  work_order: ["status", ...systemControlledFields, ...timestampFields],
  assignment: ["status", ...systemControlledFields, ...timestampFields],
  contractor_quote: ["status", ...systemControlledFields, ...timestampFields],
  client_quote: ["status", ...systemControlledFields, ...timestampFields],
  invoice: ["status", ...systemControlledFields, ...timestampFields],
  client_organization: ["status", ...systemControlledFields],
  location: ["status", ...systemControlledFields],
  contractor_organization: ["status", ...systemControlledFields],
  activity_log: [...systemControlledFields],
  dashboard: [...systemControlledFields],
  internal_note: [...systemControlledFields],
  payment_status: [...systemControlledFields],
  billing_data: [...systemControlledFields],
} as const satisfies Record<AuthorizableEntity, readonly string[]>;

const rejectedUpdateFieldsByEntity = {
  work_order: ["status", ...commonRejectedUpdateFields],
  assignment: ["status", ...commonRejectedUpdateFields],
  contractor_quote: ["status", ...commonRejectedUpdateFields],
  client_quote: [
    "status",
    ...commonRejectedUpdateFields,
    "quoteNumber",
  ],
  invoice: [
    "status",
    ...commonRejectedUpdateFields,
    "invoiceNumber",
  ],
  client_organization: ["status", ...systemControlledFields],
  location: ["status", ...systemControlledFields],
  contractor_organization: ["status", ...systemControlledFields],
  activity_log: [...systemControlledFields],
  dashboard: [...systemControlledFields],
  internal_note: [...systemControlledFields],
  payment_status: [...systemControlledFields],
  billing_data: [...systemControlledFields, ...financialFields],
} as const satisfies Record<AuthorizableEntity, readonly string[]>;

export function validateMutationInput(
  request: MutationInputValidationRequest,
): Record<string, unknown> {
  const input = requirePlainObject(request.input);
  const rejectedFields =
    request.action === "create"
      ? rejectedCreateFieldsByEntity[request.entity]
      : rejectedUpdateFieldsByEntity[request.entity];
  const presentRejectedFields = rejectedFields.filter((field) => field in input);

  if (presentRejectedFields.length > 0) {
    throw new RuntimeInputValidationError(
      `Input contains system-controlled or unauthorized fields: ${presentRejectedFields.join(", ")}.`,
      presentRejectedFields,
    );
  }

  assertNoExternalFinancialMutation(request, input);
  assertNoExternalOwnershipMutation(request, input);

  return input;
}

export function validateStatusTransitionInput(
  entity: StatusTransitionInput["entity"],
  input: unknown,
): StatusTransitionInput {
  const payload = requirePlainObject(input);
  const allowedKeys = new Set(["nextStatus", "reason"]);
  const invalidFields = Object.keys(payload).filter((key) => !allowedKeys.has(key));

  if (invalidFields.length > 0) {
    throw new RuntimeInputValidationError(
      `Status transitions only accept nextStatus and reason. Invalid fields: ${invalidFields.join(", ")}.`,
      invalidFields,
    );
  }

  if (typeof payload.nextStatus !== "string") {
    throw new RuntimeInputValidationError("Status transition nextStatus is required.", [
      "nextStatus",
    ]);
  }

  if (
    !(statusesByTransitionEntity[entity] as readonly string[]).includes(
      payload.nextStatus,
    )
  ) {
    throw new RuntimeInputValidationError(
      `${payload.nextStatus} is not a valid ${entity} status.`,
      ["nextStatus"],
    );
  }

  if ("reason" in payload && typeof payload.reason !== "string") {
    throw new RuntimeInputValidationError("Status transition reason must be a string.", [
      "reason",
    ]);
  }

  return {
    entity,
    nextStatus: payload.nextStatus,
    reason: payload.reason,
  } as StatusTransitionInput;
}

function requirePlainObject(input: unknown): Record<string, unknown> {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new RuntimeInputValidationError("Input must be a plain object.");
  }

  return input as Record<string, unknown>;
}

function assertNoExternalFinancialMutation(
  request: MutationInputValidationRequest,
  input: Record<string, unknown>,
): void {
  const touchedFinancialFields = financialFields.filter((field) => field in input);

  if (touchedFinancialFields.length === 0) {
    return;
  }

  if (
    request.entity === "contractor_quote" &&
    roleCanControlContractorQuote(request.role, QUOTE_CONTROL_ACTIONS.Edit)
  ) {
    return;
  }

  if (
    request.entity === "client_quote" &&
    roleCanControlClientQuote(request.role, QUOTE_CONTROL_ACTIONS.Edit)
  ) {
    return;
  }

  if (
    request.entity === "invoice" &&
    roleCanControlInvoice(request.role, INVOICE_CONTROL_ACTIONS.Edit)
  ) {
    return;
  }

  throw new RuntimeInputValidationError(
    `Financial fields require financial authority: ${touchedFinancialFields.join(", ")}.`,
    touchedFinancialFields,
  );
}

function assertNoExternalOwnershipMutation(
  request: MutationInputValidationRequest,
  input: Record<string, unknown>,
): void {
  if (request.role !== USER_ROLES.ClientUser && request.role !== USER_ROLES.ContractorUser) {
    return;
  }

  const touchedOwnershipFields = ownershipFields.filter((field) => field in input);

  if (touchedOwnershipFields.length === 0) {
    return;
  }

  throw new RuntimeInputValidationError(
    `External users cannot set ownership fields: ${touchedOwnershipFields.join(", ")}.`,
    touchedOwnershipFields,
  );
}
