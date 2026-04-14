import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import { createWorkOrderAttachmentReadUrl } from "@/lib/work-orders/attachment-storage.server";
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
  buildWorkOrderDetailAggregate,
  createAddWorkOrderAttachmentService,
  createAddWorkOrderNoteService,
  createCreateWorkOrderService,
  createGetWorkOrderDetailService,
  createListWorkOrdersService,
  createWorkOrderServiceDependencies,
  type WorkOrderDetailDto,
  type WorkOrderListItemDto,
} from "@/server/services/work-order-service";
import {
  getAllowedWorkOrderActions,
  transitionWorkOrderStatusWithAssignmentChecks,
} from "@/server/services/work-order-service";
import { workOrderPolicy } from "@/lib/access-policy";
import { createAccessDeniedError } from "@/server/authorization";
import {
  canAddWorkOrderAttachment,
  canAddWorkOrderNote,
  canCreateWorkOrder,
  canUpdateWorkOrderStatus,
  type WorkOrderPermissionTarget,
} from "@/server/authorization/work-order.permissions";
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
import { USER_ROLES } from "@/types/permissions";

const PHASE_THREE_STATUSES = new Set<WorkOrderStatus>([
  "NEW",
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "READY_FOR_INVOICING",
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

interface SerializedWorkOrderNote {
  id: string;
  workOrderId: string;
  body: string;
  createdByUserId: string;
  authorDisplayName: string;
  createdAt: string;
  updatedAt: string;
}

interface SerializedWorkOrderAttachment {
  id: string;
  workOrderId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string;
  uploadedByDisplayName: string;
  createdAt: string;
  accessPath: string;
}

interface SerializedWorkOrderAssignment {
  id: string;
  workOrderId: string;
  contractorOrganizationId: string | null;
  assigneeType: "internal" | "contractor";
  assigneeUserId: string;
  assigneeDisplayName: string;
  assignedByUserId: string;
  assignedByDisplayName: string;
  status: string;
  scheduledDate: string | null;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SerializedAssignableUser {
  id: string;
  label: string;
  role: string;
}

interface SerializedInternalAssignees {
  coordinator: SerializedAssignableUser | null;
  manager: SerializedAssignableUser | null;
}

interface SerializedAssignableContractor {
  id: string;
  label: string;
  status: string;
  serviceCategories: string[];
  isAssignable: boolean;
  reason: string | null;
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
    workOrders: readableWorkOrders.map((workOrder) =>
      serializeWorkOrderListItem(context, workOrder),
    ),
  });
}

export async function getPhaseThreeWorkOrderDetail(
  context: PhaseThreeApiContext,
  workOrderId: string,
): Promise<NextResponse> {
  return jsonData({
    workOrder: await getSerializedPhaseThreeWorkOrderDetail(context, workOrderId),
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

  const payload = await parseJsonObject(request);
  const nextStatus = readRequiredStatus(payload.status);
  await assertCanTransitionWorkOrder(context, existing, nextStatus);
  const updated = unwrap(await transitionWorkOrderStatusWithAssignmentChecks(
    {
      activityLogs: context.services.activityLogs,
      assignments: context.repositories.assignments,
      workOrders: context.phaseThree.dependencies.workOrders,
    },
    context.actor,
    {
      ...context.audit,
      workOrderId,
      payload: {
        ...payload,
        status: nextStatus,
      },
    },
  ));

  revalidateWorkOrderPaths(updated.id);

  return jsonData({
    workOrder: await serializeWorkOrderDetail(
      context,
      await buildWorkOrderDetailAggregate(context.phaseThree.dependencies, updated),
    ),
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
    notes: await serializeNotes(context, detail.notes),
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
  await assertCanAddNoteToWorkOrder(context, existing);

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
      note: await serializeNote(context, created),
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
    attachments: await serializeAttachments(context, detail.attachments),
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
  await assertCanAddAttachmentToWorkOrder(context, existing);

  const payload = await parseJsonObject(request);
  const created = unwrap(
    await context.phaseThree.services.addAttachment.addWorkOrderAttachment({
      workOrderId,
      payload: {
        ...payload,
        uploadedBy: context.actor.userId,
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

export async function accessPhaseThreeWorkOrderAttachmentContent(
  context: PhaseThreeApiContext,
  workOrderId: string,
  attachmentId: string,
): Promise<NextResponse> {
  const detail = unwrap(
    await context.phaseThree.services.detail.getWorkOrderDetail({ workOrderId }),
  );
  await assertCanReadWorkOrder(context, detail);

  const attachment = detail.attachments.find((item) => item.id === attachmentId);
  if (!attachment) {
    throw new AppError({
      code: ERROR_CODES.NotFound,
      message: "Attachment could not be found.",
    });
  }

  const signedUrl = await createWorkOrderAttachmentReadUrl({
    fileName: attachment.fileName,
    storagePath: attachment.storagePath,
  });

  return NextResponse.redirect(signedUrl);
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

function assertCanCreateWorkOrder(
  context: PhaseThreeApiContext,
  clientOrganizationId: string,
  locationId: string,
): void {
  const organizationId = context.actor.scope.organizationId;
  const allowed = canCreateWorkOrder(context.actor, {
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
    {
      id: permissionTarget.id,
      organizationId: permissionTarget.organizationId,
      clientOrganizationId: permissionTarget.clientOrganizationId,
      locationId: permissionTarget.locationId,
    },
    {
      assignments: assignments.items
        .filter((assignment) => Boolean(assignment.contractorOrganizationId))
        .map((assignment) => ({
          organizationId: assignment.organizationId,
          workOrderId: assignment.workOrderId,
          contractorOrganizationId: assignment.contractorOrganizationId!,
        })),
    },
  );

  if (!allowed) {
    throw createAccessDeniedError();
  }
}

async function assertCanTransitionWorkOrder(
  context: PhaseThreeApiContext,
  workOrder: WorkOrder | WorkOrderDetail | WorkOrderListItem,
  nextStatus: WorkOrderStatus,
): Promise<void> {
  const permissionTarget = await buildPermissionTarget(context, workOrder);
  const allowed = canUpdateWorkOrderStatus(
    context.actor,
    permissionTarget,
    nextStatus,
  );

  if (!allowed) {
    throw createAccessDeniedError();
  }
}

async function assertCanAddNoteToWorkOrder(
  context: PhaseThreeApiContext,
  workOrder: WorkOrder | WorkOrderDetail | WorkOrderListItem,
): Promise<void> {
  const allowed = canAddWorkOrderNote(
    context.actor,
    await buildPermissionTarget(context, workOrder),
  );

  if (!allowed) {
    throw createAccessDeniedError();
  }
}

async function assertCanAddAttachmentToWorkOrder(
  context: PhaseThreeApiContext,
  workOrder: WorkOrder | WorkOrderDetail | WorkOrderListItem,
): Promise<void> {
  const allowed = canAddWorkOrderAttachment(
    context.actor,
    await buildPermissionTarget(context, workOrder),
  );

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
): Promise<WorkOrderPermissionTarget & { id: string; status: WorkOrderStatus }> {
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
    status: workOrder.status,
    requestedByUserId:
      "createdByUserId" in workOrder ? workOrder.createdByUserId : undefined,
    assignedCoordinatorUserId: workOrder.assignedCoordinatorUserId,
    assignedManagerUserId: workOrder.assignedManagerUserId,
  };
}

export async function getSerializedPhaseThreeWorkOrderDetail(
  context: PhaseThreeApiContext,
  workOrderId: string,
) {
  const detail = unwrap(
    await context.phaseThree.services.detail.getWorkOrderDetail({ workOrderId }),
  );

  await assertCanReadWorkOrder(context, detail);

  return serializeWorkOrderDetail(context, detail);
}

async function serializeWorkOrderDetail(
  context: PhaseThreeApiContext,
  workOrder: WorkOrderDetailDto,
) {
  if (context.actor.actorType === "client") {
    return {
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      description: workOrder.description,
      clientOrganizationId: workOrder.clientOrganizationId,
      locationId: workOrder.locationId,
      status: workOrder.status,
      priority: workOrder.priority,
      category: workOrder.category,
      requestedByName: workOrder.requestedByName,
      requestedByEmail: workOrder.requestedByEmail,
      requestedByPhone: workOrder.requestedByPhone,
      dueDate: workOrder.dueDate,
      createdAt: workOrder.createdAt,
      updatedAt: workOrder.updatedAt,
      closedAt: workOrder.closedAt,
      related: await buildRelatedSummary(context, workOrder),
      allowedTransitions: [],
      allowedActions: {
        canUpdateStatus: false,
        canAddNote: false,
        canAddAttachment: false,
        canAssign: false,
        canReassign: false,
        canAcceptAssignment: false,
        canDeclineAssignment: false,
        canCompleteAssignment: false,
      },
    };
  }

  const assignmentsResult = await context.repositories.assignments.listByWorkOrderId(
    workOrder.id,
  );
  const activeAssignment = assignmentsResult.items.find((assignment) =>
    assignment.status === "assigned" || assignment.status === "accepted"
  ) ?? null;
  const actionAvailability = getAllowedWorkOrderActions({
    actor: context.actor,
    workOrder,
    activeAssignment: activeAssignment
      ? {
          id: activeAssignment.id,
          workOrderId: activeAssignment.workOrderId,
          assigneeType: activeAssignment.assigneeType,
          assigneeUserId: activeAssignment.assigneeUserId,
          assigneeOrganizationId: activeAssignment.assigneeOrganizationId,
          assignedByUserId: activeAssignment.assignedByUserId,
          status: activeAssignment.status,
          scheduledDate: activeAssignment.scheduledDate,
          timeWindowStart: activeAssignment.timeWindowStart,
          timeWindowEnd: activeAssignment.timeWindowEnd,
          assignedAt: activeAssignment.assignedAt,
          acceptedAt: activeAssignment.acceptedAt,
          declinedAt: activeAssignment.declinedAt,
          completedAt: activeAssignment.completedAt,
          notes: activeAssignment.notes,
          createdAt: activeAssignment.createdAt,
          updatedAt: activeAssignment.updatedAt,
        }
      : null,
  });
  return {
    ...workOrder,
    allowedTransitions: actionAvailability.availableStatusTransitions,
    activeAssignmentId: activeAssignment?.id ?? null,
    activeAssignment: activeAssignment
      ? await serializeAssignment(context, activeAssignment)
      : null,
    assignments: await serializeAssignments(context, assignmentsResult.items),
    internalAssignees: await resolveInternalAssignees(context, workOrder),
    assignableInternalUsers: await resolveAssignableInternalUsers(context),
    assignableContractors:
      context.actor.actorType === "internal"
        ? unwrap(
            await context.services.assignments.listAssignableContractors({
              organizationId: context.actor.scope.organizationId,
              workOrderCategory: workOrder.category,
            }),
          )
        : [],
    related: await buildRelatedSummary(context, workOrder),
    notes: await serializeNotes(context, workOrder.notes),
    attachments: await serializeAttachments(context, workOrder.attachments),
    allowedActions: actionAvailability,
  };
}

function serializeClientWorkOrderListItem(workOrder: WorkOrderListItemDto) {
  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    clientOrganizationId: workOrder.clientOrganizationId,
    locationId: workOrder.locationId,
    status: workOrder.status,
    priority: workOrder.priority,
    category: workOrder.category,
    dueDate: workOrder.dueDate,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
  };
}

function serializeWorkOrderListItem(
  context: PhaseThreeApiContext,
  workOrder: WorkOrderListItemDto,
) {
  if (context.actor.actorType === "client") {
    return serializeClientWorkOrderListItem(workOrder);
  }

  return serializeWorkOrderListItemInternal(workOrder);
}

function serializeWorkOrderListItemInternal(workOrder: WorkOrderListItemDto) {
  return {
    ...workOrder,
    allowedTransitions: workOrder.allowedNextStatuses,
  };
}

async function serializeNotes(
  context: PhaseThreeApiContext,
  notes: readonly WorkOrderNote[],
): Promise<SerializedWorkOrderNote[]> {
  const authorDisplayNames = await resolveNoteAuthorDisplayNames(context, notes);

  return notes.map((note) => serializeNoteFromDisplayName(note, authorDisplayNames));
}

async function serializeNote(
  context: PhaseThreeApiContext,
  note: WorkOrderNote,
): Promise<SerializedWorkOrderNote> {
  const authorDisplayNames = await resolveNoteAuthorDisplayNames(context, [note]);
  return serializeNoteFromDisplayName(note, authorDisplayNames);
}

async function serializeAttachments(
  context: PhaseThreeApiContext,
  attachments: readonly WorkOrderAttachment[],
): Promise<SerializedWorkOrderAttachment[]> {
  const uploaderDisplayNames = await resolveAttachmentUploaderDisplayNames(
    context,
    attachments,
  );

  return attachments.map((attachment) =>
    serializeAttachmentFromDisplayName(attachment, uploaderDisplayNames),
  );
}

async function serializeAssignments(
  context: PhaseThreeApiContext,
  assignments: readonly import("@/server/repositories").Assignment[],
): Promise<SerializedWorkOrderAssignment[]> {
  const displayNames = await resolveAssignmentDisplayNames(context, assignments);

  return assignments.map((assignment) => ({
    id: assignment.id,
    workOrderId: assignment.workOrderId,
    contractorOrganizationId: assignment.contractorOrganizationId,
    assigneeType: assignment.assigneeType,
    assigneeUserId: assignment.assigneeUserId,
    assigneeDisplayName:
      assignment.contractorSnapshot?.name ??
      displayNames.get(assignment.assigneeUserId) ??
      assignment.assigneeUserId,
    assignedByUserId: assignment.assignedByUserId,
    assignedByDisplayName:
      displayNames.get(assignment.assignedByUserId) ?? assignment.assignedByUserId,
    status: assignment.status,
    scheduledDate: assignment.scheduledDate,
    timeWindowStart: assignment.timeWindowStart,
    timeWindowEnd: assignment.timeWindowEnd,
    assignedAt: assignment.assignedAt,
    acceptedAt: assignment.acceptedAt,
    declinedAt: assignment.declinedAt,
    completedAt: assignment.completedAt,
    notes: assignment.notes,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  }));
}

async function serializeAssignment(
  context: PhaseThreeApiContext,
  assignment: import("@/server/repositories").Assignment,
): Promise<SerializedWorkOrderAssignment> {
  const [serialized] = await serializeAssignments(context, [assignment]);
  return serialized;
}

function serializeNoteFromDisplayName(
  note: WorkOrderNote,
  authorDisplayNames: ReadonlyMap<string, string>,
): SerializedWorkOrderNote {
  return {
    id: note.id,
    workOrderId: note.workOrderId,
    body: note.body,
    createdByUserId: note.createdByUserId,
    authorDisplayName:
      authorDisplayNames.get(note.createdByUserId) ?? note.createdByUserId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function serializeAttachment(attachment: WorkOrderAttachment) {
  return serializeAttachmentFromDisplayName(
    attachment,
    new Map([[attachment.uploadedBy, attachment.uploadedBy]]),
  );
}

function serializeAttachmentFromDisplayName(
  attachment: WorkOrderAttachment,
  uploaderDisplayNames: ReadonlyMap<string, string>,
): SerializedWorkOrderAttachment {
  return {
    id: attachment.id,
    workOrderId: attachment.workOrderId,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    storagePath: attachment.storagePath,
    uploadedBy: attachment.uploadedBy,
    uploadedByDisplayName:
      uploaderDisplayNames.get(attachment.uploadedBy) ?? attachment.uploadedBy,
    createdAt: attachment.createdAt,
    accessPath: `/api/work-orders/${attachment.workOrderId}/attachments/${attachment.id}/content`,
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

async function resolveNoteAuthorDisplayNames(
  context: PhaseThreeApiContext,
  notes: readonly WorkOrderNote[],
): Promise<Map<string, string>> {
  const uniqueUserIds = Array.from(
    new Set(notes.map((note) => note.createdByUserId.trim()).filter(Boolean)),
  );

  const authorEntries = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const profile = await context.repositories.userProfiles.getById(userId);
      const displayName = profile?.displayName?.trim() || profile?.email?.trim() || userId;
      return [userId, displayName] as const;
    }),
  );

  return new Map(authorEntries);
}

async function resolveAttachmentUploaderDisplayNames(
  context: PhaseThreeApiContext,
  attachments: readonly WorkOrderAttachment[],
): Promise<Map<string, string>> {
  const uniqueUserIds = Array.from(
    new Set(attachments.map((attachment) => attachment.uploadedBy.trim()).filter(Boolean)),
  );

  const uploaderEntries = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const profile = await context.repositories.userProfiles.getById(userId);
      const displayName = profile?.displayName?.trim() || profile?.email?.trim() || userId;
      return [userId, displayName] as const;
    }),
  );

  return new Map(uploaderEntries);
}

async function resolveAssignmentDisplayNames(
  context: PhaseThreeApiContext,
  assignments: readonly import("@/server/repositories").Assignment[],
): Promise<Map<string, string>> {
  const uniqueUserIds = Array.from(
    new Set(
      assignments.flatMap((assignment) => [
        assignment.assigneeUserId.trim(),
        assignment.assignedByUserId.trim(),
      ]).filter(Boolean),
    ),
  );

  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const profile = await context.repositories.userProfiles.getById(userId);
      const displayName = profile?.displayName?.trim() || profile?.email?.trim() || userId;
      return [userId, displayName] as const;
    }),
  );

  return new Map(entries);
}

async function resolveAssignableInternalUsers(
  context: PhaseThreeApiContext,
): Promise<SerializedAssignableUser[]> {
  if (context.actor.actorType !== "internal") {
    return [];
  }

  const profiles = await context.repositories.userProfiles.listByOrganizationId(
    context.actor.scope.organizationId,
    { limit: 200 },
  );

  return profiles.items
    .filter((profile) => {
      if (profile.status !== "active" || profile.isDeleted) {
        return false;
      }

      return (
        profile.role === USER_ROLES.Coordinator ||
        profile.role === USER_ROLES.Manager ||
        profile.role === USER_ROLES.Owner
      );
    })
    .map((profile) => ({
      id: profile.id,
      label: profile.displayName?.trim() || profile.email,
      role: profile.role,
    }));
}

async function resolveInternalAssignees(
  context: PhaseThreeApiContext,
  workOrder: WorkOrderDetailDto,
): Promise<SerializedInternalAssignees> {
  const [coordinator, manager] = await Promise.all([
    resolveInternalAssignee(context, workOrder.assignedCoordinatorUserId),
    resolveInternalAssignee(context, workOrder.assignedManagerUserId),
  ]);

  return {
    coordinator,
    manager,
  };
}

async function resolveInternalAssignee(
  context: PhaseThreeApiContext,
  userId: string | null,
): Promise<SerializedAssignableUser | null> {
  if (!userId) {
    return null;
  }

  const profile = await context.repositories.userProfiles.getById(userId);
  if (!profile || profile.isDeleted) {
    return {
      id: userId,
      label: userId,
      role: "unknown",
    };
  }

  return {
    id: profile.id,
    label: profile.displayName?.trim() || profile.email,
    role: profile.role,
  };
}

function readOptionalStatus(value: string | null): WorkOrderStatus | undefined {
  if (value === null) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase() as WorkOrderStatus;
  if (!PHASE_THREE_STATUSES.has(normalized)) {
    throw validationError(
      "status must be one of NEW, OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, READY_FOR_INVOICING, CANCELLED, or CLOSED.",
    );
  }

  return normalized;
}

function readRequiredStatus(value: unknown): WorkOrderStatus {
  if (typeof value !== "string") {
    throw validationError("status is required.");
  }

  const normalized = value.trim().toUpperCase() as WorkOrderStatus;
  if (!PHASE_THREE_STATUSES.has(normalized)) {
    throw validationError(
      "status must be one of NEW, OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, READY_FOR_INVOICING, CANCELLED, or CLOSED.",
    );
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
