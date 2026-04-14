import "server-only";

import { z, type ZodType } from "zod";

import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import {
  createClientOrganizationRepository,
  type ClientOrganizationRepository,
} from "@/lib/repositories/client-organization.repository";
import {
  createLocationRepository,
  type LocationRepository,
} from "@/lib/repositories/location.repository";
import {
  createWorkOrderAttachmentRepository,
  type WorkOrderAttachmentRepository,
} from "@/lib/repositories/work-order-attachment.repository";
import {
  createWorkOrderNoteRepository,
  type WorkOrderNoteRepository,
} from "@/lib/repositories/work-order-note.repository";
import {
  createWorkOrderRepository,
  type WorkOrderRepository,
} from "@/lib/repositories/work-order.repository";
import { validationError, notFoundError, conflictError } from "@/server/services/errors";
import {
  serviceFail,
  serviceOk,
  type ServiceResult,
} from "@/server/services/types";
import {
  createWorkOrderSchema,
  getAllowedNextWorkOrderStatuses,
  isWorkOrderStatusTransitionAllowed,
  workOrderListQuerySchema,
  updateWorkOrderStatusSchema,
  createWorkOrderNoteSchema,
  createWorkOrderAttachmentMetadataSchema,
  type CreateWorkOrderAttachmentMetadataDto,
  type CreateWorkOrderDto,
  type CreateWorkOrderNoteDto,
  type UpdateWorkOrderStatusDto,
  type WorkOrder,
  type WorkOrderAttachment,
  type WorkOrderDetail,
  type WorkOrderListItem,
  type WorkOrderListQueryDto,
  type WorkOrderNote,
  type WorkOrderStatus,
} from "@/modules/work-orders";
import type { ClientOrganization } from "@/types/client-organization";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { Location } from "@/types/location";

export interface WorkOrderServiceDependencies {
  workOrders: WorkOrderRepository;
  clientOrganizations: ClientOrganizationRepository;
  locations: LocationRepository;
  notes: WorkOrderNoteRepository;
  attachments: WorkOrderAttachmentRepository;
}

export interface WorkOrderStatusControls {
  allowInitialStatusOverride?: boolean;
}

export interface WorkOrderActionAvailability {
  canUpdateStatus: boolean;
  canAddNote: boolean;
  canAddAttachment: boolean;
}

export interface WorkOrderListItemDto extends WorkOrderListItem {
  allowedNextStatuses: readonly WorkOrderStatus[];
  allowedActions: WorkOrderActionAvailability;
}

export interface WorkOrderDetailDto extends WorkOrderDetail {
  allowedNextStatuses: readonly WorkOrderStatus[];
  allowedActions: WorkOrderActionAvailability;
}

export interface WorkOrderListResultDto {
  items: WorkOrderListItemDto[];
}

export interface ValidatedWorkOrderRelationship {
  clientOrganization: ClientOrganization;
  location: Location;
}

export function createWorkOrderServiceDependencies(
  overrides: Partial<WorkOrderServiceDependencies> = {},
): WorkOrderServiceDependencies {
  return {
    workOrders: overrides.workOrders ?? createWorkOrderRepository(),
    clientOrganizations:
      overrides.clientOrganizations ?? createClientOrganizationRepository(),
    locations: overrides.locations ?? createLocationRepository(),
    notes: overrides.notes ?? createWorkOrderNoteRepository(),
    attachments:
      overrides.attachments ?? createWorkOrderAttachmentRepository(),
  };
}

export function parseWorkOrderCreatePayload(
  payload: unknown,
): ServiceResult<CreateWorkOrderDto> {
  return parseSchema(createWorkOrderSchema, payload);
}

export function parseWorkOrderListQuery(
  query: unknown,
): ServiceResult<WorkOrderListQueryDto> {
  return parseSchema(workOrderListQuerySchema, query ?? {});
}

export function parseWorkOrderStatusPayload(
  payload: unknown,
): ServiceResult<UpdateWorkOrderStatusDto> {
  return parseSchema(updateWorkOrderStatusSchema, payload);
}

export function parseWorkOrderNotePayload(
  payload: unknown,
): ServiceResult<CreateWorkOrderNoteDto> {
  return parseSchema(createWorkOrderNoteSchema, payload);
}

export function parseWorkOrderAttachmentPayload(
  payload: unknown,
): ServiceResult<CreateWorkOrderAttachmentMetadataDto> {
  return parseSchema(createWorkOrderAttachmentMetadataSchema, payload);
}

export async function validateWorkOrderRelationships(
  dependencies: Pick<
    WorkOrderServiceDependencies,
    "clientOrganizations" | "locations"
  >,
  input: {
    clientOrganizationId: EntityId;
    locationId: EntityId;
  },
): Promise<ServiceResult<ValidatedWorkOrderRelationship>> {
  const clientOrganization = await dependencies.clientOrganizations.getById(
    input.clientOrganizationId,
  );
  if (
    !clientOrganization ||
    clientOrganization.isDeleted ||
    clientOrganization.recordStatus !== "active"
  ) {
    return serviceFail(
      notFoundError("Client organization could not be found."),
    );
  }

  const location = await dependencies.locations.getById(input.locationId);
  if (!location || location.isDeleted || location.recordStatus !== "active") {
    return serviceFail(notFoundError("Location could not be found."));
  }

  const belongsToClient = await dependencies.locations.verifyBelongsToOrganization(
    input.locationId,
    input.clientOrganizationId,
  );
  if (!belongsToClient) {
    return serviceFail(
      validationError(
        "Selected location does not belong to the specified client organization.",
      ),
    );
  }

  return serviceOk({ clientOrganization, location });
}

export function generateWorkOrderNumber(workOrderId: EntityId): string {
  const normalizedId = normalizeRequiredIdentifier(workOrderId, "workOrderId");
  return `WO-${normalizedId.slice(0, 8).toUpperCase()}`;
}

export function normalizeWorkOrderSearchText(input: {
  workOrderNumber: string;
  title: string;
  description: string;
  requestedByName: string;
  requestedByEmail: string | null | undefined;
  requestedByPhone: string | null | undefined;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}): string {
  return [
    input.workOrderNumber,
    input.title,
    input.description,
    input.requestedByName,
    input.requestedByEmail ?? "",
    input.requestedByPhone ?? "",
    input.clientOrganizationId,
    input.locationId,
  ]
    .map((value) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
        .replace(/\s+/g, " "),
    )
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function resolveInitialWorkOrderStatus(
  payload: CreateWorkOrderDto,
  controls: WorkOrderStatusControls = {},
): ServiceResult<WorkOrderStatus> {
  if (!payload.status || !controls.allowInitialStatusOverride) {
    return serviceOk("NEW");
  }

  if (
    payload.status !== "NEW" &&
    !isWorkOrderStatusTransitionAllowed("NEW", payload.status)
  ) {
    return serviceFail(
      validationError(
        `Initial work order status ${payload.status} is not allowed from NEW.`,
      ),
    );
  }

  return serviceOk(payload.status);
}

export function calculateAllowedNextStatuses(
  status: WorkOrderStatus,
): readonly WorkOrderStatus[] {
  return getAllowedNextWorkOrderStatuses(status);
}

export function calculateAllowedActions(
  status: WorkOrderStatus,
): WorkOrderActionAvailability {
  return {
    canUpdateStatus: calculateAllowedNextStatuses(status).length > 0,
    canAddNote: status !== "CLOSED",
    canAddAttachment: status !== "CLOSED",
  };
}

export function toWorkOrderListItemDto(
  workOrder: WorkOrderListItem,
): WorkOrderListItemDto {
  return {
    ...workOrder,
    allowedNextStatuses: calculateAllowedNextStatuses(workOrder.status),
    allowedActions: calculateAllowedActions(workOrder.status),
  };
}

export function toWorkOrderDetailDto(workOrder: WorkOrderDetail): WorkOrderDetailDto {
  return {
    ...workOrder,
    allowedNextStatuses: calculateAllowedNextStatuses(workOrder.status),
    allowedActions: calculateAllowedActions(workOrder.status),
  };
}

export async function requireWorkOrder(
  repository: Pick<WorkOrderServiceDependencies, "workOrders">["workOrders"],
  workOrderId: EntityId,
): Promise<ServiceResult<WorkOrder>> {
  const workOrder = await repository.getById(workOrderId);
  if (!workOrder) {
    return serviceFail(notFoundError("Work order could not be found."));
  }

  return serviceOk(workOrder);
}

export function enforceWorkOrderStatusTransition(
  currentStatus: WorkOrderStatus,
  nextStatus: WorkOrderStatus,
): ServiceResult<void> {
  if (currentStatus === nextStatus) {
    return serviceOk(undefined);
  }

  if (!isWorkOrderStatusTransitionAllowed(currentStatus, nextStatus)) {
    return serviceFail(
      conflictError(
        `Cannot transition work order from ${currentStatus} to ${nextStatus}.`,
      ),
    );
  }

  return serviceOk(undefined);
}

export function resolveClosedAt(
  previousStatus: WorkOrderStatus,
  nextStatus: WorkOrderStatus,
  now: IsoDateTimeString,
): IsoDateTimeString | null | undefined {
  if (nextStatus === "CLOSED" && previousStatus !== "CLOSED") {
    return now;
  }

  if (nextStatus !== "CLOSED") {
    return null;
  }

  return undefined;
}

export async function buildWorkOrderDetailAggregate(
  dependencies: Pick<WorkOrderServiceDependencies, "notes" | "attachments">,
  workOrder: WorkOrder,
): Promise<WorkOrderDetailDto> {
  const [notes, attachments] = await Promise.all([
    dependencies.notes.listNotesByWorkOrderId(workOrder.id),
    dependencies.attachments.listAttachmentsByWorkOrderId(workOrder.id),
  ]);

  return toWorkOrderDetailDto({
    ...workOrder,
    notes,
    attachments,
  });
}

function parseSchema<TValue>(
  schema: ZodType<TValue>,
  payload: unknown,
): ServiceResult<TValue> {
  const result = schema.safeParse(payload);
  if (result.success) {
    return serviceOk(result.data);
  }

  return serviceFail(validationError(z.prettifyError(result.error)));
}

function normalizeRequiredIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AppError({
      code: ERROR_CODES.ValidationFailed,
      message: `${field} is required.`,
      safeMessage: `${field} is required.`,
    });
  }

  return normalized;
}
