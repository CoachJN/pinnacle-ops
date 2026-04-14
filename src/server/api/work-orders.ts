import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import { toAppError, toSafeErrorResponse } from "@/lib/errors/safe-error";
import { createAppLogger, type AppLogger } from "@/lib/logging/logger";
import { APP_PATHS } from "@/lib/utils/constants";
import {
  assertCanCreateWorkOrderForLocationSelection,
  assertCanUpdateWorkOrderLocationSelection,
} from "@/lib/permissions/work-orders";
import {
  createWorkOrderSchema,
  updateWorkOrderSchema,
} from "@/lib/validation/work-orders";
import {
  canActorReadQuote,
  isAllowedQuoteTransitionForActor,
} from "@/lib/work-orders/quote-api-helpers";
import {
  canUserPerformAction,
  createAccessDeniedError,
} from "@/server/authorization";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/server/auth";
import {
  createFirestoreRepositories,
  type ActivityLog,
  type Assignment,
  type FirestoreRepositories,
  type Invoice,
  type Quote,
  type UserProfile,
  type WorkOrder,
} from "@/server/repositories";
import {
  createDomainServices,
  type DomainServices,
  type ServiceAuditContext,
} from "@/server/services";
import type {
  AccessActor,
  ClientAccessActor,
  ContractorAccessActor,
  InternalAccessActor,
} from "@/types/auth";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  InvoiceCurrency,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/types/invoice";
import {
  isInternalRole,
  USER_ROLES,
  type UserRole,
} from "@/types/permissions";
import type { QuoteStatus } from "@/types/quote";
import type { WorkOrderPriority, WorkOrderStatus } from "@/types/work-order";
export {
  filterVisibleActivityLogsForActor,
  safeQuoteSummaryForActor,
} from "@/lib/work-orders/quote-api-helpers";

const WORK_ORDER_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const satisfies readonly WorkOrderPriority[];

const WORK_ORDER_STATUSES = [
  "new",
  "in_review",
  "draft",
  "submitted",
  "quote_requested",
  "quote_received",
  "pending_client_approval",
  "approved_to_proceed",
  "dispatched",
  "assigned",
  "in_progress",
  "waiting_on_contractor",
  "waiting_on_customer",
  "quoted",
  "approved",
  "scheduled",
  "completed",
  "invoiced",
  "paid",
  "closed",
  "cancelled",
] as const satisfies readonly WorkOrderStatus[];

const QUOTE_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "ready_for_client",
  "client_approved",
  "client_rejected",
  "superseded",
] as const satisfies readonly QuoteStatus[];

const INVOICE_CURRENCIES = [
  "CAD",
  "USD",
] as const satisfies readonly InvoiceCurrency[];

const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "paid",
  "overdue",
  "void",
] as const satisfies readonly InvoiceStatus[];

export interface WorkOrderApiContext {
  actor: AccessActor;
  audit: ServiceAuditContext;
  repositories: FirestoreRepositories;
  services: DomainServices;
  request: ApiRequestContext | null;
  logger: AppLogger;
}

export interface ApiRequestContext {
  requestId: string;
  route: string;
  method: string;
  startedAtMs: number;
  logger: AppLogger;
}

export async function getWorkOrderApiContext(
  requestContext: ApiRequestContext | null = null,
): Promise<WorkOrderApiContext> {
  const auth = await requireAuthenticatedUser();
  const repositories = createFirestoreRepositories();
  const services = createDomainServices(repositories);
  const userProfile = await repositories.userProfiles.getById(auth.identity.uid);
  const actor = buildAccessActor(
    auth.identity.uid,
    auth.profile?.role ?? userProfile?.role ?? null,
    auth.profile?.organizationId ?? userProfile?.organizationId ?? null,
    userProfile,
  );

  const logger = (requestContext?.logger ?? createAppLogger({
    layer: "api",
    domain: "work_orders",
  })).child({
    actor: {
      type: actor.actorType === "internal" ? "user" : "user",
      userId: actor.userId,
      role: actor.role,
    },
    organizationId: actor.scope.organizationId,
  });

  return {
    actor,
    audit: {
      organizationId: actor.scope.organizationId,
      actor: {
        userId: actor.userId,
        role: actor.role,
      },
      requestId: requestContext?.requestId,
    },
    repositories,
    services,
    request: requestContext,
    logger,
  };
}

export function jsonOk<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function jsonError(
  error: unknown,
  requestContext: ApiRequestContext | null = null,
): NextResponse {
  if (error instanceof AuthenticationRequiredError) {
    requestContext?.logger.warn("api.request.unauthorized", {
      statusCode: 401,
    });
    return NextResponse.json(
      {
        error: {
          code: ERROR_CODES.Unauthorized,
          message: "Sign in to continue.",
          statusCode: 401,
          requestId: requestContext?.requestId,
        },
      },
      { status: 401 },
    );
  }

  const appError = toAppError(error);
  requestContext?.logger.error("api.request.failed", appError, {
    errorCode: appError.code,
    statusCode: appError.statusCode,
  });
  const safeError = toSafeErrorResponse(appError, {
    requestId: requestContext?.requestId,
  });
  return NextResponse.json(
    { error: safeError },
    { status: safeError.statusCode },
  );
}

export function createApiRequestContext(
  request: NextRequest,
  route: string,
): ApiRequestContext {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const logger = createAppLogger({
    layer: "api",
    domain: "work_orders",
    route,
    method: request.method,
    requestId,
  });

  return {
    requestId,
    route,
    method: request.method,
    startedAtMs: Date.now(),
    logger,
  };
}

export async function withApiRoute(
  request: NextRequest,
  route: string,
  handler: (requestContext: ApiRequestContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const requestContext = createApiRequestContext(request, route);
  requestContext.logger.info("api.request.started");

  try {
    const response = await handler(requestContext);
    requestContext.logger.info("api.request.completed", {
      statusCode: response.status,
      durationMs: Date.now() - requestContext.startedAtMs,
    });
    return response;
  } catch (error) {
    return jsonError(error, requestContext);
  }
}

export function createValidationAppError(message: string): AppError {
  return validationError(message);
}

export function createNotFoundAppError(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.NotFound,
    message,
    safeMessage: message,
  });
}

export async function parseJsonObject(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body)) {
    throw validationError("Request body must be a JSON object.");
  }

  return body;
}

export function parseCreateWorkOrderPayload(input: Record<string, unknown>) {
  return createWorkOrderSchema.parse(input);
}

export function parseUpdateWorkOrderPayload(input: Record<string, unknown>) {
  return updateWorkOrderSchema.parse(input);
}

export function parseAssignInternalPayload(input: Record<string, unknown>) {
  assertAllowedFields(input, [
    "assignedCoordinatorUserId",
    "assignedManagerUserId",
  ]);

  if (
    input.assignedCoordinatorUserId === undefined &&
    input.assignedManagerUserId === undefined
  ) {
    throw validationError(
      "At least one internal staff assignment field is required.",
    );
  }

  return pruneUndefined({
    assignedCoordinatorUserId: optionalNullableString(
      input.assignedCoordinatorUserId,
      "assignedCoordinatorUserId",
    ),
    assignedManagerUserId: optionalNullableString(
      input.assignedManagerUserId,
      "assignedManagerUserId",
    ),
  });
}

export function parseAssignContractorPayload(input: Record<string, unknown>) {
  assertAllowedFields(input, ["contractorOrganizationId"]);

  return {
    contractorOrganizationId: nullableString(
      input.contractorOrganizationId,
      "contractorOrganizationId",
    ),
  };
}

export function parseTransitionPayload(input: Record<string, unknown>) {
  assertAllowedFields(input, ["toStatus", "completionAccepted", "activityMessage"]);

  return {
    toStatus: parseWorkOrderStatus(input.toStatus),
    completionAccepted:
      input.completionAccepted === undefined
        ? undefined
        : requiredBoolean(input.completionAccepted, "completionAccepted"),
    activityMessage: optionalString(input.activityMessage, "activityMessage"),
  };
}

export function parseCreateQuotePayload(input: Record<string, unknown>) {
  assertAllowedFields(input, [
    "contractorOrganizationId",
    "laborAmount",
    "materialAmount",
    "otherAmount",
    "currency",
    "scopeSummary",
    "contractorNotes",
  ]);

  return {
    contractorOrganizationId: optionalNullableString(
      input.contractorOrganizationId,
      "contractorOrganizationId",
    ),
    laborAmount: requiredMoney(input.laborAmount, "laborAmount"),
    materialAmount: requiredMoney(input.materialAmount, "materialAmount"),
    otherAmount: requiredMoney(input.otherAmount, "otherAmount"),
    currency: parseInvoiceCurrency(input.currency),
    scopeSummary: requiredString(input.scopeSummary, "scopeSummary"),
    contractorNotes: optionalNullableString(
      input.contractorNotes,
      "contractorNotes",
    ),
  };
}

export function parseUpdateQuotePayload(input: Record<string, unknown>) {
  assertAllowedFields(input, [
    "contractorOrganizationId",
    "laborAmount",
    "materialAmount",
    "otherAmount",
    "currency",
    "scopeSummary",
    "contractorNotes",
    "internalReviewNotes",
  ]);

  return {
    contractorOrganizationId: optionalNullableString(
      input.contractorOrganizationId,
      "contractorOrganizationId",
    ),
    laborAmount: requiredMoney(input.laborAmount, "laborAmount"),
    materialAmount: requiredMoney(input.materialAmount, "materialAmount"),
    otherAmount: requiredMoney(input.otherAmount, "otherAmount"),
    currency: parseInvoiceCurrency(input.currency),
    scopeSummary: requiredString(input.scopeSummary, "scopeSummary"),
    contractorNotes: optionalNullableString(
      input.contractorNotes,
      "contractorNotes",
    ),
    internalReviewNotes: optionalNullableString(
      input.internalReviewNotes,
      "internalReviewNotes",
    ),
  };
}

export function parseQuoteTransitionPayload(input: Record<string, unknown>) {
  assertAllowedFields(input, [
    "toStatus",
    "internalReviewNotes",
    "clientResponseNotes",
  ]);

  return {
    toStatus: parseQuoteStatus(input.toStatus),
    internalReviewNotes: optionalNullableString(
      input.internalReviewNotes,
      "internalReviewNotes",
    ),
    clientResponseNotes: optionalNullableString(
      input.clientResponseNotes,
      "clientResponseNotes",
    ),
  };
}

export function parseNotePayload(input: Record<string, unknown>) {
  assertAllowedFields(input, ["note", "noteType"]);
  const noteType = input.noteType ?? "internal";

  if (noteType !== "internal" && noteType !== "operational") {
    throw validationError("noteType must be internal or operational.");
  }

  return {
    note: requiredString(input.note, "note"),
    noteType: noteType as "internal" | "operational",
  };
}

export function parseCreateInvoicePayload(input: Record<string, unknown>) {
  assertAllowedFields(input, [
    "dueDate",
    "currency",
    "lineItems",
    "subtotal",
    "taxAmount",
    "totalAmount",
    "notes",
  ]);

  return {
    dueDate: requiredDateTime(input.dueDate, "dueDate"),
    currency: parseInvoiceCurrency(input.currency),
    lineItems: parseInvoiceLineItems(input.lineItems),
    subtotal:
      input.subtotal === undefined
        ? undefined
        : requiredMoney(input.subtotal, "subtotal"),
    taxAmount: requiredMoney(input.taxAmount, "taxAmount"),
    totalAmount:
      input.totalAmount === undefined
        ? undefined
        : requiredMoney(input.totalAmount, "totalAmount"),
    notes: optionalNullableString(
      input.notes,
      "notes",
    ),
  };
}

export function parseUpdateInvoicePayload(input: Record<string, unknown>) {
  return parseCreateInvoicePayload(input);
}

export function parseInvoiceTransitionPayload(input: Record<string, unknown>) {
  assertAllowedFields(input, [
    "action",
    "toStatus",
    "paymentReference",
    "issuedDate",
    "sentAt",
    "viewedAt",
    "paidAt",
    "voidedAt",
  ]);
  const action = optionalString(input.action, "action");
  const explicitStatus =
    input.toStatus === undefined ? undefined : parseInvoiceStatus(input.toStatus);

  if (!action && !explicitStatus) {
    throw validationError("Either action or toStatus is required.");
  }

  return {
    toStatus: explicitStatus ?? parseInvoiceAction(action!),
    paymentReference: optionalNullableString(
      input.paymentReference,
      "paymentReference",
    ),
    issuedDate: optionalNullableDateTime(input.issuedDate, "issuedDate"),
    sentAt: optionalNullableDateTime(input.sentAt, "sentAt"),
    viewedAt: optionalNullableDateTime(input.viewedAt, "viewedAt"),
    paidAt: optionalNullableDateTime(input.paidAt, "paidAt"),
    voidedAt: optionalNullableDateTime(input.voidedAt, "voidedAt"),
  };
}

export function parseWorkOrderListLimit(request: NextRequest): number {
  const rawLimit = request.nextUrl.searchParams.get("limit");
  if (!rawLimit) {
    return 50;
  }

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw validationError("limit must be an integer between 1 and 100.");
  }

  return limit;
}

export async function authorizeWorkOrderCreate(
  context: WorkOrderApiContext,
  input: { clientOrganizationId: EntityId; locationId: EntityId },
): Promise<void> {
  assertCanCreateWorkOrderForLocationSelection(context.actor, {
    organizationId: context.actor.scope.organizationId,
    clientOrganizationId: input.clientOrganizationId,
    locationId: input.locationId,
  });
}

export function authorizeWorkOrderLocationUpdate(
  context: WorkOrderApiContext,
  input: { clientOrganizationId: EntityId; locationId: EntityId },
): void {
  assertCanUpdateWorkOrderLocationSelection(context.actor, {
    organizationId: context.actor.scope.organizationId,
    clientOrganizationId: input.clientOrganizationId,
    locationId: input.locationId,
  });
}

export async function authorizeWorkOrderRead(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
): Promise<void> {
  const assignments = await context.repositories.assignments.listByWorkOrderId(
    workOrder.id,
  );

  const assignmentRelationships = toAssignmentRelationships(assignments.items);
  const canReadViaPolicy = canUserPerformAction({
    actor: context.actor,
    entity: "work_order",
    action: "read",
    target: toWorkOrderAuthTarget(workOrder),
    context: {
      assignments: assignmentRelationships,
    },
  });

  if (
    canReadViaPolicy ||
    isAssignedContractorActorForWorkOrder(context.actor, workOrder)
  ) {
    return;
  }

  assertAuthorized(false);
}

export function authorizeWorkOrderEdit(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
): void {
  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "work_order",
      action: "edit",
      target: toWorkOrderAuthTarget(workOrder),
    }),
  );
}

export function authorizeWorkOrderTransition(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
  toStatus: WorkOrderStatus,
): void {
  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "work_order",
      action: "transition",
      target: toWorkOrderAuthTarget(workOrder),
      nextStatus: toStatus,
    }),
  );
}

export function authorizeInternalNote(
  context: WorkOrderApiContext,
): void {
  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "internal_note",
      action: "create",
      target: {
        organizationId: context.actor.scope.organizationId,
      },
    }),
  );
}

export function authorizeActivityRead(context: WorkOrderApiContext): void {
  if (context.actor.actorType !== "internal") {
    return;
  }

  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "activity_log",
      action: "read",
      target: {
        organizationId: context.actor.scope.organizationId,
      },
    }),
  );
}

export async function authorizeQuoteCreate(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
): Promise<void> {
  await authorizeWorkOrderRead(context, workOrder);

  if (
    context.actor.actorType === "client" ||
    (context.actor.actorType === "contractor" &&
      !isAssignedContractorActorForWorkOrder(context.actor, workOrder))
  ) {
    throw createAccessDeniedError();
  }
}

export async function authorizeQuoteRead(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
  quote: Quote,
): Promise<void> {
  if (!canActorReadQuote(context.actor, workOrder, quote)) {
    throw createAccessDeniedError();
  }
}

export async function authorizeQuoteDraftEdit(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
  quote: Quote,
): Promise<void> {
  await authorizeQuoteRead(context, workOrder, quote);

  if (
    workOrder.currentQuoteId !== quote.id ||
    quote.status !== "draft" ||
    !canActorEditDraftQuote(context.actor, workOrder, quote)
  ) {
    throw createAccessDeniedError();
  }
}

export async function authorizeQuoteTransition(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
  quote: Quote,
  toStatus: QuoteStatus,
): Promise<void> {
  await authorizeQuoteRead(context, workOrder, quote);

  if (
    !isAllowedQuoteTransitionForActor(
      context.actor,
      workOrder,
      quote,
      toStatus,
    )
  ) {
    throw createAccessDeniedError();
  }
}

export async function authorizeInvoiceRead(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
  invoice: Invoice,
): Promise<void> {
  await authorizeWorkOrderRead(context, workOrder);

  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "invoice",
      action: "read",
      target: toInvoiceAuthTarget(workOrder, invoice),
    }),
  );
}

export async function authorizeInvoiceCreate(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
): Promise<void> {
  await authorizeWorkOrderRead(context, workOrder);

  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "invoice",
      action: "create",
      target: toInvoiceAuthTarget(workOrder),
    }),
  );
}

export async function authorizeInvoiceEdit(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
  invoice: Invoice,
): Promise<void> {
  await authorizeInvoiceRead(context, workOrder, invoice);

  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "invoice",
      action: "edit",
      target: toInvoiceAuthTarget(workOrder, invoice),
    }),
  );
}

export async function authorizeInvoiceTransition(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
  invoice: Invoice,
  toStatus: InvoiceStatus,
): Promise<void> {
  await authorizeInvoiceRead(context, workOrder, invoice);

  const action =
    toStatus === "sent"
      ? "issue_send"
      : toStatus === "paid"
        ? "mark_paid"
        : toStatus === "overdue"
          ? "mark_overdue"
          : "transition";

  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "invoice",
      action,
      target: toInvoiceAuthTarget(workOrder, invoice),
      nextStatus: toStatus,
    }),
  );
}

export function authorizeFinanceQueueRead(
  context: WorkOrderApiContext,
): void {
  if (
    context.actor.actorType !== "internal" ||
    (context.actor.role !== USER_ROLES.Manager &&
      context.actor.role !== USER_ROLES.FinanceAdmin &&
      context.actor.role !== USER_ROLES.Owner)
  ) {
    throw createAccessDeniedError();
  }
}

export function listScopeForActor(
  actor: AccessActor,
  limit: number,
) {
  if (actor.actorType === "internal") {
    return {
      scope: "organization" as const,
      organizationId: actor.scope.organizationId,
      limit,
    };
  }

  if (actor.actorType === "client") {
    if (actor.scope.locationAccess.kind === "selected_client_locations") {
      return {
        scope: "locations" as const,
        locationIds: actor.scope.locationAccess.locationIds,
        limit,
      };
    }

    return {
      scope: "clientOrganization" as const,
      clientOrganizationId: actor.scope.clientOrganizationId,
      limit,
    };
  }

  return {
    scope: "contractorOrganization" as const,
    contractorOrganizationId: actor.scope.contractorOrganizationId,
    limit,
  };
}

export function safeWorkOrderSummary(workOrder: WorkOrder) {
  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    status: workOrder.status,
    priority: workOrder.priority,
    clientOrganizationId: workOrder.clientOrganizationId,
    locationId: workOrder.locationId,
    clientSnapshot: workOrder.clientSnapshot,
    locationSnapshot: workOrder.locationSnapshot,
    contractorSnapshot: workOrder.contractorSnapshot,
    assignedCoordinatorUserId: workOrder.assignedCoordinatorUserId,
    assignedManagerUserId: workOrder.assignedManagerUserId,
    assignedContractorOrganizationId: workOrder.assignedContractorOrganizationId,
    category: workOrder.category,
    requestedServiceDate: workOrder.requestedServiceDate,
    updatedAt: workOrder.updatedAt,
  };
}

export function safeWorkOrderDetail(workOrder: WorkOrder) {
  return {
    ...safeWorkOrderSummary(workOrder),
    description: workOrder.description,
    requestedByUserId: workOrder.requestedByUserId,
    currentQuoteId: workOrder.currentQuoteId,
    currentInvoiceId: workOrder.currentInvoiceId,
    submittedAt: workOrder.submittedAt,
    approvedAt: workOrder.approvedAt,
    completedAt: workOrder.completedAt,
    closedAt: workOrder.closedAt,
    createdAt: workOrder.createdAt,
  };
}

export function safeActivityLog(activityLog: ActivityLog) {
  return {
    id: activityLog.id,
    workOrderId: activityLog.workOrderId,
    action: activityLog.action,
    eventType: activityLog.eventType,
    message: activityLog.message,
    actor: activityLog.actor,
    actorRole: activityLog.actorRole,
    resource: activityLog.resource,
    entityType: activityLog.entityType,
    entityId: activityLog.entityId,
    occurredAt: activityLog.occurredAt,
    requestId: activityLog.requestId,
    visibility: activityLog.visibility,
    changes: activityLog.changes,
    metadata: activityLog.metadata,
  };
}

export function safeInvoiceSummary(invoice: Invoice) {
  return {
    id: invoice.id,
    workOrderId: invoice.workOrderId,
    clientOrganizationId: invoice.clientOrganizationId,
    locationId: invoice.locationId,
    invoiceNumber: invoice.invoiceNumber,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency,
    status: invoice.status,
    issuedDate: invoice.issuedDate,
    dueDate: invoice.dueDate,
    sentAt: invoice.sentAt,
    viewedAt: invoice.viewedAt,
    paidAt: invoice.paidAt,
    voidedAt: invoice.voidedAt,
    paymentReference: invoice.paymentReference,
    notes: invoice.notes,
    qboInvoiceId: invoice.qboInvoiceId,
    qboSyncStatus: invoice.qboSyncStatus,
    workOrderSnapshot: invoice.workOrderSnapshot,
    clientSnapshot: invoice.clientSnapshot,
    locationSnapshot: invoice.locationSnapshot,
    updatedAt: invoice.updatedAt,
    createdAt: invoice.createdAt,
  };
}

export function revalidateWorkOrderPaths(workOrderId?: EntityId): void {
  revalidatePath("/work-orders");
  revalidatePath(APP_PATHS.workOrders);
  revalidatePath(APP_PATHS.finance);
  if (workOrderId) {
    revalidatePath(`/work-orders/${workOrderId}`);
    revalidatePath(`${APP_PATHS.workOrders}/${workOrderId}`);
  }
}

function buildAccessActor(
  userId: EntityId,
  role: UserRole | null,
  organizationId: EntityId | null,
  userProfile: UserProfile | null,
): AccessActor {
  if (!role || !organizationId || userProfile?.status === "inactive") {
    throw new AppError({
      code: ERROR_CODES.Forbidden,
      message: "Authenticated user profile is not authorized.",
      safeMessage: "Your user profile is not authorized for this workspace.",
    });
  }

  if (isInternalRole(role)) {
    return {
      actorType: "internal",
      userId,
      role,
      scope: {
        kind: "internal",
        organizationId,
      },
    } satisfies InternalAccessActor;
  }

  if (role === USER_ROLES.ClientUser) {
    if (!userProfile?.clientOrganizationId) {
      throw new AppError({
        code: ERROR_CODES.Forbidden,
        message: "Client user profile is missing a client organization.",
        safeMessage: "Your client profile is not fully configured.",
      });
    }

    return {
      actorType: "client",
      userId,
      role,
      scope: {
        kind: "client",
        organizationId,
        clientOrganizationId: userProfile.clientOrganizationId,
        locationAccess:
          userProfile.locationIds.length > 0
            ? {
                kind: "selected_client_locations",
                locationIds: userProfile.locationIds,
              }
            : { kind: "all_client_locations" },
      },
    } satisfies ClientAccessActor;
  }

  if (!userProfile?.contractorOrganizationId) {
    throw new AppError({
      code: ERROR_CODES.Forbidden,
      message: "Contractor user profile is missing a contractor organization.",
      safeMessage: "Your contractor profile is not fully configured.",
    });
  }

  return {
    actorType: "contractor",
    userId,
    role,
    scope: {
      kind: "contractor",
      organizationId,
      contractorOrganizationId: userProfile.contractorOrganizationId,
    },
  } satisfies ContractorAccessActor;
}

function toWorkOrderAuthTarget(workOrder: WorkOrder) {
  return {
    id: workOrder.id,
    organizationId: workOrder.organizationId,
    clientOrganizationId: workOrder.clientOrganizationId,
    locationId: workOrder.locationId,
    status: workOrder.status,
  };
}

function toAssignmentRelationships(assignments: Assignment[]) {
  return assignments
    .filter((assignment) => Boolean(assignment.contractorOrganizationId))
    .map((assignment) => ({
      organizationId: assignment.organizationId,
      workOrderId: assignment.workOrderId,
      contractorOrganizationId: assignment.contractorOrganizationId!,
    }));
}

export function toInvoiceAuthTarget(workOrder: WorkOrder, invoice?: Invoice) {
  return {
    organizationId: workOrder.organizationId,
    workOrderId: workOrder.id,
    clientOrganizationId: workOrder.clientOrganizationId,
    locationId: workOrder.locationId,
    contractorOrganizationId: workOrder.assignedContractorOrganizationId ?? undefined,
    status: invoice?.status,
  };
}

function isAssignedContractorActorForWorkOrder(
  actor: AccessActor,
  workOrder: WorkOrder,
): boolean {
  return (
    actor.actorType === "contractor" &&
    workOrder.assignedContractorOrganizationId ===
      actor.scope.contractorOrganizationId
  );
}

function canActorEditDraftQuote(
  actor: AccessActor,
  workOrder: WorkOrder,
  quote: Quote,
): boolean {
  if (actor.actorType === "internal") {
    return true;
  }

  return (
    actor.actorType === "contractor" &&
    isAssignedContractorActorForWorkOrder(actor, workOrder) &&
    (quote.contractorOrganizationId === null ||
      quote.contractorOrganizationId === actor.scope.contractorOrganizationId)
  );
}

function assertAuthorized(allowed: boolean): void {
  if (!allowed) {
    throw createAccessDeniedError();
  }
}

function validationError(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.ValidationFailed,
    message,
    safeMessage: message,
  });
}

function assertAllowedFields(
  input: Record<string, unknown>,
  allowedFields: readonly string[],
): void {
  const allowed = new Set(allowedFields);
  const invalidFields = Object.keys(input).filter((field) => !allowed.has(field));

  if (invalidFields.length > 0) {
    throw validationError(`Unsupported fields: ${invalidFields.join(", ")}.`);
  }
}

function requiredString(value: unknown, field: string): string {
  const parsed = optionalString(value, field);
  if (!parsed) {
    throw validationError(`${field} is required.`);
  }

  return parsed;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw validationError(`${field} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw validationError(`${field} cannot be blank.`);
  }

  return trimmed;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return requiredString(value, field);
}

function optionalNullableString(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return nullableString(value, field);
}

function optionalNullableDateTime(
  value: unknown,
  field: string,
): IsoDateTimeString | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return nullableDateTime(value, field);
}

function nullableDateTime(
  value: unknown,
  field: string,
): IsoDateTimeString | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw validationError(`${field} must be a valid date string.`);
  }

  return value;
}

function requiredDateTime(value: unknown, field: string): IsoDateTimeString {
  const parsed = nullableDateTime(value, field);
  if (!parsed) {
    throw validationError(`${field} is required.`);
  }

  return parsed;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw validationError(`${field} must be a boolean.`);
  }

  return value;
}

function requiredMoney(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw validationError(`${field} must be a number greater than or equal to 0.`);
  }

  return Math.round(value * 100) / 100;
}

function parsePriority(value: unknown): WorkOrderPriority {
  if (
    typeof value !== "string" ||
    !(WORK_ORDER_PRIORITIES as readonly string[]).includes(value)
  ) {
    throw validationError("priority must be low, medium, high, or urgent.");
  }

  return value as WorkOrderPriority;
}

function parseWorkOrderStatus(value: unknown): WorkOrderStatus {
  if (
    typeof value !== "string" ||
    !(WORK_ORDER_STATUSES as readonly string[]).includes(value)
  ) {
    throw validationError("toStatus is not a valid work order status.");
  }

  return value as WorkOrderStatus;
}

function parseQuoteStatus(value: unknown): QuoteStatus {
  if (
    typeof value !== "string" ||
    !(QUOTE_STATUSES as readonly string[]).includes(value)
  ) {
    throw validationError("toStatus is not a valid quote status.");
  }

  return value as QuoteStatus;
}

function parseInvoiceCurrency(value: unknown): InvoiceCurrency {
  if (
    typeof value !== "string" ||
    !(INVOICE_CURRENCIES as readonly string[]).includes(value)
  ) {
    throw validationError("currency must be CAD or USD.");
  }

  return value as InvoiceCurrency;
}

function parseInvoiceStatus(value: unknown): InvoiceStatus {
  if (
    typeof value !== "string" ||
    !(INVOICE_STATUSES as readonly string[]).includes(value)
  ) {
    throw validationError("toStatus is not a valid invoice status.");
  }

  return value as InvoiceStatus;
}

function parseInvoiceAction(value: string): InvoiceStatus {
  switch (value) {
    case "mark_sent":
    case "send":
    case "issue":
      return "sent";
    case "mark_viewed":
    case "view":
      return "viewed";
    case "mark_paid":
    case "pay":
      return "paid";
    case "mark_overdue":
      return "overdue";
    case "void":
      return "void";
    default:
      throw validationError(
        "action must be mark_sent, mark_viewed, mark_paid, mark_overdue, or void.",
      );
  }
}

function parseInvoiceLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError("lineItems must contain at least one line item.");
  }

  return value.map((entry, index) => parseInvoiceLineItem(entry, index));
}

function parseInvoiceLineItem(
  value: unknown,
  index: number,
): InvoiceLineItem {
  if (!isPlainObject(value)) {
    throw validationError(`lineItems[${index}] must be an object.`);
  }

  assertAllowedFields(value, ["id", "description", "quantity", "unitPrice"]);

  return {
    id: optionalString(value.id, `lineItems[${index}].id`) ?? `line-${index + 1}`,
    description: requiredString(
      value.description,
      `lineItems[${index}].description`,
    ),
    quantity: requiredPositiveNumber(
      value.quantity,
      `lineItems[${index}].quantity`,
    ),
    unitPrice: requiredMoney(value.unitPrice, `lineItems[${index}].unitPrice`),
    lineTotal: 0,
  };
}

function requiredPositiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw validationError(`${field} must be a number greater than 0.`);
  }

  return Math.round(value * 100) / 100;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
