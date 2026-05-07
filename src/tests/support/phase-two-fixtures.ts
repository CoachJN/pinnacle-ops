import type { AccessActor } from "../../types/auth.ts";
import {
  createLocationService,
  type LocationService,
} from "../../server/services/location-admin-service.ts";
import type {
  ClientOrganizationRepository,
} from "../../lib/repositories/client-organization.repository.ts";
import type {
  LocationListFilters,
  LocationRepository,
} from "../../lib/repositories/location.repository.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import type {
  ClientOrganizationContactLink,
  ClientOrganization as FirestoreClientOrganization,
  ClientInvoice as Invoice,
  ClientQuote as Quote,
  Contact,
  ContractorOrganization,
  FirestoreRepositories,
  LocationContactLink,
  Location as FirestoreLocation,
  RepositoryListOptions,
  RepositoryListResult,
  WorkOrder,
} from "../../server/repositories/index.ts";
import {
  createClientLocationService,
  type ClientLocationService,
} from "../../server/services/client-location-service.ts";
import {
  createWorkOrderService,
  type WorkOrderService,
} from "../../server/services/work-order-service.ts";
import type {
  DomainEventType,
} from "../../server/events/types.ts";
import type {
  DomainEventService,
  RecordDomainEventInput,
} from "../../server/services/domain-event-service.ts";
import type { ServiceAuditContext } from "../../server/services/types.ts";
import { serviceOk } from "../../server/services/types.ts";
import type { EntityId } from "../../types/entity.ts";
import type { ClientOrganization as DomainClientOrganization } from "../../types/client-organization.ts";
import type { PreferredLanguage } from "../../types/contact.ts";
import type { Location as DomainLocation } from "../../types/location.ts";

const DEFAULT_NOW = "2026-04-13T12:00:00.000Z";

export interface PhaseTwoServiceHarness {
  clientLocations: ClientLocationService;
  workOrders: WorkOrderService;
  repositories: Pick<
    FirestoreRepositories,
    | "clientOrganizationContactLinks"
    | "clientOrganizations"
    | "contacts"
    | "locations"
    | "locationContactLinks"
    | "workOrders"
    | "clientQuotes"
    | "clientInvoices"
    | "contractorOrganizations"
  >;
  recordedActivityInputs: Array<RecordDomainEventInput<DomainEventType>>;
}

export interface LocationDomainServiceHarness {
  service: LocationService;
  repositories: {
    clientOrganizations: ClientOrganizationRepository;
    locations: LocationRepository;
  };
}

function toDomainClientOrganization(
  entity: FirestoreClientOrganization,
): DomainClientOrganization {
  return {
    id: entity.id,
    organizationId: entity.organizationId,
    recordStatus: entity.recordStatus,
    isDeleted: entity.isDeleted,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    createdByUserId: entity.createdByUserId,
    updatedByUserId: entity.updatedByUserId,
    deletedAt: entity.deletedAt ?? undefined,
    deletedByUserId: entity.deletedByUserId ?? undefined,
    name: entity.name,
    displayName: entity.displayName ?? undefined,
    status: entity.status,
    primaryContactId: entity.primaryContactId ?? undefined,
    billingContactId: entity.billingContactId ?? undefined,
    notes: entity.notes ?? undefined,
  };
}

function toDomainLocation(entity: FirestoreLocation): DomainLocation {
  return {
    id: entity.id,
    organizationId: entity.organizationId,
    recordStatus: entity.recordStatus,
    isDeleted: entity.isDeleted,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    createdByUserId: entity.createdByUserId,
    updatedByUserId: entity.updatedByUserId,
    deletedAt: entity.deletedAt ?? undefined,
    deletedByUserId: entity.deletedByUserId ?? undefined,
    clientOrganizationId: entity.clientOrganizationId,
    name: entity.name,
    code: entity.code ?? undefined,
    status: entity.status,
    addressLine1: entity.addressLine1 ?? undefined,
    addressLine2: entity.addressLine2 ?? undefined,
    city: entity.city ?? undefined,
    region: entity.region ?? undefined,
    postalCode: entity.postalCode ?? undefined,
    countryCode: entity.countryCode ?? undefined,
    accessNotes: entity.accessNotes ?? undefined,
    notes: entity.notes ?? undefined,
  };
}

export function makeOwnerActor(
  overrides: Partial<AccessActor> = {},
): AccessActor {
  return {
    actorType: "internal",
    userId: "owner-1",
    role: USER_ROLES.Owner,
    scope: {
      kind: "internal",
      organizationId: "org-1",
    },
    ...overrides,
  } as AccessActor;
}

export function makeClientActor(input: {
  organizationId?: EntityId;
  clientOrganizationId?: EntityId;
  locationIds?: EntityId[];
} = {}): AccessActor {
  return {
    actorType: "client",
    userId: "client-user-1",
    role: USER_ROLES.ClientUser,
    scope: {
      kind: "client",
      organizationId: input.organizationId ?? "org-1",
      clientOrganizationId: input.clientOrganizationId ?? "client-1",
      locationAccess: input.locationIds
        ? {
            kind: "selected_client_locations",
            locationIds: input.locationIds,
          }
        : {
            kind: "all_client_locations",
          },
    },
  };
}

export function makeContractorActor(input: {
  organizationId?: EntityId;
  contractorOrganizationId?: EntityId;
} = {}): AccessActor {
  return {
    actorType: "contractor",
    userId: "contractor-user-1",
    role: USER_ROLES.ContractorUser,
    scope: {
      kind: "contractor",
      organizationId: input.organizationId ?? "org-1",
      contractorOrganizationId: input.contractorOrganizationId ?? "contractor-1",
    },
  };
}

export function makeAuditContext(
  actor: AccessActor = makeOwnerActor(),
  overrides: Partial<ServiceAuditContext> = {},
): ServiceAuditContext {
  return {
    organizationId: actor.scope.organizationId,
    actor: {
      userId: actor.userId,
      role: actor.role,
    },
    now: DEFAULT_NOW,
    ...overrides,
  };
}

export function makeClientOrganization(
  overrides: Partial<FirestoreClientOrganization> = {},
): FirestoreClientOrganization {
  return {
    id: "client-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    createdByUserId: "owner-1",
    updatedByUserId: "owner-1",
    deletedAt: null,
    deletedByUserId: null,
    name: "Northstar Properties",
    displayName: "Northstar",
    status: "active",
    primaryContactId: "contact-alex-client",
    billingContactId: "contact-alex-client",
    notes: null,
    ...overrides,
  };
}

export function makeLocation(
  overrides: Partial<FirestoreLocation> = {},
): FirestoreLocation {
  const clientOrganizationId = overrides.clientOrganizationId ?? "client-1";
  return {
    id: "loc-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    createdByUserId: "owner-1",
    updatedByUserId: "owner-1",
    deletedAt: null,
    deletedByUserId: null,
    clientOrganizationId,
    name: "Pinnacle Tower",
    code: "PT-01",
    status: "active",
    addressLine1: "110 King St W",
    addressLine2: null,
    city: "Toronto",
    region: "ON",
    postalCode: "M5X 1A9",
    countryCode: "CA",
    accessNotes: null,
    notes: null,
    ...overrides,
  };
}

export function makeContact(
  overrides: Partial<Contact> & {
    id?: EntityId;
    firstName?: string;
    lastName?: string;
    preferredLanguage?: PreferredLanguage;
  } = {},
): Contact {
  const firstName = overrides.firstName ?? "Alex";
  const lastName = overrides.lastName ?? "Contact";
  return {
    id: overrides.id ?? `contact-${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    createdByUserId: "owner-1",
    updatedByUserId: "owner-1",
    deletedAt: null,
    deletedByUserId: null,
    firstName,
    lastName,
    displayName: overrides.displayName ?? `${firstName} ${lastName}`,
    email: overrides.email ?? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    primaryPhone: overrides.primaryPhone ?? "416-555-0100",
    secondaryPhone: overrides.secondaryPhone ?? null,
    roleTitle: overrides.roleTitle ?? "Operations",
    preferredLanguage: overrides.preferredLanguage ?? "en",
    preferredContactMethod: overrides.preferredContactMethod ?? "email",
    notes: overrides.notes ?? null,
    status: overrides.status ?? "active",
    ...overrides,
  };
}

export function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    createdByUserId: "owner-1",
    updatedByUserId: "owner-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1",
    title: "Generator repair",
    description: "Investigate generator fault.",
    lifecycleStatus: "new",
    status: "new",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByContactId: null,
    coordinatorUserId: null,
    managerUserId: null,
    assignedContractorOrgId: null,
    assignedContractorId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    clientSnapshot: {
      id: "client-1",
      name: "Northstar",
    },
    locationSnapshot: {
      id: "loc-1",
      name: "Pinnacle Tower",
      addressText: "110 King St W, Toronto, ON, M5X 1A9, CA",
    },
    contractorSnapshot: null,
    category: null,
    requestedServiceDate: null,
    submittedAt: null,
    approvedAt: null,
    completedAt: null,
    closedAt: null,
    ...overrides,
  };
}

export function createPhaseTwoServiceHarness(input: {
  clients?: FirestoreClientOrganization[];
  contacts?: Contact[];
  locations?: FirestoreLocation[];
  workOrders?: WorkOrder[];
} = {}): PhaseTwoServiceHarness {
  const contactStore = new Map<EntityId, Contact>(
    (input.contacts ?? [
      makeContact({
        id: "contact-avery-hill",
        firstName: "Avery",
        lastName: "Hill",
        roleTitle: "Operations Manager",
      }),
      makeContact({
        id: "contact-jordan-lee",
        firstName: "Jordan",
        lastName: "Lee",
        roleTitle: "Facilities Lead",
      }),
      makeContact({
        id: "contact-alex-client",
        firstName: "Alex",
        lastName: "Client",
        roleTitle: "Client Lead",
      }),
    ]).map((contact) => [contact.id, contact]),
  );
  const clientStore = new Map<EntityId, FirestoreClientOrganization>(
    (input.clients ?? []).map((client) => [client.id, client]),
  );
  const clientContactLinkStore = new Map<EntityId, ClientOrganizationContactLink>();
  const locationStore = new Map<EntityId, FirestoreLocation>(
    (input.locations ?? []).map((location) => [location.id, location]),
  );
  const locationContactLinkStore = new Map<EntityId, LocationContactLink>();
  const workOrderStore = new Map<EntityId, WorkOrder>(
    (input.workOrders ?? []).map((workOrder) => [workOrder.id, workOrder]),
  );
  const recordedActivityInputs: PhaseTwoServiceHarness["recordedActivityInputs"] = [];

  const repositories: PhaseTwoServiceHarness["repositories"] = {
    contacts: {
      newId() {
        return `contact-${contactStore.size + 1}`;
      },
      async getById(id) {
        return contactStore.get(id) ?? null;
      },
      async create(entity) {
        contactStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        contactStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async listByOrganizationId(organizationId, options) {
        return listEntities(contactStore, options, (item) =>
          item.organizationId === organizationId,
        );
      },
      async listByIds(contactIds) {
        const items = contactIds
          .map((contactId) => contactStore.get(contactId))
          .filter((contact): contact is Contact => Boolean(contact));
        return { items, count: items.length };
      },
    },
    clientOrganizations: {
      newId() {
        return `client-${clientStore.size + 1}`;
      },
      async getById(id) {
        return clientStore.get(id) ?? null;
      },
      async create(entity) {
        clientStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        clientStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async listByOrganizationId(organizationId, options) {
        return listEntities(clientStore, options, (item) =>
          item.organizationId === organizationId,
        );
      },
      async listActive(options) {
        return listEntities(
          clientStore,
          options,
          (item) =>
            item.recordStatus === "active" &&
            item.status === "active" &&
            !item.isDeleted,
        );
      },
    },
    clientOrganizationContactLinks: {
      newId() {
        return `client-link-${clientContactLinkStore.size + 1}`;
      },
      async getById(id) {
        return clientContactLinkStore.get(id) ?? null;
      },
      async create(entity) {
        clientContactLinkStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        clientContactLinkStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async listByClientOrganizationId(clientOrganizationId, options) {
        return listEntities(clientContactLinkStore, options, (item) =>
          item.clientOrganizationId === clientOrganizationId,
        );
      },
      async replaceForClientOrganizationId(clientOrganizationId, links) {
        for (const [id, link] of clientContactLinkStore.entries()) {
          if (link.clientOrganizationId === clientOrganizationId) {
            clientContactLinkStore.delete(id);
          }
        }

        for (const link of links) {
          clientContactLinkStore.set(link.id, link);
        }
      },
    },
    locations: {
      newId() {
        return `loc-${locationStore.size + 1}`;
      },
      async getById(id) {
        return locationStore.get(id) ?? null;
      },
      async create(entity) {
        locationStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        locationStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async listByOrganizationId(organizationId, options) {
        return listEntities(locationStore, options, (item) =>
          item.organizationId === organizationId,
        );
      },
      async listByClientOrganizationId(clientOrganizationId, options) {
        return listEntities(locationStore, options, (item) =>
          item.clientOrganizationId === clientOrganizationId,
        );
      },
    },
    locationContactLinks: {
      newId() {
        return `location-link-${locationContactLinkStore.size + 1}`;
      },
      async getById(id) {
        return locationContactLinkStore.get(id) ?? null;
      },
      async create(entity) {
        locationContactLinkStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        locationContactLinkStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async listByLocationId(locationId, options) {
        return listEntities(locationContactLinkStore, options, (item) =>
          item.locationId === locationId,
        );
      },
      async replaceForLocationId(locationId, links) {
        for (const [id, link] of locationContactLinkStore.entries()) {
          if (link.locationId === locationId) {
            locationContactLinkStore.delete(id);
          }
        }

        for (const link of links) {
          locationContactLinkStore.set(link.id, link);
        }
      },
    },
    workOrders: {
      newId() {
        return `wo-${workOrderStore.size + 1}`;
      },
      async getById(id) {
        return workOrderStore.get(id) ?? null;
      },
      async create(entity) {
        workOrderStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        workOrderStore.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async listByOrganizationId(organizationId, options) {
        return listEntities(workOrderStore, options, (item) =>
          item.organizationId === organizationId,
        );
      },
      async listByClientOrganizationId(clientOrganizationId, options) {
        return listEntities(workOrderStore, options, (item) =>
          item.clientOrganizationId === clientOrganizationId,
        );
      },
      async listByLocationId(locationId, options) {
        return listEntities(workOrderStore, options, (item) =>
          item.locationId === locationId,
        );
      },
      async listByCoordinatorUserId(coordinatorUserId, options) {
        return listEntities(workOrderStore, options, (item) =>
          item.coordinatorUserId === coordinatorUserId,
        );
      },
      async listByManagerUserId(managerUserId, options) {
        return listEntities(workOrderStore, options, (item) =>
          item.managerUserId === managerUserId,
        );
      },
      async listByContractorOrganizationId(contractorOrganizationId, options) {
        return listEntities(workOrderStore, options, (item) =>
          item.assignedContractorId === contractorOrganizationId,
        );
      },
    },
    clientQuotes: createEmptyQuoteRepository(),
    clientInvoices: createEmptyInvoiceRepository(),
    contractorOrganizations: createEmptyContractorOrganizationRepository(),
  };

  const domainEvents: DomainEventService = {
    async listTimelineForWorkOrder() {
      return serviceOk([]);
    },
    async listTimelineForEntity() {
      return serviceOk([]);
    },
    async record(inputRecord) {
      recordedActivityInputs.push(inputRecord);
      return serviceOk(null as never);
    },
    async recordTransition() {
      return serviceOk(null as never);
    },
  };

  const clientLocations = createClientLocationService(repositories);
  const workOrders = createWorkOrderService(repositories, {
    domainEvents,
    clientLocations,
  });

  return {
    clientLocations,
    workOrders,
    repositories,
    recordedActivityInputs,
  };
}

export function createLocationDomainServiceHarness(input: {
  clients?: readonly FirestoreClientOrganization[];
  locations?: readonly FirestoreLocation[];
} = {}): LocationDomainServiceHarness {
  const clientStore = new Map<EntityId, DomainClientOrganization>(
    (input.clients ?? []).map((client) => [
      client.id,
      toDomainClientOrganization(client),
    ]),
  );
  const locationStore = new Map<EntityId, DomainLocation>(
    (input.locations ?? []).map((location) => [location.id, toDomainLocation(location)]),
  );

  const clientOrganizations: ClientOrganizationRepository = {
    async getById(id) {
      return clientStore.get(id) ?? null;
    },
    async list(filters = {}) {
      return [...clientStore.values()]
        .filter((client) =>
          filters.organizationId
            ? client.organizationId === filters.organizationId
            : true,
        )
        .filter((client) =>
          filters.ids?.length ? filters.ids.includes(client.id) : true,
        )
        .filter((client) =>
          filters.status ? client.status === filters.status : true,
        )
        .filter((client) =>
          filters.recordStatus
            ? client.recordStatus === filters.recordStatus
            : true,
        )
        .filter((client) => {
          const search = filters.search?.trim().toLowerCase();
          if (!search) {
            return true;
          }

          return [client.name, client.displayName]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(search));
        })
        .slice(0, filters.limit);
    },
    async exists(id) {
      const client = clientStore.get(id);
      return Boolean(client && !client.isDeleted);
    },
    async isActive(id) {
      const client = clientStore.get(id);
      return Boolean(
        client &&
          !client.isDeleted &&
          client.recordStatus === "active" &&
          client.status === "active",
      );
    },
    async listSelectors(filters = {}) {
      const organizations = await this.list(filters);
      return organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        displayName: organization.displayName,
        status: organization.status,
      }));
    },
  };

  const locations: LocationRepository = {
    async create(inputCreate) {
      const timestamp = inputCreate.now ?? DEFAULT_NOW;
      const location: DomainLocation = {
        id: `loc-${locationStore.size + 1}`,
        organizationId: inputCreate.organizationId,
        recordStatus: "active",
        isDeleted: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdByUserId: inputCreate.actorUserId,
        updatedByUserId: inputCreate.actorUserId,
        deletedAt: undefined,
        deletedByUserId: undefined,
        clientOrganizationId: inputCreate.clientOrganization.id,
        name: inputCreate.data.name,
        code: inputCreate.data.code,
        status: inputCreate.data.status ?? "active",
        primaryContactId: inputCreate.data.primaryContactId,
        siteContactId: inputCreate.data.siteContactId,
        addressLine1: inputCreate.data.addressLine1,
        addressLine2: inputCreate.data.addressLine2,
        city: inputCreate.data.city,
        region: inputCreate.data.region,
        postalCode: inputCreate.data.postalCode,
        countryCode: inputCreate.data.countryCode,
        accessNotes: inputCreate.data.accessNotes,
        notes: inputCreate.data.notes,
      };

      locationStore.set(location.id, location);
      return location;
    },
    async update(inputUpdate) {
      const existing = locationStore.get(inputUpdate.locationId);
      if (!existing) {
        return null;
      }

      const updated: DomainLocation = {
        ...existing,
        updatedAt: inputUpdate.now ?? DEFAULT_NOW,
        updatedByUserId: inputUpdate.actorUserId,
        clientOrganizationId:
          inputUpdate.clientOrganization?.id ?? existing.clientOrganizationId,
        name: inputUpdate.data.name ?? existing.name,
        code:
          inputUpdate.data.code === undefined
            ? existing.code
            : inputUpdate.data.code ?? undefined,
        status: inputUpdate.data.status ?? existing.status,
        primaryContactId:
          inputUpdate.data.primaryContactId === undefined
            ? existing.primaryContactId
            : inputUpdate.data.primaryContactId ?? undefined,
        siteContactId:
          inputUpdate.data.siteContactId === undefined
            ? existing.siteContactId
            : inputUpdate.data.siteContactId ?? undefined,
        addressLine1:
          inputUpdate.data.addressLine1 === undefined
            ? existing.addressLine1
            : inputUpdate.data.addressLine1 ?? undefined,
        addressLine2:
          inputUpdate.data.addressLine2 === undefined
            ? existing.addressLine2
            : inputUpdate.data.addressLine2 ?? undefined,
        city:
          inputUpdate.data.city === undefined
            ? existing.city
            : inputUpdate.data.city ?? undefined,
        region:
          inputUpdate.data.region === undefined
            ? existing.region
            : inputUpdate.data.region ?? undefined,
        postalCode:
          inputUpdate.data.postalCode === undefined
            ? existing.postalCode
            : inputUpdate.data.postalCode ?? undefined,
        countryCode:
          inputUpdate.data.countryCode === undefined
            ? existing.countryCode
            : inputUpdate.data.countryCode ?? undefined,
        accessNotes:
          inputUpdate.data.accessNotes === undefined
            ? existing.accessNotes
            : inputUpdate.data.accessNotes ?? undefined,
        notes:
          inputUpdate.data.notes === undefined
            ? existing.notes
            : inputUpdate.data.notes ?? undefined,
      };

      locationStore.set(updated.id, updated);
      return updated;
    },
    async getById(id) {
      return locationStore.get(id) ?? null;
    },
    async list(filters = {}) {
      return applyLocationRepositoryFilters([...locationStore.values()], filters);
    },
    async listByClientOrganizationId(clientOrganizationId, filters = {}) {
      return applyLocationRepositoryFilters([...locationStore.values()], {
        ...filters,
        clientOrganizationId,
      });
    },
    async setActiveState(inputSetState) {
      const existing = locationStore.get(inputSetState.locationId);
      if (!existing) {
        return null;
      }

      const updated: DomainLocation = {
        ...existing,
        status: inputSetState.isActive ? "active" : "inactive",
        updatedAt: inputSetState.now ?? DEFAULT_NOW,
        updatedByUserId: inputSetState.actorUserId,
      };

      locationStore.set(updated.id, updated);
      return updated;
    },
    async verifyBelongsToOrganization(locationId, clientOrganizationId) {
      const location = locationStore.get(locationId);
      return Boolean(
        location &&
          !location.isDeleted &&
          location.recordStatus === "active" &&
          location.clientOrganizationId === clientOrganizationId,
      );
    },
  };

  return {
    service: createLocationService({
      clientOrganizations,
      locations,
    }),
    repositories: {
      clientOrganizations,
      locations,
    },
  };
}

function listEntities<T>(
  store: Map<EntityId, T>,
  options: RepositoryListOptions | undefined,
  predicate: (item: T) => boolean,
): RepositoryListResult<T> {
  const items = [...store.values()].filter(predicate).slice(0, options?.limit);
  return {
    items,
    count: items.length,
  };
}

function createEmptyQuoteRepository(): FirestoreRepositories["clientQuotes"] {
  const store = new Map<EntityId, Quote>();
  return {
    newId() {
      return `quote-${store.size + 1}`;
    },
    async getById(id) {
      return store.get(id) ?? null;
    },
    async create(entity) {
      store.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      store.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId(workOrderId, options) {
      return listEntities(store, options, (item) => item.workOrderId === workOrderId);
    },
    async getActiveByWorkOrderId(workOrderId) {
      return (
        [...store.values()].find(
          (item) =>
            item.workOrderId === workOrderId &&
            (item.status === "draft" || item.status === "sent"),
        ) ?? null
      );
    },
  };
}

function createEmptyInvoiceRepository(): FirestoreRepositories["clientInvoices"] {
  const store = new Map<EntityId, Invoice>();
  return {
    newId() {
      return `invoice-${store.size + 1}`;
    },
    async getById(id) {
      return store.get(id) ?? null;
    },
    async create(entity) {
      store.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      store.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId(workOrderId, options) {
      return listEntities(store, options, (item) => item.workOrderId === workOrderId);
    },
    async listFinanceQueue(options) {
      return listEntities(store, options, () => true);
    },
  };
}

function createEmptyContractorOrganizationRepository(): FirestoreRepositories["contractorOrganizations"] {
  const store = new Map<EntityId, ContractorOrganization>();
  return {
    newId() {
      return `contractor-${store.size + 1}`;
    },
    async getById(id) {
      return store.get(id) ?? null;
    },
    async create(entity) {
      store.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      store.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId(organizationId, options) {
      return listEntities(store, options, (item) =>
        item.organizationId === organizationId,
      );
    },
    async listActive(options) {
      return listEntities(
        store,
        options,
        (item) =>
          item.recordStatus === "active" &&
          item.status === "active" &&
          !item.isDeleted,
      );
    },
  };
}

function applyLocationRepositoryFilters(
  locations: DomainLocation[],
  filters: LocationListFilters,
): DomainLocation[] {
  const normalizedSearch = filters.search?.trim().toLowerCase();

  return locations
    .filter((location) =>
      filters.organizationId
        ? location.organizationId === filters.organizationId
        : true,
    )
    .filter((location) =>
      filters.clientOrganizationId
        ? location.clientOrganizationId === filters.clientOrganizationId
        : true,
    )
    .filter((location) =>
      filters.locationIds?.length ? filters.locationIds.includes(location.id) : true,
    )
    .filter((location) =>
      filters.status ? location.status === filters.status : true,
    )
    .filter((location) =>
      filters.recordStatus ? location.recordStatus === filters.recordStatus : true,
    )
    .filter((location) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        location.name,
        location.code,
        location.city,
        location.region,
        location.postalCode,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .slice(0, filters.limit);
}
