import "server-only";

import type { DocumentData, Firestore, Query } from "firebase-admin/firestore";

import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  CreateWorkOrderDto,
  WorkOrder,
  WorkOrderListItem,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/modules/work-orders";
import { getFirebaseAdminFirestore } from "@/server/firebase";

import {
  applyWorkOrderSearch,
  buildWorkOrderCreateModel,
  getWorkOrdersCollection,
  parseWorkOrderDocument,
  serializeWorkOrderForFirestore,
  toFirestoreTimestamp,
} from "./work-order.firestore";

export interface CreateWorkOrderRepositoryInput {
  id?: EntityId;
  workOrderNumber?: string;
  status?: WorkOrderStatus;
  searchText?: string;
  closedAt?: IsoDateTimeString | null;
  data: CreateWorkOrderDto;
  now?: IsoDateTimeString;
}

export interface UpdateWorkOrderRepositoryInput {
  workOrderId: EntityId;
  data: Partial<
    Pick<
      WorkOrder,
      | "title"
      | "description"
      | "clientOrganizationId"
      | "locationId"
      | "requestedByContactId"
      | "siteContactId"
      | "assignedContractorId"
      | "priority"
      | "category"
      | "requestedServiceDate"
      | "requiresQuote"
      | "quoteRequiredThresholdCents"
      | "requestedByName"
      | "requestedByEmail"
      | "requestedByPhone"
      | "source"
      | "coordinatorUserId"
      | "managerUserId"
      | "dueDate"
      | "closedAt"
      | "isArchived"
    >
  >;
  now?: IsoDateTimeString;
}

export interface UpdateWorkOrderStatusRepositoryInput {
  workOrderId: EntityId;
  status: WorkOrderStatus;
  closedAt?: IsoDateTimeString | null;
  now?: IsoDateTimeString;
}

export interface WorkOrderRepositoryListFilters {
  search?: string;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  category?: WorkOrder["category"];
  source?: WorkOrder["source"];
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  coordinatorUserId?: EntityId;
  managerUserId?: EntityId;
  requestedByEmail?: string;
  dueDateFrom?: IsoDateTimeString;
  dueDateTo?: IsoDateTimeString;
  isArchived?: boolean;
  limit?: number;
}

export interface WorkOrderRepository {
  create(input: CreateWorkOrderRepositoryInput): Promise<WorkOrder>;
  getById(id: EntityId): Promise<WorkOrder | null>;
  update(input: UpdateWorkOrderRepositoryInput): Promise<WorkOrder | null>;
  updateStatus(
    input: UpdateWorkOrderStatusRepositoryInput,
  ): Promise<WorkOrder | null>;
  list(filters?: WorkOrderRepositoryListFilters): Promise<WorkOrderListItem[]>;
  assertLocationBelongsToClient(
    clientOrganizationId: EntityId,
    locationId: EntityId,
  ): Promise<boolean>;
}

export function createWorkOrderRepository(
  firestore: Firestore = getFirebaseAdminFirestore(),
): WorkOrderRepository {
  return new FirestoreWorkOrderRepository(firestore);
}

class FirestoreWorkOrderRepository implements WorkOrderRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateWorkOrderRepositoryInput): Promise<WorkOrder> {
    const collection = getWorkOrdersCollection(this.firestore);
    const id = input.id?.trim() || collection.doc().id;
    const now = input.now ?? new Date().toISOString();
    const workOrder = buildWorkOrderCreateModel({
      id,
      data: input.data,
      now,
      workOrderNumber: input.workOrderNumber,
      status: input.status,
      searchText: input.searchText,
      closedAt: input.closedAt,
    });

    await collection
      .doc(workOrder.id)
      .create(serializeWorkOrderForFirestore(workOrder) as DocumentData);

    return workOrder;
  }

  async getById(id: EntityId): Promise<WorkOrder | null> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return null;
    }

    const snapshot = await getWorkOrdersCollection(this.firestore)
      .doc(normalizedId)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return parseWorkOrderDocument(snapshot.id, snapshot.data());
  }

  async update(
    input: UpdateWorkOrderRepositoryInput,
  ): Promise<WorkOrder | null> {
    const existing = await this.getById(input.workOrderId);
    if (!existing) {
      return null;
    }

    const updatedAt = input.now ?? new Date().toISOString();
    const nextWorkOrder: WorkOrder = {
      ...existing,
      title: input.data.title?.trim() ?? existing.title,
      description: input.data.description?.trim() ?? existing.description,
      clientOrganizationId:
        input.data.clientOrganizationId?.trim() ?? existing.clientOrganizationId,
      locationId: input.data.locationId?.trim() ?? existing.locationId,
      requestedByContactId:
        input.data.requestedByContactId === undefined
          ? existing.requestedByContactId
          : input.data.requestedByContactId?.trim() || null,
      siteContactId:
        input.data.siteContactId === undefined
          ? existing.siteContactId
          : input.data.siteContactId?.trim() || null,
      assignedContractorId:
        input.data.assignedContractorId === undefined
          ? existing.assignedContractorId
          : input.data.assignedContractorId?.trim() || null,
      priority: input.data.priority ?? existing.priority,
      category: input.data.category ?? existing.category,
      requestedServiceDate:
        input.data.requestedServiceDate === undefined
          ? existing.requestedServiceDate
          : input.data.requestedServiceDate,
      requiresQuote:
        input.data.requiresQuote === undefined
          ? existing.requiresQuote
          : input.data.requiresQuote,
      quoteRequiredThresholdCents:
        input.data.quoteRequiredThresholdCents === undefined
          ? existing.quoteRequiredThresholdCents
          : input.data.quoteRequiredThresholdCents,
      requestedByName:
        input.data.requestedByName?.trim() ?? existing.requestedByName,
      requestedByEmail:
        input.data.requestedByEmail === undefined
          ? existing.requestedByEmail
          : input.data.requestedByEmail?.trim() || null,
      requestedByPhone:
        input.data.requestedByPhone === undefined
          ? existing.requestedByPhone
          : input.data.requestedByPhone?.trim() || null,
      source: input.data.source ?? existing.source,
      coordinatorUserId:
        input.data.coordinatorUserId === undefined
          ? existing.coordinatorUserId
          : input.data.coordinatorUserId?.trim() || null,
      managerUserId:
        input.data.managerUserId === undefined
          ? existing.managerUserId
          : input.data.managerUserId?.trim() || null,
      dueDate:
        input.data.dueDate === undefined ? existing.dueDate : input.data.dueDate,
      closedAt:
        input.data.closedAt === undefined
          ? existing.closedAt
          : input.data.closedAt,
      isArchived:
        input.data.isArchived === undefined
          ? existing.isArchived
          : input.data.isArchived,
      updatedAt,
      searchText: buildSearchTextForWorkOrder({
        ...existing,
        ...input.data,
        title: input.data.title?.trim() ?? existing.title,
        description: input.data.description?.trim() ?? existing.description,
        clientOrganizationId:
          input.data.clientOrganizationId?.trim() ?? existing.clientOrganizationId,
        locationId: input.data.locationId?.trim() ?? existing.locationId,
        requestedServiceDate:
          input.data.requestedServiceDate === undefined
            ? existing.requestedServiceDate
            : input.data.requestedServiceDate,
        requestedByName:
          input.data.requestedByName?.trim() ?? existing.requestedByName,
        requestedByEmail:
          input.data.requestedByEmail === undefined
            ? existing.requestedByEmail
            : input.data.requestedByEmail?.trim() || null,
        requestedByPhone:
          input.data.requestedByPhone === undefined
            ? existing.requestedByPhone
            : input.data.requestedByPhone?.trim() || null,
      }),
    };

    await getWorkOrdersCollection(this.firestore)
      .doc(nextWorkOrder.id)
      .set(serializeWorkOrderForFirestore(nextWorkOrder) as DocumentData, {
        merge: true,
      });

    return nextWorkOrder;
  }

  async updateStatus(
    input: UpdateWorkOrderStatusRepositoryInput,
  ): Promise<WorkOrder | null> {
    const existing = await this.getById(input.workOrderId);
    if (!existing) {
      return null;
    }

    const nextWorkOrder: WorkOrder = {
      ...existing,
      status: input.status,
      closedAt:
        input.closedAt === undefined ? existing.closedAt : input.closedAt,
      updatedAt: input.now ?? new Date().toISOString(),
    };

    await getWorkOrdersCollection(this.firestore)
      .doc(nextWorkOrder.id)
      .set(serializeWorkOrderForFirestore(nextWorkOrder) as DocumentData, {
        merge: true,
      });

    return nextWorkOrder;
  }

  async list(
    filters: WorkOrderRepositoryListFilters = {},
  ): Promise<WorkOrderListItem[]> {
    let query: Query<DocumentData> = getWorkOrdersCollection(this.firestore).orderBy(
      "createdAt",
      "desc",
    );

    if (filters.status) {
      query = query.where("status", "==", filters.status);
    }

    if (filters.priority) {
      query = query.where("priority", "==", filters.priority);
    }

    if (filters.category) {
      query = query.where("category", "==", filters.category);
    }

    if (filters.source) {
      query = query.where("source", "==", filters.source);
    }

    if (filters.clientOrganizationId) {
      query = query.where(
        "clientOrganizationId",
        "==",
        filters.clientOrganizationId.trim(),
      );
    }

    if (filters.locationId) {
      query = query.where("locationId", "==", filters.locationId.trim());
    }

    if (filters.coordinatorUserId) {
      query = query.where(
        "coordinatorUserId",
        "==",
        filters.coordinatorUserId.trim(),
      );
    }

    if (filters.managerUserId) {
      query = query.where(
        "managerUserId",
        "==",
        filters.managerUserId.trim(),
      );
    }

    if (filters.requestedByEmail) {
      query = query.where("requestedByEmail", "==", filters.requestedByEmail.trim());
    }

    if (filters.isArchived !== undefined) {
      query = query.where("isArchived", "==", filters.isArchived);
    }

    if (filters.dueDateFrom) {
      query = query.where("dueDate", ">=", toFirestoreTimestamp(filters.dueDateFrom));
    }

    if (filters.dueDateTo) {
      query = query.where("dueDate", "<=", toFirestoreTimestamp(filters.dueDateTo));
    }

    if (canApplyQueryLimit(filters)) {
      query = query.limit(filters.limit!);
    }

    const snapshot = await query.get();
    const workOrders = snapshot.docs.map((document) =>
      parseWorkOrderDocument(document.id, document.data()),
    );

    const filtered = applyRepositoryFilters(workOrders, filters);

    return (filters.limit ? filtered.slice(0, filters.limit) : filtered).map(
      toListItem,
    );
  }

  async assertLocationBelongsToClient(
    clientOrganizationId: EntityId,
    locationId: EntityId,
  ): Promise<boolean> {
    const normalizedLocationId = locationId.trim();
    const normalizedClientOrganizationId = clientOrganizationId.trim();

    if (!normalizedLocationId || !normalizedClientOrganizationId) {
      return false;
    }

    const snapshot = await this.firestore
      .collection("locations")
      .doc(normalizedLocationId)
      .get();

    if (!snapshot.exists) {
      return false;
    }

    const location = snapshot.data();
    if (!location) {
      return false;
    }

    return (
      location.clientOrganizationId === normalizedClientOrganizationId &&
      location.isDeleted !== true
    );
  }
}

function canApplyQueryLimit(filters: WorkOrderRepositoryListFilters): boolean {
  return Boolean(
    filters.limit &&
      !filters.search,
  );
}

function applyRepositoryFilters(
  workOrders: WorkOrder[],
  filters: WorkOrderRepositoryListFilters,
): WorkOrder[] {
  const normalizedRequestedByEmail = filters.requestedByEmail?.trim().toLowerCase();

  return applyWorkOrderSearch(workOrders, filters.search)
    .filter((workOrder) =>
      filters.status ? workOrder.status === filters.status : true,
    )
    .filter((workOrder) =>
      filters.priority ? workOrder.priority === filters.priority : true,
    )
    .filter((workOrder) =>
      filters.category ? workOrder.category === filters.category : true,
    )
    .filter((workOrder) =>
      filters.source ? workOrder.source === filters.source : true,
    )
    .filter((workOrder) =>
      filters.clientOrganizationId
        ? workOrder.clientOrganizationId === filters.clientOrganizationId.trim()
        : true,
    )
    .filter((workOrder) =>
      filters.locationId ? workOrder.locationId === filters.locationId.trim() : true,
    )
    .filter((workOrder) =>
      filters.coordinatorUserId
        ? workOrder.coordinatorUserId ===
          filters.coordinatorUserId.trim()
        : true,
    )
    .filter((workOrder) =>
      filters.managerUserId
        ? workOrder.managerUserId === filters.managerUserId.trim()
        : true,
    )
    .filter((workOrder) =>
      normalizedRequestedByEmail
        ? workOrder.requestedByEmail?.toLowerCase() === normalizedRequestedByEmail
        : true,
    )
    .filter((workOrder) =>
      filters.isArchived === undefined
        ? true
        : workOrder.isArchived === filters.isArchived
    )
    .filter((workOrder) =>
      filters.dueDateFrom
        ? Boolean(
            workOrder.dueDate &&
              Date.parse(workOrder.dueDate) >= Date.parse(filters.dueDateFrom),
          )
        : true,
    )
    .filter((workOrder) =>
      filters.dueDateTo
        ? Boolean(
            workOrder.dueDate &&
              Date.parse(workOrder.dueDate) <= Date.parse(filters.dueDateTo),
          )
        : true,
    );
}

function toListItem(workOrder: WorkOrder): WorkOrderListItem {
  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    clientOrganizationId: workOrder.clientOrganizationId,
    locationId: workOrder.locationId,
    assignedContractorId: workOrder.assignedContractorId,
    status: workOrder.status,
    priority: workOrder.priority,
    category: workOrder.category,
    requestedServiceDate: workOrder.requestedServiceDate,
    requiresQuote: workOrder.requiresQuote,
    quoteRequiredThresholdCents: workOrder.quoteRequiredThresholdCents,
    source: workOrder.source,
    requestedByName: workOrder.requestedByName,
    coordinatorUserId: workOrder.coordinatorUserId,
    managerUserId: workOrder.managerUserId,
    dueDate: workOrder.dueDate,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
    closedAt: workOrder.closedAt,
    isArchived: workOrder.isArchived,
  };
}

function buildSearchTextForWorkOrder(workOrder: {
  workOrderNumber: string;
  title: string;
  description: string;
  requestedServiceDate?: IsoDateTimeString | null;
  requestedByName: string;
  requestedByEmail: string | null;
  requestedByPhone: string | null;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}): string {
  return [
    workOrder.workOrderNumber,
    workOrder.title,
    workOrder.description,
    workOrder.requestedServiceDate,
    workOrder.requestedByName,
    workOrder.requestedByEmail,
    workOrder.requestedByPhone,
    workOrder.clientOrganizationId,
    workOrder.locationId,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
