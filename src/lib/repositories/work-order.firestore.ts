import "server-only";

import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";

import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  CreateWorkOrderAttachmentMetadataDto,
  CreateWorkOrderDto,
  CreateWorkOrderNoteDto,
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderCategory,
  WorkOrderNote,
  WorkOrderPriority,
  WorkOrderSource,
  WorkOrderStatus,
} from "@/modules/work-orders";
import {
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_SOURCES,
  WORK_ORDER_STATUSES,
} from "@/modules/work-orders";

export const WORK_ORDER_COLLECTIONS = {
  workOrders: "workOrders",
  notes: "notes",
  attachments: "attachments",
} as const;

interface WorkOrderDocument {
  workOrderNumber: string;
  title: string;
  description: string;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  requestedByName: string;
  requestedByEmail: string | null;
  requestedByPhone: string | null;
  source: WorkOrderSource;
  createdByUserId: EntityId;
  assignedCoordinatorUserId: EntityId | null;
  assignedManagerUserId: EntityId | null;
  dueDate: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt: Timestamp | null;
  isArchived: boolean;
  searchText: string;
}

interface WorkOrderNoteDocument {
  workOrderId: EntityId;
  body: string;
  createdByUserId: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface WorkOrderAttachmentDocument {
  workOrderId: EntityId;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: EntityId;
  createdAt: Timestamp;
}

type FirestoreTimestampLike = Timestamp | { toDate(): Date };

export function getWorkOrdersCollection(firestore: Firestore) {
  return firestore.collection(WORK_ORDER_COLLECTIONS.workOrders);
}

export function getWorkOrderNotesCollection(
  firestore: Firestore,
  workOrderId: EntityId,
) {
  return getWorkOrdersCollection(firestore)
    .doc(normalizeEntityId(workOrderId, "workOrderId"))
    .collection(WORK_ORDER_COLLECTIONS.notes);
}

export function getWorkOrderAttachmentsCollection(
  firestore: Firestore,
  workOrderId: EntityId,
) {
  return getWorkOrdersCollection(firestore)
    .doc(normalizeEntityId(workOrderId, "workOrderId"))
    .collection(WORK_ORDER_COLLECTIONS.attachments);
}

export function buildWorkOrderSearchText(input: {
  workOrderNumber: string;
  title: string;
  description: string;
  requestedByName: string;
  requestedByEmail: string | null;
  requestedByPhone: string | null;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}): string {
  return normalizeSearchText(
    [
      input.workOrderNumber,
      input.title,
      input.description,
      input.requestedByName,
      input.requestedByEmail,
      input.requestedByPhone,
      input.clientOrganizationId,
      input.locationId,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" "),
  );
}

export function buildWorkOrderNumber(id: EntityId): string {
  const normalizedId = normalizeEntityId(id, "id");
  return `WO-${normalizedId.slice(0, 8).toUpperCase()}`;
}

export function serializeWorkOrderForFirestore(
  workOrder: WorkOrder,
): WorkOrderDocument {
  return {
    workOrderNumber: normalizeRequiredString(
      workOrder.workOrderNumber,
      "workOrderNumber",
    ),
    title: normalizeRequiredString(workOrder.title, "title"),
    description: normalizeRequiredString(workOrder.description, "description"),
    clientOrganizationId: normalizeEntityId(
      workOrder.clientOrganizationId,
      "clientOrganizationId",
    ),
    locationId: normalizeEntityId(workOrder.locationId, "locationId"),
    status: parseEnumValue(
      workOrder.status,
      WORK_ORDER_STATUSES,
      "status",
    ),
    priority: parseEnumValue(
      workOrder.priority,
      WORK_ORDER_PRIORITIES,
      "priority",
    ),
    category: parseEnumValue(
      workOrder.category,
      WORK_ORDER_CATEGORIES,
      "category",
    ),
    requestedByName: normalizeRequiredString(
      workOrder.requestedByName,
      "requestedByName",
    ),
    requestedByEmail: normalizeNullableString(workOrder.requestedByEmail),
    requestedByPhone: normalizeNullableString(workOrder.requestedByPhone),
    source: parseEnumValue(workOrder.source, WORK_ORDER_SOURCES, "source"),
    createdByUserId: normalizeEntityId(
      workOrder.createdByUserId,
      "createdByUserId",
    ),
    assignedCoordinatorUserId: normalizeNullableEntityId(
      workOrder.assignedCoordinatorUserId,
      "assignedCoordinatorUserId",
    ),
    assignedManagerUserId: normalizeNullableEntityId(
      workOrder.assignedManagerUserId,
      "assignedManagerUserId",
    ),
    dueDate: toNullableFirestoreTimestamp(workOrder.dueDate),
    createdAt: toFirestoreTimestamp(workOrder.createdAt),
    updatedAt: toFirestoreTimestamp(workOrder.updatedAt),
    closedAt: toNullableFirestoreTimestamp(workOrder.closedAt),
    isArchived: workOrder.isArchived,
    searchText: normalizeSearchText(workOrder.searchText),
  };
}

export function parseWorkOrderDocument(
  id: EntityId,
  raw: DocumentData | undefined,
): WorkOrder {
  if (!raw) {
    throw new Error(`Work order document "${id}" is missing data.`);
  }

  const createdAt = parseRequiredTimestamp(raw.createdAt, "createdAt");
  const updatedAt =
    parseNullableTimestamp(raw.updatedAt, "updatedAt") ?? createdAt;
  const requestedByEmail = parseNullableString(
    raw.requestedByEmail,
    "requestedByEmail",
  );
  const requestedByPhone = parseNullableString(
    raw.requestedByPhone,
    "requestedByPhone",
  );
  const workOrderNumber =
    parseOptionalString(raw.workOrderNumber, "workOrderNumber") ??
    buildWorkOrderNumber(id);
  const title = parseRequiredString(raw.title, "title");
  const description = parseRequiredString(raw.description, "description");
  const requestedByName = parseRequiredString(
    raw.requestedByName,
    "requestedByName",
  );
  const clientOrganizationId = parseEntityId(
    raw.clientOrganizationId,
    "clientOrganizationId",
  );
  const locationId = parseEntityId(raw.locationId, "locationId");
  const searchText = normalizeSearchText(
    parseOptionalString(raw.searchText, "searchText") ??
      buildWorkOrderSearchText({
        workOrderNumber,
        title,
        description,
        requestedByName,
        requestedByEmail,
        requestedByPhone,
        clientOrganizationId,
        locationId,
      }),
  );

  return {
    id,
    workOrderNumber,
    title,
    description,
    clientOrganizationId,
    locationId,
    status: parseEnumValue(raw.status, WORK_ORDER_STATUSES, "status"),
    priority: parseEnumValue(raw.priority, WORK_ORDER_PRIORITIES, "priority"),
    category: parseEnumValue(raw.category, WORK_ORDER_CATEGORIES, "category"),
    requestedByName,
    requestedByEmail,
    requestedByPhone,
    source: parseEnumValue(raw.source, WORK_ORDER_SOURCES, "source"),
    createdByUserId: parseEntityId(raw.createdByUserId, "createdByUserId"),
    assignedCoordinatorUserId: parseNullableEntityId(
      raw.assignedCoordinatorUserId,
      "assignedCoordinatorUserId",
    ),
    assignedManagerUserId: parseNullableEntityId(
      raw.assignedManagerUserId,
      "assignedManagerUserId",
    ),
    dueDate: parseNullableTimestamp(raw.dueDate, "dueDate"),
    createdAt,
    updatedAt,
    closedAt: parseNullableTimestamp(raw.closedAt, "closedAt"),
    isArchived:
      raw.isArchived === undefined || raw.isArchived === null
        ? false
        : parseBoolean(raw.isArchived, "isArchived"),
    searchText,
  };
}

export function serializeWorkOrderNoteForFirestore(
  note: WorkOrderNote,
): WorkOrderNoteDocument {
  return {
    workOrderId: normalizeEntityId(note.workOrderId, "workOrderId"),
    body: normalizeRequiredString(note.body, "body"),
    createdByUserId: normalizeEntityId(note.createdByUserId, "createdByUserId"),
    createdAt: toFirestoreTimestamp(note.createdAt),
    updatedAt: toFirestoreTimestamp(note.updatedAt),
  };
}

export function parseWorkOrderNoteDocument(
  id: EntityId,
  workOrderId: EntityId,
  raw: DocumentData | undefined,
): WorkOrderNote {
  if (!raw) {
    throw new Error(`Work order note "${id}" is missing data.`);
  }

  const createdAt = parseRequiredTimestamp(raw.createdAt, "createdAt");

  return {
    id,
    workOrderId: parseEntityId(raw.workOrderId ?? workOrderId, "workOrderId"),
    body: parseRequiredString(raw.body, "body"),
    createdByUserId: parseEntityId(raw.createdByUserId, "createdByUserId"),
    createdAt,
    updatedAt: parseNullableTimestamp(raw.updatedAt, "updatedAt") ?? createdAt,
  };
}

export function serializeWorkOrderAttachmentForFirestore(
  attachment: WorkOrderAttachment,
): WorkOrderAttachmentDocument {
  return {
    workOrderId: normalizeEntityId(attachment.workOrderId, "workOrderId"),
    fileName: normalizeRequiredString(attachment.fileName, "fileName"),
    contentType: normalizeRequiredString(attachment.contentType, "contentType"),
    sizeBytes: normalizePositiveInteger(attachment.sizeBytes, "sizeBytes"),
    storagePath: normalizeRequiredString(attachment.storagePath, "storagePath"),
    uploadedBy: normalizeEntityId(attachment.uploadedBy, "uploadedBy"),
    createdAt: toFirestoreTimestamp(attachment.createdAt),
  };
}

export function parseWorkOrderAttachmentDocument(
  id: EntityId,
  workOrderId: EntityId,
  raw: DocumentData | undefined,
): WorkOrderAttachment {
  if (!raw) {
    throw new Error(`Work order attachment "${id}" is missing data.`);
  }

  return {
    id,
    workOrderId: parseEntityId(raw.workOrderId ?? workOrderId, "workOrderId"),
    fileName: parseRequiredString(raw.fileName, "fileName"),
    contentType: parseRequiredString(raw.contentType, "contentType"),
    sizeBytes: parsePositiveInteger(raw.sizeBytes ?? raw.fileSizeBytes, "sizeBytes"),
    storagePath: parseRequiredString(raw.storagePath, "storagePath"),
    uploadedBy: parseEntityId(raw.uploadedBy ?? raw.uploadedByUserId, "uploadedBy"),
    createdAt: parseRequiredTimestamp(raw.createdAt, "createdAt"),
  };
}

export function buildWorkOrderCreateModel(input: {
  id: EntityId;
  data: CreateWorkOrderDto;
  now: IsoDateTimeString;
  workOrderNumber?: string;
  status?: WorkOrderStatus;
  searchText?: string;
  closedAt?: IsoDateTimeString | null;
}): WorkOrder {
  const workOrderNumber = input.workOrderNumber?.trim() || buildWorkOrderNumber(input.id);
  const status = input.status ?? "NEW";

  return {
    id: input.id,
    workOrderNumber,
    title: input.data.title.trim(),
    description: input.data.description.trim(),
    clientOrganizationId: input.data.clientOrganizationId.trim(),
    locationId: input.data.locationId.trim(),
    status,
    priority: input.data.priority,
    category: input.data.category,
    requestedByName: input.data.requestedByName.trim(),
    requestedByEmail: normalizeNullableString(input.data.requestedByEmail),
    requestedByPhone: normalizeNullableString(input.data.requestedByPhone),
    source: input.data.source,
    createdByUserId: input.data.createdByUserId.trim(),
    assignedCoordinatorUserId: normalizeNullableEntityId(
      input.data.assignedCoordinatorUserId,
      "assignedCoordinatorUserId",
    ),
    assignedManagerUserId: normalizeNullableEntityId(
      input.data.assignedManagerUserId,
      "assignedManagerUserId",
    ),
    dueDate: input.data.dueDate ?? null,
    createdAt: input.now,
    updatedAt: input.now,
    closedAt: status === "CLOSED" ? (input.closedAt ?? input.now) : null,
    isArchived: false,
    searchText:
      input.searchText?.trim() ||
      buildWorkOrderSearchText({
        workOrderNumber,
        title: input.data.title,
        description: input.data.description,
        requestedByName: input.data.requestedByName,
        requestedByEmail: input.data.requestedByEmail ?? null,
        requestedByPhone: input.data.requestedByPhone ?? null,
        clientOrganizationId: input.data.clientOrganizationId,
        locationId: input.data.locationId,
      }),
  };
}

export function buildWorkOrderNoteCreateModel(input: {
  id: EntityId;
  workOrderId: EntityId;
  data: CreateWorkOrderNoteDto;
  now: IsoDateTimeString;
}): WorkOrderNote {
  return {
    id: input.id,
    workOrderId: normalizeEntityId(input.workOrderId, "workOrderId"),
    body: input.data.body.trim(),
    createdByUserId: input.data.createdByUserId.trim(),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function buildWorkOrderAttachmentCreateModel(input: {
  id: EntityId;
  workOrderId: EntityId;
  data: CreateWorkOrderAttachmentMetadataDto;
  now: IsoDateTimeString;
}): WorkOrderAttachment {
  return {
    id: input.id,
    workOrderId: normalizeEntityId(input.workOrderId, "workOrderId"),
    fileName: input.data.fileName.trim(),
    contentType: input.data.contentType.trim(),
    sizeBytes: input.data.sizeBytes,
    storagePath: input.data.storagePath.trim(),
    uploadedBy: input.data.uploadedBy.trim(),
    createdAt: input.now,
  };
}

export function applyWorkOrderSearch(
  workOrders: WorkOrder[],
  search: string | undefined,
): WorkOrder[] {
  const normalizedSearch = normalizeSearchText(search ?? "");
  if (!normalizedSearch) {
    return workOrders;
  }

  return workOrders.filter((workOrder) =>
    normalizeSearchText(workOrder.searchText).includes(normalizedSearch),
  );
}

export async function workOrderExists(
  firestore: Firestore,
  workOrderId: EntityId,
): Promise<boolean> {
  const snapshot = await getWorkOrdersCollection(firestore)
    .doc(normalizeEntityId(workOrderId, "workOrderId"))
    .get();

  return snapshot.exists;
}

export function toFirestoreTimestamp(value: IsoDateTimeString): Timestamp {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO datetime value "${value}".`);
  }

  return Timestamp.fromDate(date);
}

function toNullableFirestoreTimestamp(
  value: IsoDateTimeString | null,
): Timestamp | null {
  return value ? toFirestoreTimestamp(value) : null;
}

function parseRequiredTimestamp(
  value: unknown,
  fieldName: string,
): IsoDateTimeString {
  if (!value) {
    throw new Error(`Missing required timestamp field "${fieldName}".`);
  }

  return toIsoDateTimeString(value, fieldName);
}

function parseNullableTimestamp(
  value: unknown,
  fieldName: string,
): IsoDateTimeString | null {
  if (value === undefined || value === null) {
    return null;
  }

  return toIsoDateTimeString(value, fieldName);
}

function toIsoDateTimeString(
  value: unknown,
  fieldName: string,
): IsoDateTimeString {
  if (typeof value === "string") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Field "${fieldName}" must contain a valid datetime string.`);
    }

    return date.toISOString();
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Field "${fieldName}" must contain a valid Date.`);
    }

    return value.toISOString();
  }

  if (isFirestoreTimestampLike(value)) {
    return value.toDate().toISOString();
  }

  throw new Error(`Field "${fieldName}" must contain a Firestore timestamp.`);
}

function isFirestoreTimestampLike(value: unknown): value is FirestoreTimestampLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  );
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Field "${fieldName}" must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Field "${fieldName}" must not be empty.`);
  }

  return normalized;
}

function normalizeRequiredString(value: string, fieldName: string): string {
  return parseRequiredString(value, fieldName);
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return parseRequiredString(value, fieldName);
}

function parseNullableString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return parseRequiredString(value, fieldName);
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return value.trim() ? value.trim() : null;
}

function parseEntityId(value: unknown, fieldName: string): EntityId {
  return normalizeEntityId(parseRequiredString(value, fieldName), fieldName);
}

function normalizeEntityId(value: string, fieldName: string): EntityId {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Field "${fieldName}" must contain a non-empty id.`);
  }

  return normalized;
}

function parseNullableEntityId(
  value: unknown,
  fieldName: string,
): EntityId | null {
  if (value === undefined || value === null) {
    return null;
  }

  return parseEntityId(value, fieldName);
}

function normalizeNullableEntityId(
  value: string | null | undefined,
  fieldName: string,
): EntityId | null {
  if (value === undefined || value === null) {
    return null;
  }

  return normalizeEntityId(value, fieldName);
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Field "${fieldName}" must be a boolean.`);
  }

  return value;
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`Field "${fieldName}" must be a positive integer.`);
  }

  return Number(value);
}

function normalizePositiveInteger(value: number, fieldName: string): number {
  return parsePositiveInteger(value, fieldName);
}

function parseEnumValue<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[],
  fieldName: string,
): TValue {
  if (typeof value !== "string" || !allowedValues.includes(value as TValue)) {
    throw new Error(
      `Field "${fieldName}" must be one of: ${allowedValues.join(", ")}.`,
    );
  }

  return value as TValue;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
