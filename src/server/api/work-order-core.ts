import "server-only";

import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import type {
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderDetail,
  WorkOrderListItem,
  WorkOrderNote,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/modules/work-orders";
import {
  createAddWorkOrderAttachmentService,
  createAddWorkOrderNoteService,
  createCreateWorkOrderService,
  createGetWorkOrderDetailService,
  createListWorkOrdersService,
  createUpdateWorkOrderStatusService,
  createWorkOrderServiceDependencies,
  type WorkOrderDetailDto,
  type WorkOrderListItemDto,
} from "@/lib/services/work-orders";
import { workOrderPolicy } from "@/lib/access-policy";
import { createAccessDeniedError } from "@/server/authorization";
import {
  getWorkOrderApiContext,
  jsonOk,
  parseJsonObject,
  revalidateWorkOrderPaths,
  withApiRoute,
  type ApiRequestContext,
  type WorkOrderApiContext,
} from "@/server/api/work-orders";
import type { ServiceResult } from "@/server/services";

const PHASE_THREE_STATUSES = new Set<WorkOrderStatus>([
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "CLOSED",
]);

const PHASE_THREE_PRIORITIES = new Set<WorkOrderPriority>([
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

interface PhaseThreeServices {
  addAttachment: ReturnType<typeof createAddWorkOrderAttachmentService>;
  addNote: ReturnType<typeof createAddWorkOrderNoteService>;
  create: ReturnType<typeof createCreateWorkOrderService>;
  detail: ReturnType<typeof createGetWorkOrderDetailService>;
  list: ReturnType<typeof createListWorkOrdersService>;
  updateStatus: ReturnType<typeof createUpdateWorkOrderStatusService>;
}

interface PhaseThreeApiContext extends WorkOrderApiContext {
  phaseThree: {
    dependencies: ReturnType<typeof createWorkOrderServiceDependencies>;
    services: PhaseThreeServices;
  };
}

interface RelatedSummary {
  clientOrganization: {
    id: string;
    name?: string;
    displayName?: string;
  };
  location: {
    id: string;
    name?: string;
    code?: string;
    clientOrganizationId?: string;
  };
}

export interface WorkOrderListFilters {
  search?: string;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  clientOrganizationId?: string;
  locationId?: string;
  limit?: number;
}

export async function getPhaseThreeWorkOrderApiContext(
  requestContext: ApiRequestContext,
): Promise<PhaseThreeApiContext> {
  const context = await getWorkOrderApiContext(requestContext);
  const dependencies = createWorkOrderServiceDependencies();

  return {
    ...context,
    phaseThree: {
      dependencies,
      services: {
        addAttachment: createAddWorkOrderAttachmentService(dependencies),
        addNote: createAddWorkOrderNoteService(dependencies),
        create: createCreateWorkOrderService(dependencies),
        detail: createGetWorkOrderDetailService(dependencies),
        list: createListWorkOrdersService(dependencies),
        updateStatus: createUpdateWorkOrderStatusService(dependencies),
      },
    },
  };
}

export async function withPhaseThreeWorkOrderRoute(
  request: NextRequest,
  route: string,
  handler: (context: PhaseThreeApiContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withApiRoute(request, route, async (requestContext) => {
    const context = await getPhaseThreeWorkOrderApiContext(requestContext);
    return handler(context);
  });
}

export async function createPhaseThreeWorkOrder(
  context: PhaseThreeApiContext,
  request: NextRequest,
): Promise<NextResponse> {
  const payload = await parseJsonObject(request);
  const normalizedPayload: Record<string, unknown> = {
    ...payload,
    createdByUserId: context.actor.userId,
  };

  assertCanCreateWorkOrder(
    context,
    readRequiredString(normalizedPayload.clientOrganizationId, "clientOrganizationId"),
    readRequiredString(normalizedPayload.locationId, "locationId"),
  );

  const created = unwrap(
    await context.phaseThree.services.create.createWorkOrder({
      payload: normalizedPayload,
    }),
  );

  await assertCanReadWorkOrder(context, created);
  revalidateWorkOrderPaths(created.id);

  return jsonData(
    {
      workOrder: await serializeWorkOrderDetail(context, created),
    },
    201,
  );
}

export async function listPhaseThreeWorkOrders(
  context: PhaseThreeApiContext,
  request: NextRequest,
): Promise<NextResponse> {
  const filters = parseListFilters(request);
  assertCanListRequestedScope(context, filters);

  const result = unwrap(
    await context.phaseThree.services.list.listWorkOrders({
      query: filters,
    }),
  );

  const readableWorkOrders = await filterReadableWorkOrders(
    context,
    result.items,
    filters,
  );

  return jsonData({
    workOrders: readableWorkOrders.map(serializeWorkOrderListItem),
  });
}

export async function getPhaseThreeWorkOrderDetail(
  context: PhaseThreeApiContext,
  workOrderId: string,
): Promise<NextResponse> {
  const detail = unwrap(
    await context.phaseThree.services.detail.getWorkOrderDetail({ workOrderId }),
  );

  await assertCanReadWorkOrder(context, detail);

  return jsonData({
    workOrder: await serializeWorkOrderDetail(context, detail),
  });
}

export async function updatePhaseThreeWorkOrderStatus(
  context: PhaseThreeApiContext,
  request: NextRequest,
  workOrderId: string,
): Promise<NextResponse> {
  const existing = unwrap(
    await context.phaseThree.services.detail.getWorkOrderDetail({ workOrderId }),
  );
  await assertCanTransitionWorkOrder(context, existing);

  const payload = await parseJsonObject(request);
  const updated = unwrap(
    await context.phaseThree.services.updateStatus.updateWorkOrderStatus({
      workOrderId,
      payload: normalizeStatusPayload(payload),
    }),
  );

  revalidateWorkOrderPaths(updated.id);

  return jsonData({
    workOrder: await serializeWorkOrderDetail(context, updated),
  });
}

export async function listPhaseThreeWorkOrderNotes(
  context: PhaseThreeApiContext,
  workOrderId: string,
): Promise<NextResponse> {
  const detail = unwrap(
    await context.phaseThree.services.detail.getWorkOrderDetail({ workOrderId }),
  );
  await assertCanReadWorkOrder(context, detail);

  return jsonData({
    notes: detail.notes.map(serializeNote),
  });
}

export async function addPhaseThreeWorkOrderNote(
  context: PhaseThreeApiContext,
  request: NextRequest,
  workOrderId: string,
): Promise<NextResponse> {
  const existing = unwrap(
    await context.phaseThree.services.detail.getWorkOrderDetail({ workOrderId }),
  );
  await assertCanUpdateWorkOrder(context, existing);

  const payload = await parseJsonObject(request);
  const created = unwrap(
    await context.phaseThree.services.addNote.addWorkOrderNote({
      workOrderId,
      payload: {
        ...payload,
        createdByUserId: context.actor.userId,
      },
    }),
  );

  revalidateWorkOrderPaths(workOrderId);

  return jsonData(
    {
      note: serializeNote(created),
    },
    201,
  );
}

export async function listPhaseThreeWorkOrderAttachments(
  context: PhaseThreeApiContext,
  workOrderId: string,
): Promise<NextResponse> {
  const detail = unwrap(
    await context.phaseThree.services.detail.getWorkOrderDetail({ workOrderId }),
  );
  await assertCanReadWorkOrder(context, detail);

  return jsonData({
    attachments: detail.attachments.map(serializeAttachment),
  });
}

export async function addPhaseThreeWorkOrderAttachment(
  context: PhaseThreeApiContext,
  request: NextRequest,
  workOrderId: string,
): Promise<NextResponse> {
  const existing = unwrap(
    await context.phaseThree.services.detail.getWorkOrderDetail({ workOrderId }),
  );
  await assertCanUpdateWorkOrder(context, existing);

  const payload = await parseJsonObject(request);
  const created = unwrap(
    await context.phaseThree.services.addAttachment.addWorkOrderAttachment({
      workOrderId,
      payload: {
        ...payload,
        uploadedByUserId: context.actor.userId,
      },
    }),
  );

  revalidateWorkOrderPaths(workOrderId);

  return jsonData(
    {
      attachment: serializeAttachment(created),
    },
    201,
  );
}

function jsonData<T>(data: T, status = 200): NextResponse {
  return jsonOk({ data }, status);
}

function unwrap<T>(result: ServiceResult<T>): T {
  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}

function parseListFilters(request: NextRequest): WorkOrderListFilters {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get("limit");

  return compactObject({
    search: readOptionalString(searchParams.get("search")),
    status: readOptionalStatus(searchParams.get("status")),
    priority: readOptionalPriority(searchParams.get("priority")),
    clientOrganizationId: readOptionalString(
      searchParams.get("clientOrganizationId"),
    ),
    locationId: readOptionalString(searchParams.get("locationId")),
    limit:
      limit === null
        ? undefined
        : parseIntegerInRange(limit, "limit", {
            min: 1,
            max: 100,
          }),
  });
}

function normalizeStatusPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...payload,
    status: readRequiredStatus(payload.status),
  };
}

function assertCanCreateWorkOrder(
  context: PhaseThreeApiContext,
  clientOrganizationId: string,
  locationId: string,
): void {
  const organizationId = context.actor.scope.organizationId;
  const allowed = workOrderPolicy.canCreate(context.actor, {
    organizationId,
    clientOrganizationId,
    locationId,
  });

  if (!allowed) {
    throw createAccessDeniedError(
      "You do not have access to create work orders for this client organization and location.",
    );
  }
}

async function assertCanReadWorkOrder(
  context: PhaseThreeApiContext,
  workOrder: WorkOrder | WorkOrderDetail | WorkOrderListItem,
): Promise<void> {
  const permissionTarget = await buildPermissionTarget(context, workOrder);
  const assignments = await context.repositories.assignments.listByWorkOrderId(
    workOrder.id,
  );
  const allowed = workOrderPolicy.canRead(
    context.actor,
    permissionTarget,
    {
      assignments: assignments.items.map((assignment) => ({
        organizationId: assignment.organizationId,
        workOrderId: assignment.workOrderId,
        contractorOrganizationId: assignment.contractorOrganizationId,
      })),
    },
  );

  if (!allowed) {
    throw createAccessDeniedError();
  }
}

async function assertCanUpdateWorkOrder(
  context: PhaseThreeApiContext,
  workOrder: WorkOrder | WorkOrderDetail | WorkOrderListItem,
): Promise<void> {
  const permissionTarget = await buildPermissionTarget(context, workOrder);
  const allowed = workOrderPolicy.canUpdate(context.actor, permissionTarget);

  if (!allowed) {
    throw createAccessDeniedError();
  }
}

async function assertCanTransitionWorkOrder(
  context: PhaseThreeApiContext,
  workOrder: WorkOrder | WorkOrderDetail | WorkOrderListItem,
): Promise<void> {
  const permissionTarget = await buildPermissionTarget(context, workOrder);
  const allowed = workOrderPolicy.canTransition(context.actor, permissionTarget);

  if (!allowed) {
    throw createAccessDeniedError();
  }
}

function assertCanListRequestedScope(
  context: PhaseThreeApiContext,
  filters: WorkOrderListFilters,
): void {
  if (
    context.actor.actorType === "client" &&
    filters.clientOrganizationId &&
    filters.clientOrganizationId !== context.actor.scope.clientOrganizationId
  ) {
    throw createAccessDeniedError(
      "Client users can only list work orders for their own client organization.",
    );
  }

  if (
    context.actor.actorType === "client" &&
    context.actor.scope.locationAccess.kind === "selected_client_locations" &&
    filters.locationId &&
    !context.actor.scope.locationAccess.locationIds.includes(filters.locationId)
  ) {
    throw createAccessDeniedError(
      "Client users can only list work orders for their allowed locations.",
    );
  }
}

async function filterReadableWorkOrders(
  context: PhaseThreeApiContext,
  workOrders: WorkOrderListItemDto[],
  filters: WorkOrderListFilters,
): Promise<WorkOrderListItemDto[]> {
  const readable: WorkOrderListItemDto[] = [];

  for (const workOrder of workOrders) {
    if (
      context.actor.actorType === "client" &&
      context.actor.scope.locationAccess.kind === "selected_client_locations" &&
      !context.actor.scope.locationAccess.locationIds.includes(workOrder.locationId)
    ) {
      continue;
    }

    if (
      filters.clientOrganizationId &&
      workOrder.clientOrganizationId !== filters.clientOrganizationId
    ) {
      continue;
    }

    if (filters.locationId && workOrder.locationId !== filters.locationId) {
      continue;
    }

    try {
      await assertCanReadWorkOrder(context, workOrder);
      readable.push(workOrder);
    } catch {
      continue;
    }
  }

  return readable;
}

async function buildPermissionTarget(
  context: PhaseThreeApiContext,
  workOrder: WorkOrder | WorkOrderDetail | WorkOrderListItem,
) {
  const clientOrganization =
    await context.phaseThree.dependencies.clientOrganizations.getById(
      workOrder.clientOrganizationId,
    );

  if (
    !clientOrganization ||
    clientOrganization.isDeleted ||
    clientOrganization.recordStatus !== "active" ||
    clientOrganization.organizationId !== context.actor.scope.organizationId
  ) {
    throw new AppError({
      code: ERROR_CODES.NotFound,
      message: "Work order could not be found.",
      safeMessage: "Work order could not be found.",
    });
  }

  return {
    id: workOrder.id,
    organizationId: clientOrganization.organizationId,
    clientOrganizationId: workOrder.clientOrganizationId,
    locationId: workOrder.locationId,
  };
}

async function serializeWorkOrderDetail(
  context: PhaseThreeApiContext,
  workOrder: WorkOrderDetailDto,
) {
  return {
    ...workOrder,
    allowedTransitions: workOrder.allowedNextStatuses,
    related: await buildRelatedSummary(context, workOrder),
    notes: workOrder.notes.map(serializeNote),
    attachments: workOrder.attachments.map(serializeAttachment),
  };
}

function serializeWorkOrderListItem(workOrder: WorkOrderListItemDto) {
  return {
    ...workOrder,
    allowedTransitions: workOrder.allowedNextStatuses,
  };
}

function serializeNote(note: WorkOrderNote) {
  return {
    id: note.id,
    workOrderId: note.workOrderId,
    body: note.body,
    createdByUserId: note.createdByUserId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function serializeAttachment(attachment: WorkOrderAttachment) {
  return {
    id: attachment.id,
    workOrderId: attachment.workOrderId,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    fileSizeBytes: attachment.fileSizeBytes,
    storagePath: attachment.storagePath,
    uploadedByUserId: attachment.uploadedByUserId,
    createdAt: attachment.createdAt,
  };
}

async function buildRelatedSummary(
  context: PhaseThreeApiContext,
  workOrder: WorkOrder | WorkOrderDetail | WorkOrderListItem,
): Promise<RelatedSummary> {
  const [clientOrganization, location] = await Promise.all([
    context.phaseThree.dependencies.clientOrganizations.getById(
      workOrder.clientOrganizationId,
    ),
    context.phaseThree.dependencies.locations.getById(workOrder.locationId),
  ]);

  return {
    clientOrganization: {
      id: workOrder.clientOrganizationId,
      name: clientOrganization?.name,
      displayName: clientOrganization?.displayName,
    },
    location: {
      id: workOrder.locationId,
      name: location?.name,
      code: location?.code,
      clientOrganizationId: location?.clientOrganizationId,
    },
  };
}

function readOptionalStatus(value: string | null): WorkOrderStatus | undefined {
  if (value === null) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase() as WorkOrderStatus;
  if (!PHASE_THREE_STATUSES.has(normalized)) {
    throw validationError("status must be one of NEW, OPEN, IN_PROGRESS, COMPLETED, CANCELLED, or CLOSED.");
  }

  return normalized;
}

function readRequiredStatus(value: unknown): WorkOrderStatus {
  if (typeof value !== "string") {
    throw validationError("status is required.");
  }

  const normalized = value.trim().toUpperCase() as WorkOrderStatus;
  if (!PHASE_THREE_STATUSES.has(normalized)) {
    throw validationError("status must be one of NEW, OPEN, IN_PROGRESS, COMPLETED, CANCELLED, or CLOSED.");
  }

  return normalized;
}

function readOptionalPriority(
  value: string | null,
): WorkOrderPriority | undefined {
  if (value === null) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase() as WorkOrderPriority;
  if (!PHASE_THREE_PRIORITIES.has(normalized)) {
    throw validationError("priority must be one of LOW, MEDIUM, HIGH, or URGENT.");
  }

  return normalized;
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw validationError(`${fieldName} is required.`);
  }

  return value.trim();
}

function readOptionalString(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseIntegerInRange(
  value: string,
  fieldName: string,
  range: { min: number; max: number },
): number {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < range.min ||
    parsed > range.max
  ) {
    throw validationError(
      `${fieldName} must be an integer between ${range.min} and ${range.max}.`,
    );
  }

  return parsed;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function validationError(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.ValidationFailed,
    message,
    safeMessage: message,
    statusCode: 422,
  });
}
