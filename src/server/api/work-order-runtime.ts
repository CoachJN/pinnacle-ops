import "server-only";

import { NextResponse } from "next/server";
import {
  createWorkOrderAttachmentRepository,
} from "@/lib/repositories/work-order-attachment.repository";
import {
  createWorkOrderNoteRepository,
} from "@/lib/repositories/work-order-note.repository";
import { createWorkOrderAttachmentReadUrl } from "@/lib/work-orders/attachment-storage.server";
import {
  canUserPerformAction,
  createAccessDeniedError,
} from "@/server/authorization";
import type { WorkOrderApiContext } from "@/server/api/work-orders";
import {
  authorizeWorkOrderCreate,
  createNotFoundAppError,
  jsonOk,
  parseWorkOrderListLimit,
  revalidateWorkOrderPaths,
} from "@/server/api/work-orders";
import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";
import { USER_ROLES } from "@/types/permissions";
import type { WorkOrderPriority, WorkOrderStatus } from "@/types/work-order";
import type {
  Assignment as RepositoryAssignment,
  WorkOrder,
} from "@/server/repositories";
import {
  createWorkOrderAttachmentMetadataSchema,
  createWorkOrderNoteSchema,
  getAllowedNextWorkOrderLifecycleStatuses,
  type CreateWorkOrderDto,
  type WorkOrderAttachment,
  type WorkOrderNote,
} from "@/modules/work-orders";
import { validationError } from "@/server/services/errors";

const noteRepository = createWorkOrderNoteRepository();
const attachmentRepository = createWorkOrderAttachmentRepository();

interface RuntimeWorkOrderListFilters {
  search?: string;
  lifecycleStatus?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  limit?: number;
}

export async function listRuntimeWorkOrders(
  context: WorkOrderApiContext,
  request: Request & { nextUrl: URL },
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  const filters = readListFilters(request);
  const items = await listScopedWorkOrders(context, filters);
  return jsonOk({
    data: {
      workOrders: await Promise.all(
        items.map((workOrder) => serializeWorkOrderListItem(context, workOrder)),
      ),
    },
  });
}

export async function getRuntimeWorkOrderDetail(
  context: WorkOrderApiContext,
  workOrderId: string,
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  const detail = await getRuntimeWorkOrderDetailData(context, workOrderId);
  return jsonOk({
    data: {
      workOrder: detail,
    },
  });
}

export async function getRuntimeWorkOrderDetailData(
  context: WorkOrderApiContext,
  workOrderId: string,
) {
  const workOrder = await context.repositories.workOrders.getById(workOrderId);
  if (!workOrder) {
    throw createNotFoundAppError("Work order could not be found.");
  }

  await authorizeRuntimeWorkOrderRead(context, workOrder);

  return serializeWorkOrderDetail(context, workOrder);
}

export async function createRuntimeWorkOrder(
  context: WorkOrderApiContext,
  payload: CreateWorkOrderDto,
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  const { source: _source, ...servicePayload } = payload;
  await authorizeWorkOrderCreate(context, {
    clientOrganizationId: payload.clientOrganizationId,
    locationId: payload.locationId,
  });

  const result = await context.services.workOrders.create({
    ...context.audit,
    ...servicePayload,
    priority: toLegacyWorkOrderPriority(payload.priority),
  });
  if (!result.ok) {
    throw result.error;
  }

  revalidateWorkOrderPaths(result.value.id);
  return jsonOk({
    data: {
      workOrder: {
        id: result.value.id,
        workOrderNumber: result.value.workOrderNumber,
        title: result.value.title,
      },
    },
  }, 201);
}

function toLegacyWorkOrderPriority(
  priority: CreateWorkOrderDto["priority"],
): WorkOrderPriority {
  switch (priority) {
    case "LOW":
      return "low";
    case "MEDIUM":
      return "medium";
    case "HIGH":
      return "high";
    case "URGENT":
      return "urgent";
  }
}

export async function listRuntimeWorkOrderNotes(
  context: WorkOrderApiContext,
  workOrderId: string,
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  await requireReadableWorkOrder(context, workOrderId);
  const notes = await listCanonicalAndLegacyNotes(context, workOrderId);
  return jsonOk({
    data: {
      notes,
    },
  });
}

export async function addRuntimeWorkOrderNote(
  context: WorkOrderApiContext,
  workOrderId: string,
  payload: Record<string, unknown>,
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  const workOrder = await requireReadableWorkOrder(context, workOrderId);
  if (!canModifyWorkOrderArtifacts(context.actor, workOrder.lifecycleStatus)) {
    throw createAccessDeniedError();
  }

  const parsed = createWorkOrderNoteSchema.parse({
    ...payload,
    createdByUserId: context.actor.userId,
  });
  const note = await context.services.communications.messages.createInternalNote({
    ...context.audit,
    workOrderId: workOrder.id,
    body: parsed.body,
  });
  if (!note.ok) {
    throw note.error;
  }
  revalidateWorkOrderPaths(workOrder.id);
  return jsonOk(
    {
      data: {
        note: toSerializedCommunicationNote(note.value),
      },
    },
    201,
  );
}

export async function listRuntimeWorkOrderCommunications(
  context: WorkOrderApiContext,
  workOrderId: string,
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  const workOrder = await requireReadableWorkOrder(context, workOrderId);
  const communications = await context.services.communications.query.listTimelineForWorkOrder(
    workOrder.id,
    context.actor,
  );
  if (!communications.ok) {
    throw communications.error;
  }
  return jsonOk({
    data: {
      communications: communications.value,
    },
  });
}

export async function addRuntimeWorkOrderCommunication(
  context: WorkOrderApiContext,
  workOrderId: string,
  payload: Record<string, unknown>,
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  const workOrder = await requireReadableWorkOrder(context, workOrderId);
  if (!canModifyWorkOrderArtifacts(context.actor, workOrder.lifecycleStatus)) {
    throw createAccessDeniedError();
  }

  const audience = readCommunicationAudience(payload.audience);
  if (audience === "contractor" && !workOrder.assignedContractorOrgId) {
    throw validationError("A contractor-visible message requires an assigned contractor.");
  }

  const communication = await context.services.communications.messages.create({
    ...context.audit,
    workOrderId: workOrder.id,
    channel: "portal_message",
    direction: "outbound",
    visibility: [audience],
    subject: readOptionalBodyText(payload.subject),
    body: readRequiredBodyText(payload.body, "body"),
    contractorOrganizationId:
      audience === "contractor" ? workOrder.assignedContractorOrgId : null,
  });
  if (!communication.ok) {
    throw communication.error;
  }

  revalidateWorkOrderPaths(workOrder.id);
  return jsonOk(
    {
      data: {
        communication: communication.value,
      },
    },
    201,
  );
}

export async function listRuntimeWorkOrderAttachments(
  context: WorkOrderApiContext,
  workOrderId: string,
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  const workOrder = await requireReadableWorkOrder(context, workOrderId);
  const attachments = await attachmentRepository.listAttachmentsByWorkOrderId(workOrder.id);
  return jsonOk({
    data: {
      attachments: await serializeAttachments(context, attachments),
    },
  });
}

export async function addRuntimeWorkOrderAttachment(
  context: WorkOrderApiContext,
  workOrderId: string,
  payload: Record<string, unknown>,
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  const workOrder = await requireReadableWorkOrder(context, workOrderId);
  if (!canModifyWorkOrderArtifacts(context.actor, workOrder.lifecycleStatus)) {
    throw createAccessDeniedError();
  }

  const parsed = createWorkOrderAttachmentMetadataSchema.parse({
    ...payload,
    uploadedBy: context.actor.userId,
  });
  const attachment = await attachmentRepository.createAttachment({
    workOrderId: workOrder.id,
    data: parsed,
  });
  if (!attachment) {
    throw createNotFoundAppError("Work order could not be found.");
  }

  const communicationAttachment = await context.services.communications.messages.recordAttachment({
    ...context.audit,
    now: attachment.createdAt,
    workOrderId: workOrder.id,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    storagePath: attachment.storagePath,
    visibility: ["internal"],
  });
  if (!communicationAttachment.ok) {
    throw communicationAttachment.error;
  }

  await context.services.domainEvents.record({
    ...context.audit,
    now: attachment.createdAt,
    workOrderId: workOrder.id,
    type: "attachment_added",
    visibility: "internal",
    lifecycleStatus: workOrder.lifecycleStatus,
    entity: {
      entityType: "attachment",
      entityId: attachment.id,
      label: attachment.fileName,
    },
    summary: `Added attachment ${attachment.fileName}.`,
    payload: {
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
    },
  });
  revalidateWorkOrderPaths(workOrder.id);
  return jsonOk(
    {
      data: {
        attachment: (await serializeAttachments(context, [attachment]))[0],
      },
    },
    201,
  );
}

export async function accessRuntimeWorkOrderAttachmentContent(
  context: WorkOrderApiContext,
  workOrderId: string,
  attachmentId: string,
) {
  authorizeInternalRuntimeWorkOrderAccess(context);
  const workOrder = await requireReadableWorkOrder(context, workOrderId);
  const attachments = await attachmentRepository.listAttachmentsByWorkOrderId(workOrder.id);
  const attachment = attachments.find((item) => item.id === attachmentId);
  if (!attachment) {
    throw createNotFoundAppError("Attachment could not be found.");
  }

  const signedUrl = await createWorkOrderAttachmentReadUrl({
    fileName: attachment.fileName,
    storagePath: attachment.storagePath,
  });

  return NextResponse.redirect(signedUrl);
}

export async function serializeWorkOrderDetail(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
) {
  const [notes, attachments, assignmentsResult, timelineResult] = await Promise.all([
    listCanonicalAndLegacyNotes(context, workOrder.id),
    attachmentRepository.listAttachmentsByWorkOrderId(workOrder.id),
    context.repositories.assignments.listByWorkOrderId(workOrder.id),
    context.services.timeline.listForWorkOrder(workOrder.id, context.actor),
  ]);
  const assignments = assignmentsResult.items;
  const activeAssignment = assignments.find(
    (assignment) => assignment.status === "assigned" || assignment.status === "accepted",
  ) ?? null;
  const allowedTransitions = getAllowedTransitions(context, workOrder);
  const allowedActions = getAllowedActions(context.actor, workOrder, activeAssignment, allowedTransitions);
  const assignableContractors =
    context.actor.actorType === "internal"
      ? await context.services.assignments.listAssignableContractors({
          organizationId: context.actor.scope.organizationId,
          workOrderCategory: workOrder.category ?? null,
        })
      : null;

  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    description: workOrder.description,
    clientOrganizationId: workOrder.clientOrganizationId,
    locationId: workOrder.locationId,
    requestedByContactId: workOrder.requestedByContactId ?? null,
    siteContactId: workOrder.siteContactId ?? null,
    assignedContractorOrgId: workOrder.assignedContractorOrgId ?? null,
    lifecycleStatus: workOrder.lifecycleStatus,
    priority: workOrder.priority,
    category: workOrder.category,
    requestedServiceDate: workOrder.requestedServiceDate,
    requiresQuote: workOrder.requiresQuote ?? false,
    quoteRequiredThresholdCents: workOrder.quoteRequiredThresholdCents ?? null,
    requestedByName: workOrder.requestedByName,
    requestedByEmail: workOrder.requestedByEmail ?? null,
    requestedByPhone: workOrder.requestedByPhone ?? null,
    dueDate: workOrder.dueDate ?? null,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
    closedAt: workOrder.closedAt ?? null,
    related: await buildRelatedSummary(context, workOrder),
    notes,
    attachments: await serializeAttachments(context, attachments),
    timeline: timelineResult.ok ? timelineResult.value : [],
    assignments: await serializeAssignments(context, assignments),
    activeAssignment: activeAssignment ? (await serializeAssignments(context, [activeAssignment]))[0] : null,
    activeAssignmentId: activeAssignment?.id ?? null,
    internalAssignees: await resolveInternalAssignees(context, workOrder),
    assignedContractor: await resolveAssignedContractor(
      context,
      workOrder.assignedContractorOrgId ?? null,
    ),
    assignableInternalUsers: await resolveAssignableInternalUsers(context),
    assignableContractors:
      assignableContractors?.ok ? assignableContractors.value : [],
    allowedTransitions,
    allowedActions,
    sectionVisibility: {
      showFinancePanel:
        context.actor.actorType === "internal" &&
        (context.actor.role === USER_ROLES.FinanceAdmin || context.actor.role === USER_ROLES.Owner),
    },
  };
}

async function serializeWorkOrderListItem(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
) {
  return {
    ...workOrder,
    related: await buildRelatedSummary(context, workOrder),
    internalAssignees: await resolveInternalAssignees(context, workOrder),
    assignedContractor: await resolveAssignedContractor(
      context,
      workOrder.assignedContractorOrgId ?? null,
    ),
  };
}

async function requireReadableWorkOrder(
  context: WorkOrderApiContext,
  workOrderId: string,
): Promise<WorkOrder> {
  const workOrder = await context.repositories.workOrders.getById(workOrderId);
  if (!workOrder) {
    throw createNotFoundAppError("Work order could not be found.");
  }

  await authorizeRuntimeWorkOrderRead(context, workOrder);
  return workOrder;
}

function authorizeInternalRuntimeWorkOrderAccess(
  context: WorkOrderApiContext,
): void {
  if (context.actor.actorType !== "internal") {
    throw createAccessDeniedError("Operational work-order runtime endpoints are restricted to internal users.");
  }
}

async function authorizeRuntimeWorkOrderRead(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
) {
  const assignments = await context.repositories.assignments.listByWorkOrderId(workOrder.id);
  const target = {
    id: workOrder.id,
    organizationId: workOrder.organizationId,
    clientOrganizationId: workOrder.clientOrganizationId,
    locationId: workOrder.locationId,
    status: workOrder.lifecycleStatus,
  };
  const relationships = assignments.items
    .filter((assignment) => Boolean(assignment.contractorOrganizationId))
    .map((assignment) => ({
      organizationId: assignment.organizationId,
      workOrderId: assignment.workOrderId,
      contractorOrganizationId: assignment.contractorOrganizationId!,
    }));

  const allowed = canUserPerformAction({
    actor: context.actor,
    entity: "work_order",
    action: "read",
    target,
    context: {
      assignments: relationships,
    },
  });

  if (
    !allowed &&
    !(
      context.actor.actorType === "contractor" &&
      workOrder.assignedContractorOrgId ===
        context.actor.scope.contractorOrganizationId
    )
  ) {
    throw createAccessDeniedError();
  }
}

function getAllowedTransitions(
  context: WorkOrderApiContext,
  workOrder: WorkOrder,
): WorkOrderStatus[] {
  return [
    ...getAllowedNextWorkOrderLifecycleStatuses(workOrder.lifecycleStatus, {
      previousLifecycleStatus: workOrder.previousLifecycleStatus ?? null,
    }),
  ].filter((nextStatus) =>
    canUserPerformAction({
      actor: context.actor,
      entity: "work_order",
      action: "transition",
      target: {
        id: workOrder.id,
        organizationId: workOrder.organizationId,
        clientOrganizationId: workOrder.clientOrganizationId,
        locationId: workOrder.locationId,
        status: workOrder.lifecycleStatus,
      },
      nextStatus,
    }),
  );
}

function getAllowedActions(
  actor: AccessActor,
  workOrder: WorkOrder,
  activeAssignment: RepositoryAssignment | null,
  allowedTransitions: readonly WorkOrderStatus[],
) {
  const isInternalOperations =
    actor.actorType === "internal" &&
    (actor.role === USER_ROLES.Coordinator ||
      actor.role === USER_ROLES.Manager ||
      actor.role === USER_ROLES.Owner);
  const canRespondToAssignment =
    activeAssignment !== null &&
    activeAssignment.status === "assigned" &&
    (actor.userId === activeAssignment.assigneeUserId ||
      actor.role === USER_ROLES.Owner);
  const canCompleteAssignment =
    activeAssignment !== null &&
    activeAssignment.status === "accepted" &&
    (actor.userId === activeAssignment.assigneeUserId || isInternalOperations);

  return {
    canUpdateStatus: allowedTransitions.length > 0,
    canAddNote: canModifyWorkOrderArtifacts(actor, workOrder.lifecycleStatus),
    canAddAttachment: canModifyWorkOrderArtifacts(actor, workOrder.lifecycleStatus),
    canAssign:
      isInternalOperations &&
      !isTerminalStatus(workOrder.lifecycleStatus) &&
      activeAssignment === null,
    canReassign: isInternalOperations && activeAssignment !== null,
    canAcceptAssignment: canRespondToAssignment,
    canDeclineAssignment: canRespondToAssignment,
    canCompleteAssignment,
  };
}

function canModifyWorkOrderArtifacts(
  actor: AccessActor,
  status: WorkOrderStatus,
) {
  return actor.actorType === "internal" && !isTerminalStatus(status);
}

function readCommunicationAudience(value: unknown): "client" | "contractor" {
  if (value === "client" || value === "contractor") {
    return value;
  }
  throw validationError("audience must be either client or contractor.");
}

function readRequiredBodyText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw validationError(`${field} is required.`);
  }
  return value.trim();
}

function readOptionalBodyText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isTerminalStatus(status: WorkOrderStatus) {
  return status === "closed" || status === "cancelled";
}

async function serializeNotes(
  context: WorkOrderApiContext,
  notes: readonly WorkOrderNote[],
) {
  const displayNames = await resolveUserDisplayNames(
    context,
    notes.map((note) => note.createdByUserId),
  );

  return notes.map((note) => ({
    id: note.id,
    workOrderId: note.workOrderId,
    body: note.body,
    createdByUserId: note.createdByUserId,
    authorDisplayName: displayNames.get(note.createdByUserId) ?? note.createdByUserId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }));
}

async function listCanonicalAndLegacyNotes(
  context: WorkOrderApiContext,
  workOrderId: EntityId,
) {
  const [legacyNotes, canonicalNotes] = await Promise.all([
    noteRepository.listNotesByWorkOrderId(workOrderId),
    context.services.communications.query.listInternalNotesForWorkOrder(workOrderId),
  ]);
  const serializedLegacy = await serializeNotes(context, legacyNotes);
  const serializedCanonical = canonicalNotes.ok
    ? canonicalNotes.value.map(toSerializedCommunicationNote)
    : [];

  return [...serializedCanonical, ...serializedLegacy].sort((left, right) => {
    const timeOrder = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (timeOrder !== 0) {
      return timeOrder;
    }

    return right.id.localeCompare(left.id);
  });
}

function toSerializedCommunicationNote(note: {
  id: string;
  workOrderId: string | null;
  body: string;
  senderActorId: string | null;
  createdAt: string;
  createdByActor: { displayName: string | null };
}) {
  return {
    id: note.id,
    workOrderId: note.workOrderId ?? "",
    body: note.body,
    createdByUserId: note.senderActorId ?? "system",
    authorDisplayName: note.createdByActor.displayName ?? "System",
    createdAt: note.createdAt,
    updatedAt: note.createdAt,
  };
}

async function serializeAttachments(
  context: WorkOrderApiContext,
  attachments: readonly WorkOrderAttachment[],
) {
  const displayNames = await resolveUserDisplayNames(
    context,
    attachments.map((attachment) => attachment.uploadedBy),
  );

  return attachments.map((attachment) => ({
    id: attachment.id,
    workOrderId: attachment.workOrderId,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    uploadedBy: attachment.uploadedBy,
    uploadedByDisplayName:
      displayNames.get(attachment.uploadedBy) ?? attachment.uploadedBy,
    createdAt: attachment.createdAt,
    visibility: ["internal"] as const,
    accessPath: `/api/work-orders/${attachment.workOrderId}/attachments/${attachment.id}/content`,
  }));
}

async function serializeAssignments(
  context: WorkOrderApiContext,
  assignments: readonly RepositoryAssignment[],
) {
  const displayNames = await resolveUserDisplayNames(
    context,
    assignments.flatMap((assignment) => [assignment.assigneeUserId, assignment.assignedByUserId]),
  );

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

async function buildRelatedSummary(
  context: WorkOrderApiContext,
  workOrder: Pick<WorkOrder, "clientOrganizationId" | "locationId">,
) {
  const [clientOrganization, location] = await Promise.all([
    context.repositories.clientOrganizations.getById(workOrder.clientOrganizationId),
    context.repositories.locations.getById(workOrder.locationId),
  ]);

  return {
    clientOrganization: clientOrganization
      ? {
          id: clientOrganization.id,
          name: clientOrganization.name,
          displayName: clientOrganization.displayName ?? undefined,
        }
      : { id: workOrder.clientOrganizationId },
    location: location
      ? {
          id: location.id,
          name: location.name,
          code: location.code ?? undefined,
        }
      : { id: workOrder.locationId },
  };
}

async function resolveInternalAssignees(
  context: WorkOrderApiContext,
  workOrder: Pick<WorkOrder, "coordinatorUserId" | "managerUserId">,
) {
  const ids = [workOrder.coordinatorUserId, workOrder.managerUserId].filter(Boolean) as string[];
  const displayNames = await resolveUserDisplayNames(context, ids);

  return {
    coordinator: workOrder.coordinatorUserId
      ? {
          id: workOrder.coordinatorUserId,
          label:
            displayNames.get(workOrder.coordinatorUserId) ?? workOrder.coordinatorUserId,
          role: USER_ROLES.Coordinator,
        }
      : null,
    manager: workOrder.managerUserId
      ? {
          id: workOrder.managerUserId,
          label: displayNames.get(workOrder.managerUserId) ?? workOrder.managerUserId,
          role: USER_ROLES.Manager,
        }
      : null,
  };
}

async function resolveAssignedContractor(
  context: WorkOrderApiContext,
  contractorOrganizationId: string | null,
) {
  if (!contractorOrganizationId) {
    return null;
  }

  const contractor = await context.repositories.contractorOrganizations.getById(
    contractorOrganizationId,
  );
  return {
    id: contractorOrganizationId,
    label: contractor?.displayName ?? contractor?.name ?? contractorOrganizationId,
  };
}

async function resolveAssignableInternalUsers(context: WorkOrderApiContext) {
  if (context.actor.actorType !== "internal") {
    return [];
  }

  const profiles = await context.repositories.userProfiles.listByOrganizationId(
    context.actor.scope.organizationId,
    { limit: 200 },
  );
  return profiles.items
    .filter((profile) => !profile.isDeleted && profile.status === "active")
    .filter((profile) =>
      profile.role === USER_ROLES.Coordinator ||
      profile.role === USER_ROLES.Manager ||
      profile.role === USER_ROLES.Owner,
    )
    .map((profile) => ({
      id: profile.id,
      label: profile.displayName ?? profile.email,
      role: profile.role,
    }));
}

async function resolveUserDisplayNames(
  context: WorkOrderApiContext,
  userIds: readonly string[],
) {
  const ids = [...new Set(userIds.map((value) => value.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const profiles = await context.repositories.userProfiles.listByOrganizationId(
    context.actor.scope.organizationId,
    { limit: 500 },
  );
  const displayNames = new Map<string, string>();

  for (const profile of profiles.items) {
    if (ids.includes(profile.id) && !profile.isDeleted && profile.status === "active") {
      displayNames.set(profile.id, profile.displayName ?? profile.email);
    }
  }

  return displayNames;
}

async function listScopedWorkOrders(
  context: WorkOrderApiContext,
  filters: RuntimeWorkOrderListFilters,
) {
  const scope = context.actor.actorType === "internal"
    ? { scope: "organization" as const, organizationId: context.actor.scope.organizationId, limit: filters.limit }
    : context.actor.actorType === "client"
      ? context.actor.scope.locationAccess.kind === "selected_client_locations"
        ? { scope: "locations" as const, locationIds: context.actor.scope.locationAccess.locationIds, limit: filters.limit }
        : {
            scope: "clientOrganization" as const,
            clientOrganizationId: context.actor.scope.clientOrganizationId,
            limit: filters.limit,
          }
      : {
          scope: "contractorOrganization" as const,
          contractorOrganizationId: context.actor.scope.contractorOrganizationId,
          limit: filters.limit,
        };
  const result = await context.services.workOrders.list(scope);
  if (!result.ok) {
    throw result.error;
  }

  const normalizedSearch = filters.search?.toLowerCase();
  const baseItems = result.value.filter((item) => {
    if (filters.lifecycleStatus && item.lifecycleStatus !== filters.lifecycleStatus) {
      return false;
    }
    if (filters.priority && item.priority !== filters.priority) {
      return false;
    }
    if (filters.clientOrganizationId && item.clientOrganizationId !== filters.clientOrganizationId) {
      return false;
    }
    if (filters.locationId && item.locationId !== filters.locationId) {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    return [
      item.workOrderNumber,
      item.title,
      item.description,
      item.clientSnapshot.name,
      item.locationSnapshot.name,
      item.requestedByName ?? "",
    ].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  if (context.actor.actorType === "internal") {
    return baseItems;
  }

  if (context.actor.actorType === "client") {
    const { clientOrganizationId, locationAccess } = context.actor.scope;
    if (locationAccess.kind === "selected_client_locations") {
      const visibleLocationIds = new Set(locationAccess.locationIds);
      return baseItems.filter((item) => visibleLocationIds.has(item.locationId));
    }

    return baseItems.filter(
      (item) => item.clientOrganizationId === clientOrganizationId,
    );
  }

  const { contractorOrganizationId } = context.actor.scope;
  return baseItems.filter(
    (item) => item.assignedContractorOrgId === contractorOrganizationId,
  );
}

function readListFilters(
  request: Request & { nextUrl: URL },
): RuntimeWorkOrderListFilters {
  const searchParams = request.nextUrl.searchParams;
  return {
    search: searchParams.get("search")?.trim() || undefined,
    lifecycleStatus:
      (searchParams.get("lifecycleStatus")?.trim() as WorkOrderStatus | null) ??
      (searchParams.get("status")?.trim() as WorkOrderStatus | null) ??
      undefined,
    priority: (searchParams.get("priority")?.trim() as WorkOrderPriority | null) ?? undefined,
    clientOrganizationId: searchParams.get("clientOrganizationId")?.trim() || undefined,
    locationId: searchParams.get("locationId")?.trim() || undefined,
    limit: parseWorkOrderListLimit(request as never),
  };
}
