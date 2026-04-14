import assert from "node:assert/strict";
import test from "node:test";

import {
  createAddWorkOrderAttachmentService,
  createAddWorkOrderNoteService,
  createCreateWorkOrderService,
  createGetWorkOrderDetailService,
  createListWorkOrdersService,
  createUpdateWorkOrderStatusService,
  generateWorkOrderNumber,
  normalizeWorkOrderSearchText,
  type WorkOrderServiceDependencies,
} from "../lib/services/work-orders/index.ts";
import type {
  CreateWorkOrderAttachmentMetadataDto,
  CreateWorkOrderDto,
  CreateWorkOrderNoteDto,
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderNote,
} from "../modules/work-orders/index.ts";
import type { ClientOrganization } from "../types/client-organization.ts";
import type { EntityId } from "../types/entity.ts";
import type { Location } from "../types/location.ts";
import type {
  ClientOrganizationRepository,
  ClientOrganizationSelector,
} from "../lib/repositories/client-organization.repository.ts";
import type {
  LocationRepository,
} from "../lib/repositories/location.repository.ts";
import type {
  CreateWorkOrderAttachmentRepositoryInput,
  WorkOrderAttachmentRepository,
} from "../lib/repositories/work-order-attachment.repository.ts";
import type {
  CreateWorkOrderNoteRepositoryInput,
  WorkOrderNoteRepository,
} from "../lib/repositories/work-order-note.repository.ts";
import type {
  CreateWorkOrderRepositoryInput,
  UpdateWorkOrderStatusRepositoryInput,
  WorkOrderRepository,
  WorkOrderRepositoryListFilters,
} from "../lib/repositories/work-order.repository.ts";

test("createWorkOrder validates relationships, generates identifiers, and returns detail", async () => {
  const harness = createHarness();
  const service = createCreateWorkOrderService(harness.dependencies);

  const result = await service.createWorkOrder({
    workOrderId: "wo-created-1234",
    now: "2026-04-14T15:30:00.000Z",
    payload: makeCreatePayload(),
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.id, "wo-created-1234");
  assert.equal(result.value.workOrderNumber, "WO-WO-CREAT");
  assert.equal(result.value.status, "NEW");
  assert.deepEqual(result.value.allowedNextStatuses, ["OPEN", "CANCELLED"]);
  assert.deepEqual(result.value.notes, []);
  assert.deepEqual(result.value.attachments, []);

  const persisted = harness.workOrdersStore.get("wo-created-1234");
  assert.ok(persisted);
  assert.equal(persisted?.searchText.includes("replace failed rooftop capacitor"), true);
});

test("createWorkOrder rejects locations that do not belong to the selected client", async () => {
  const harness = createHarness({
    location: makeLocation({ clientOrganizationId: "client-2" }),
  });
  const service = createCreateWorkOrderService(harness.dependencies);

  const result = await service.createWorkOrder({
    payload: makeCreatePayload(),
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /does not belong to the specified client organization/i);
});

test("listWorkOrders validates query filters and returns list-ready DTOs", async () => {
  const harness = createHarness({
    workOrders: [
      makeWorkOrder({ id: "wo-1", status: "OPEN", priority: "HIGH" }),
      makeWorkOrder({ id: "wo-2", status: "NEW", priority: "LOW" }),
    ],
  });
  const service = createListWorkOrdersService(harness.dependencies);

  const result = await service.listWorkOrders({
    query: {
      status: "OPEN",
      priority: "HIGH",
      limit: 10,
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.items.length, 1);
  assert.equal(result.value.items[0]?.id, "wo-1");
  assert.equal(result.value.items[0]?.allowedActions.canUpdateStatus, true);
});

test("getWorkOrderDetail returns notes and attachments as an aggregate", async () => {
  const harness = createHarness({
    workOrders: [makeWorkOrder({ id: "wo-1" })],
    notes: [
      makeNote({ id: "note-1", workOrderId: "wo-1" }),
      makeNote({ id: "note-2", workOrderId: "wo-1" }),
    ],
    attachments: [
      makeAttachment({ id: "att-1", workOrderId: "wo-1" }),
    ],
  });
  const service = createGetWorkOrderDetailService(harness.dependencies);

  const result = await service.getWorkOrderDetail({ workOrderId: "wo-1" });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.notes.length, 2);
  assert.equal(result.value.attachments.length, 1);
});

test("updateWorkOrderStatus enforces transitions and stamps closedAt", async () => {
  const harness = createHarness({
    workOrders: [makeWorkOrder({ id: "wo-1", status: "COMPLETED", closedAt: null })],
  });
  const service = createUpdateWorkOrderStatusService(harness.dependencies);

  const result = await service.updateWorkOrderStatus({
    workOrderId: "wo-1",
    now: "2026-04-14T18:45:00.000Z",
    payload: { status: "CLOSED" },
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.status, "CLOSED");
  assert.equal(result.value.closedAt, "2026-04-14T18:45:00.000Z");
  assert.equal(result.value.allowedActions.canAddAttachment, false);
});

test("updateWorkOrderStatus rejects invalid transitions", async () => {
  const harness = createHarness({
    workOrders: [makeWorkOrder({ id: "wo-1", status: "NEW" })],
  });
  const service = createUpdateWorkOrderStatusService(harness.dependencies);

  const result = await service.updateWorkOrderStatus({
    workOrderId: "wo-1",
    payload: { status: "COMPLETED" },
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /cannot transition work order from NEW to COMPLETED/i);
});

test("note and attachment services validate payloads and persist metadata", async () => {
  const harness = createHarness({
    workOrders: [makeWorkOrder({ id: "wo-1" })],
  });
  const noteService = createAddWorkOrderNoteService(harness.dependencies);
  const attachmentService = createAddWorkOrderAttachmentService(harness.dependencies);

  const noteResult = await noteService.addWorkOrderNote({
    workOrderId: "wo-1",
    now: "2026-04-14T19:00:00.000Z",
    payload: {
      body: "  Waiting on roof access authorization.  ",
      createdByUserId: "user-2",
    },
  });
  const attachmentResult = await attachmentService.addWorkOrderAttachment({
    workOrderId: "wo-1",
    now: "2026-04-14T19:00:00.000Z",
    payload: {
      fileName: " estimate.pdf ",
      contentType: "application/pdf",
      fileSizeBytes: 2048,
      storagePath: "work-orders/wo-1/estimate.pdf",
      uploadedByUserId: "user-2",
    },
  });

  assert.equal(noteResult.ok, true);
  assert.equal(attachmentResult.ok, true);
  if (!noteResult.ok || !attachmentResult.ok) {
    return;
  }

  assert.equal(noteResult.value.body, "Waiting on roof access authorization.");
  assert.equal(attachmentResult.value.fileName, "estimate.pdf");
  assert.equal(harness.notesStore.get("wo-1")?.length, 1);
  assert.equal(harness.attachmentsStore.get("wo-1")?.length, 1);
});

test("note and attachment services reject writes to closed work orders", async () => {
  const harness = createHarness({
    workOrders: [makeWorkOrder({ id: "wo-closed", status: "CLOSED" })],
  });
  const noteService = createAddWorkOrderNoteService(harness.dependencies);
  const attachmentService = createAddWorkOrderAttachmentService(harness.dependencies);

  const noteResult = await noteService.addWorkOrderNote({
    workOrderId: "wo-closed",
    payload: {
      body: "Closed work order note",
      createdByUserId: "user-2",
    },
  });
  const attachmentResult = await attachmentService.addWorkOrderAttachment({
    workOrderId: "wo-closed",
    payload: {
      fileName: "closed.pdf",
      contentType: "application/pdf",
      fileSizeBytes: 128,
      storagePath: "work-orders/wo-closed/closed.pdf",
      uploadedByUserId: "user-2",
    },
  });

  assert.equal(noteResult.ok, false);
  assert.equal(attachmentResult.ok, false);
  if (noteResult.ok || attachmentResult.ok) {
    return;
  }

  assert.match(noteResult.error.message, /cannot add notes to a closed work order/i);
  assert.match(
    attachmentResult.error.message,
    /cannot add attachments to a closed work order/i,
  );
});

test("helper utilities stay stable for number generation and search normalization", () => {
  assert.equal(generateWorkOrderNumber("wo-created-1234"), "WO-WO-CREAT");
  assert.equal(
    normalizeWorkOrderSearchText({
      workOrderNumber: "WO-1234",
      title: "  Roof Leak  ",
      description: "Investigate the leak near unit #4.",
      requestedByName: "Jordan Lee",
      requestedByEmail: "Jordan@example.com",
      requestedByPhone: "(555) 123-4567",
      clientOrganizationId: "client-1",
      locationId: "location-1",
    }),
    "wo-1234 roof leak investigate the leak near unit 4 jordan lee jordan example com 555 123-4567 client-1 location-1",
  );
});

function createHarness(input: {
  clientOrganization?: ClientOrganization;
  location?: Location;
  workOrders?: WorkOrder[];
  notes?: WorkOrderNote[];
  attachments?: WorkOrderAttachment[];
} = {}) {
  const clientOrganization =
    input.clientOrganization ?? makeClientOrganization();
  const location = input.location ?? makeLocation();
  const workOrdersStore = new Map<EntityId, WorkOrder>(
    (input.workOrders ?? []).map((workOrder) => [workOrder.id, workOrder]),
  );
  const notesStore = new Map<EntityId, WorkOrderNote[]>();
  const attachmentsStore = new Map<EntityId, WorkOrderAttachment[]>();

  for (const note of input.notes ?? []) {
    notesStore.set(note.workOrderId, [...(notesStore.get(note.workOrderId) ?? []), note]);
  }

  for (const attachment of input.attachments ?? []) {
    attachmentsStore.set(
      attachment.workOrderId,
      [...(attachmentsStore.get(attachment.workOrderId) ?? []), attachment],
    );
  }

  const dependencies: WorkOrderServiceDependencies = {
    workOrders: createInMemoryWorkOrderRepository(workOrdersStore),
    clientOrganizations: createInMemoryClientOrganizationRepository(
      clientOrganization,
    ),
    locations: createInMemoryLocationRepository(location),
    notes: createInMemoryNoteRepository(notesStore),
    attachments: createInMemoryAttachmentRepository(attachmentsStore),
  };

  return {
    dependencies,
    workOrdersStore,
    notesStore,
    attachmentsStore,
  };
}

function createInMemoryClientOrganizationRepository(
  clientOrganization: ClientOrganization,
): ClientOrganizationRepository {
  return {
    async getById(id) {
      return clientOrganization.id === id ? clientOrganization : null;
    },
    async list() {
      return [clientOrganization];
    },
    async exists(id) {
      return id === clientOrganization.id;
    },
    async isActive(id) {
      return id === clientOrganization.id && clientOrganization.status === "active";
    },
    async listSelectors(): Promise<ClientOrganizationSelector[]> {
      return [
        {
          id: clientOrganization.id,
          name: clientOrganization.name,
          displayName: clientOrganization.displayName,
          status: clientOrganization.status,
        },
      ];
    },
  };
}

function createInMemoryLocationRepository(location: Location): LocationRepository {
  return {
    async create() {
      return location;
    },
    async update() {
      return location;
    },
    async getById(id) {
      return location.id === id ? location : null;
    },
    async list() {
      return [location];
    },
    async listByClientOrganizationId(clientOrganizationId) {
      return location.clientOrganizationId === clientOrganizationId ? [location] : [];
    },
    async setActiveState() {
      return location;
    },
    async verifyBelongsToOrganization(locationId, clientOrganizationId) {
      return (
        location.id === locationId &&
        location.clientOrganizationId === clientOrganizationId
      );
    },
  };
}

function createInMemoryWorkOrderRepository(
  store: Map<EntityId, WorkOrder>,
): WorkOrderRepository {
  return {
    async create(input: CreateWorkOrderRepositoryInput) {
      const now = input.now ?? "2026-04-14T00:00:00.000Z";
      const item: WorkOrder = {
        id: input.id ?? "wo-generated",
        workOrderNumber: input.workOrderNumber ?? generateWorkOrderNumber(input.id ?? "wo-generated"),
        title: input.data.title.trim(),
        description: input.data.description.trim(),
        clientOrganizationId: input.data.clientOrganizationId,
        locationId: input.data.locationId,
        status: input.status ?? "NEW",
        priority: input.data.priority,
        category: input.data.category,
        requestedByName: input.data.requestedByName.trim(),
        requestedByEmail: input.data.requestedByEmail ?? null,
        requestedByPhone: input.data.requestedByPhone ?? null,
        source: input.data.source,
        createdByUserId: input.data.createdByUserId,
        assignedCoordinatorUserId: input.data.assignedCoordinatorUserId ?? null,
        assignedManagerUserId: input.data.assignedManagerUserId ?? null,
        dueDate: input.data.dueDate ?? null,
        createdAt: now,
        updatedAt: now,
        closedAt: input.closedAt ?? null,
        isArchived: false,
        searchText:
          input.searchText ??
          normalizeWorkOrderSearchText({
            workOrderNumber:
              input.workOrderNumber ?? generateWorkOrderNumber(input.id ?? "wo-generated"),
            title: input.data.title,
            description: input.data.description,
            requestedByName: input.data.requestedByName,
            requestedByEmail: input.data.requestedByEmail,
            requestedByPhone: input.data.requestedByPhone,
            clientOrganizationId: input.data.clientOrganizationId,
            locationId: input.data.locationId,
          }),
      };
      store.set(item.id, item);
      return item;
    },
    async getById(id) {
      return store.get(id) ?? null;
    },
    async update() {
      return null;
    },
    async updateStatus(input: UpdateWorkOrderStatusRepositoryInput) {
      const existing = store.get(input.workOrderId);
      if (!existing) {
        return null;
      }

      const updated: WorkOrder = {
        ...existing,
        status: input.status,
        closedAt:
          input.closedAt === undefined ? existing.closedAt : input.closedAt,
        updatedAt: input.now ?? existing.updatedAt,
      };
      store.set(updated.id, updated);
      return updated;
    },
    async list(filters: WorkOrderRepositoryListFilters = {}) {
      return [...store.values()]
        .filter((workOrder) =>
          filters.status ? workOrder.status === filters.status : true,
        )
        .filter((workOrder) =>
          filters.priority ? workOrder.priority === filters.priority : true,
        )
        .map((workOrder) => ({
          id: workOrder.id,
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          clientOrganizationId: workOrder.clientOrganizationId,
          locationId: workOrder.locationId,
          status: workOrder.status,
          priority: workOrder.priority,
          category: workOrder.category,
          source: workOrder.source,
          requestedByName: workOrder.requestedByName,
          assignedCoordinatorUserId: workOrder.assignedCoordinatorUserId,
          assignedManagerUserId: workOrder.assignedManagerUserId,
          dueDate: workOrder.dueDate,
          createdAt: workOrder.createdAt,
          updatedAt: workOrder.updatedAt,
          closedAt: workOrder.closedAt,
          isArchived: workOrder.isArchived,
        }));
    },
    async assertLocationBelongsToClient(clientOrganizationId, locationId) {
      const workOrder = [...store.values()].find((item) => item.locationId === locationId);
      return workOrder ? workOrder.clientOrganizationId === clientOrganizationId : true;
    },
  };
}

function createInMemoryNoteRepository(
  store: Map<EntityId, WorkOrderNote[]>,
): WorkOrderNoteRepository {
  return {
    async createNote(input: CreateWorkOrderNoteRepositoryInput) {
      const note = makeNote({
        id: input.id ?? `note-${(store.get(input.workOrderId)?.length ?? 0) + 1}`,
        workOrderId: input.workOrderId,
        body: (input.data as CreateWorkOrderNoteDto).body.trim(),
        createdByUserId: input.data.createdByUserId,
        createdAt: input.now ?? "2026-04-14T00:00:00.000Z",
        updatedAt: input.now ?? "2026-04-14T00:00:00.000Z",
      });
      store.set(input.workOrderId, [...(store.get(input.workOrderId) ?? []), note]);
      return note;
    },
    async listNotesByWorkOrderId(workOrderId) {
      return store.get(workOrderId) ?? [];
    },
  };
}

function createInMemoryAttachmentRepository(
  store: Map<EntityId, WorkOrderAttachment[]>,
): WorkOrderAttachmentRepository {
  return {
    async createAttachment(input: CreateWorkOrderAttachmentRepositoryInput) {
      const attachment = makeAttachment({
        id: input.id ?? `attachment-${(store.get(input.workOrderId)?.length ?? 0) + 1}`,
        workOrderId: input.workOrderId,
        fileName: (input.data as CreateWorkOrderAttachmentMetadataDto).fileName.trim(),
        contentType: input.data.contentType,
        fileSizeBytes: input.data.fileSizeBytes,
        storagePath: input.data.storagePath,
        uploadedByUserId: input.data.uploadedByUserId,
        createdAt: input.now ?? "2026-04-14T00:00:00.000Z",
      });
      store.set(
        input.workOrderId,
        [...(store.get(input.workOrderId) ?? []), attachment],
      );
      return attachment;
    },
    async listAttachmentsByWorkOrderId(workOrderId) {
      return store.get(workOrderId) ?? [];
    },
  };
}

function makeCreatePayload(
  overrides: Partial<CreateWorkOrderDto> = {},
): CreateWorkOrderDto {
  return {
    title: "Replace failed rooftop capacitor",
    description: "Diagnose the rooftop unit and replace the failed capacitor.",
    clientOrganizationId: "client-1",
    locationId: "location-1",
    priority: "HIGH",
    category: "HVAC",
    requestedByName: "Jordan Lee",
    requestedByEmail: "jordan@example.com",
    requestedByPhone: "555-123-4567",
    source: "CLIENT_PORTAL",
    createdByUserId: "user-1",
    assignedCoordinatorUserId: undefined,
    assignedManagerUserId: undefined,
    dueDate: undefined,
    status: undefined,
    ...overrides,
  };
}

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo-1",
    workOrderNumber: "WO-00000001",
    title: "Fix rooftop leak",
    description: "Investigate and remediate the active roof leak.",
    clientOrganizationId: "client-1",
    locationId: "location-1",
    status: "NEW",
    priority: "MEDIUM",
    category: "GENERAL_REPAIR",
    requestedByName: "Jordan Lee",
    requestedByEmail: "jordan@example.com",
    requestedByPhone: "555-123-4567",
    source: "MANUAL",
    createdByUserId: "user-1",
    assignedCoordinatorUserId: null,
    assignedManagerUserId: null,
    dueDate: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    closedAt: null,
    isArchived: false,
    searchText: "fix rooftop leak jordan lee",
    ...overrides,
  };
}

function makeNote(overrides: Partial<WorkOrderNote> = {}): WorkOrderNote {
  return {
    id: "note-1",
    workOrderId: "wo-1",
    body: "Waiting on access.",
    createdByUserId: "user-1",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}

function makeAttachment(
  overrides: Partial<WorkOrderAttachment> = {},
): WorkOrderAttachment {
  return {
    id: "attachment-1",
    workOrderId: "wo-1",
    fileName: "estimate.pdf",
    contentType: "application/pdf",
    fileSizeBytes: 2048,
    storagePath: "work-orders/wo-1/estimate.pdf",
    uploadedByUserId: "user-1",
    createdAt: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}

function makeClientOrganization(
  overrides: Partial<ClientOrganization> = {},
): ClientOrganization {
  return {
    id: "client-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    name: "Acme Facilities",
    displayName: "Acme Facilities",
    status: "active",
    ...overrides,
  };
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "location-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    clientOrganizationId: "client-1",
    name: "Downtown Tower",
    status: "active",
    ...overrides,
  };
}
