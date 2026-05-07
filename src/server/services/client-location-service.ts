import "server-only";

import { AppError } from "@/lib/errors/app-error";
import {
  ensureRoleSlotContactsAreLinked,
  isContactAssignedToPrimaryRole,
  type ContactRoleSlotAssignment,
} from "@/lib/contact-linking";
import { assertValidWorkOrderLocationSelection } from "@/lib/permissions/work-orders";
import type {
  ClientOrganization,
  ClientOrganizationContactLink,
  Contact,
  FirestoreOrganizationStatus,
  FirestoreRepositories,
  Location,
  LocationContactLink,
} from "@/server/repositories";
import type { ContactLinkInput } from "@/types/contact";
import type { EntityId } from "@/types/entity";
import { conflictError, notFoundError, validationError } from "./errors";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types";

export interface ClientLocationService {
  listClients(input: ListClientOrganizationsInput): Promise<ServiceResult<ClientOrganization[]>>;
  getClient(clientOrganizationId: EntityId): Promise<ServiceResult<ClientOrganization>>;
  createClient(input: CreateClientOrganizationInput): Promise<ServiceResult<ClientOrganization>>;
  updateClient(input: UpdateClientOrganizationInput): Promise<ServiceResult<ClientOrganization>>;
  archiveClient(input: ArchiveClientOrganizationInput): Promise<ServiceResult<ClientOrganization>>;
  listLocations(input: ListLocationsInput): Promise<ServiceResult<Location[]>>;
  getLocation(locationId: EntityId): Promise<ServiceResult<Location>>;
  createLocation(input: CreateLocationInput): Promise<ServiceResult<Location>>;
  updateLocation(input: UpdateLocationInput): Promise<ServiceResult<Location>>;
  archiveLocation(input: ArchiveLocationInput): Promise<ServiceResult<Location>>;
  getClientLocationContext(
    input: ClientLocationContextInput,
  ): Promise<ServiceResult<ClientLocationContext>>;
}

export interface ListClientOrganizationsInput {
  organizationId: EntityId;
  limit?: number;
}

export interface CreateClientOrganizationInput extends ServiceAuditContext {
  name: string;
  displayName?: string | null;
  status?: FirestoreOrganizationStatus;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  notes?: string | null;
}

export interface UpdateClientOrganizationInput extends ServiceAuditContext {
  clientOrganizationId: EntityId;
  name?: string;
  displayName?: string | null;
  status?: FirestoreOrganizationStatus;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  notes?: string | null;
}

export interface ArchiveClientOrganizationInput extends ServiceAuditContext {
  clientOrganizationId: EntityId;
}

export type ListLocationsInput =
  | {
      scope: "organization";
      organizationId: EntityId;
      limit?: number;
    }
  | {
      scope: "clientOrganization";
      clientOrganizationId: EntityId;
      limit?: number;
    }
  | {
      scope: "ids";
      locationIds: EntityId[];
      limit?: number;
    };

export interface CreateLocationInput extends ServiceAuditContext {
  clientOrganizationId: EntityId;
  name: string;
  displayName?: string | null;
  code?: string | null;
  storeNumber?: string | null;
  status?: FirestoreOrganizationStatus;
  primaryContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timeZone?: string | null;
  accessNotes?: string | null;
  serviceNotes?: string | null;
  notes?: string | null;
}

export interface UpdateLocationInput extends ServiceAuditContext {
  locationId: EntityId;
  clientOrganizationId?: EntityId;
  name?: string;
  displayName?: string | null;
  code?: string | null;
  storeNumber?: string | null;
  status?: FirestoreOrganizationStatus;
  primaryContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timeZone?: string | null;
  accessNotes?: string | null;
  serviceNotes?: string | null;
  notes?: string | null;
}

export interface ArchiveLocationInput extends ServiceAuditContext {
  locationId: EntityId;
}

export interface ClientLocationContextInput {
  organizationId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}

export interface ClientLocationContext {
  client: ClientOrganization;
  location: Location;
}

export function createClientLocationService(
  repositories: Pick<
    FirestoreRepositories,
    | "clientOrganizations"
    | "clientOrganizationContactLinks"
    | "contacts"
    | "locations"
    | "locationContactLinks"
    | "workOrders"
  >,
): ClientLocationService {
  return new FirestoreClientLocationService(repositories);
}

class FirestoreClientLocationService implements ClientLocationService {
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      | "clientOrganizations"
      | "clientOrganizationContactLinks"
      | "contacts"
      | "locations"
      | "locationContactLinks"
      | "workOrders"
    >,
  ) {}

  async listClients(
    input: ListClientOrganizationsInput,
  ): Promise<ServiceResult<ClientOrganization[]>> {
    const clients =
      await this.repositories.clientOrganizations.listByOrganizationId(
        input.organizationId,
        { limit: input.limit },
      );
    return serviceOk(clients.items);
  }

  async getClient(
    clientOrganizationId: EntityId,
  ): Promise<ServiceResult<ClientOrganization>> {
    const client = await this.repositories.clientOrganizations.getById(
      clientOrganizationId,
    );
    if (!client || client.isDeleted) {
      return serviceFail(notFoundError("Client organization could not be found."));
    }

    return serviceOk(client);
  }

  async createClient(
    input: CreateClientOrganizationInput,
  ): Promise<ServiceResult<ClientOrganization>> {
    const name = normalizeRequiredText(input.name, "Client name");
    if (!name.ok) {
      return name;
    }

    const primaryContactId = normalizeNullableText(input.primaryContactId);
    const billingContactId = normalizeNullableText(input.billingContactId);
    const linkedContacts = resolveNormalizedLinks({
      requestedLinks: input.linkedContacts ?? [],
      roleSlots: toClientRoleSlots({
        primaryContactId,
        billingContactId,
      }),
    });
    const clientContactValidation = await validateContactsExist(
      this.repositories.contacts,
      linkedContacts.map((link) => link.contactId),
    );
    if (!clientContactValidation.ok) {
      return clientContactValidation;
    }

    const client: ClientOrganization = {
      id: this.repositories.clientOrganizations.newId(),
      ...createAuditFields(input),
      name: name.value,
      displayName: normalizeNullableText(input.displayName),
      status: input.status ?? "active",
      primaryContactId,
      billingContactId,
      notes: normalizeNullableText(input.notes),
    };

    await this.repositories.clientOrganizations.create(client);
    await this.repositories.clientOrganizationContactLinks.replaceForClientOrganizationId(
      client.id,
      buildClientOrganizationContactLinks({
        client,
        linkedContacts,
        roleSlots: toClientRoleSlots({
          primaryContactId,
          billingContactId,
        }),
        audit: input,
      }),
    );
    return serviceOk(client);
  }

  async updateClient(
    input: UpdateClientOrganizationInput,
  ): Promise<ServiceResult<ClientOrganization>> {
    const existing = await this.repositories.clientOrganizations.getById(
      input.clientOrganizationId,
    );
    if (!existing || existing.isDeleted) {
      return serviceFail(notFoundError("Client organization could not be found."));
    }

    const name =
      input.name === undefined
        ? serviceOk(existing.name)
        : normalizeRequiredText(input.name, "Client name");
    if (!name.ok) {
      return name;
    }

    const primaryContactId =
      input.primaryContactId === undefined
        ? existing.primaryContactId
        : normalizeNullableText(input.primaryContactId);
    const billingContactId =
      input.billingContactId === undefined
        ? existing.billingContactId
        : normalizeNullableText(input.billingContactId);
    const existingLinks =
      await this.repositories.clientOrganizationContactLinks.listByClientOrganizationId(
        existing.id,
        { limit: 100 },
      );
    const roleSlots = toClientRoleSlots({
      primaryContactId: primaryContactId ?? null,
      billingContactId: billingContactId ?? null,
    });
    const linkedContacts = resolveNormalizedLinks({
      existingLinks: existingLinks.items,
      requestedLinks: input.linkedContacts,
      roleSlots,
    });
    const clientContactValidation = await validateContactsExist(
      this.repositories.contacts,
      linkedContacts.map((link) => link.contactId),
    );
    if (!clientContactValidation.ok) {
      return clientContactValidation;
    }

    const updated = touchAuditFields(
      {
        ...existing,
        name: name.value,
        displayName:
          input.displayName === undefined
            ? existing.displayName
            : normalizeNullableText(input.displayName),
        status: input.status ?? existing.status,
        primaryContactId,
        billingContactId,
        notes:
          input.notes === undefined
            ? existing.notes
            : normalizeNullableText(input.notes),
      },
      input,
    );

    await this.repositories.clientOrganizations.save(updated);
    await this.repositories.clientOrganizationContactLinks.replaceForClientOrganizationId(
      updated.id,
      buildClientOrganizationContactLinks({
        client: updated,
        linkedContacts,
        roleSlots,
        audit: input,
      }),
    );
    return serviceOk(updated);
  }

  async archiveClient(
    input: ArchiveClientOrganizationInput,
  ): Promise<ServiceResult<ClientOrganization>> {
    const existing = await this.repositories.clientOrganizations.getById(
      input.clientOrganizationId,
    );
    if (!existing || existing.isDeleted) {
      return serviceFail(notFoundError("Client organization could not be found."));
    }

    const locations =
      await this.repositories.locations.listByClientOrganizationId(existing.id, {
        limit: 1,
      });
    if (locations.items.length > 0) {
      return serviceFail(
        conflictError("Client organizations with locations cannot be archived."),
      );
    }

    const archivedAt = input.now ?? new Date().toISOString();
    const archived = touchAuditFields(
      {
        ...existing,
        recordStatus: "archived" as const,
        isDeleted: true,
        deletedAt: archivedAt,
        deletedByUserId: input.actor.userId,
      },
      { ...input, now: archivedAt },
    );

    await this.repositories.clientOrganizations.save(archived);
    return serviceOk(archived);
  }

  async listLocations(
    input: ListLocationsInput,
  ): Promise<ServiceResult<Location[]>> {
    if (input.scope === "organization") {
      const locations = await this.repositories.locations.listByOrganizationId(
        input.organizationId,
        { limit: input.limit },
      );
      return serviceOk(locations.items);
    }

    if (input.scope === "clientOrganization") {
      const locations =
        await this.repositories.locations.listByClientOrganizationId(
          input.clientOrganizationId,
          { limit: input.limit },
        );
      return serviceOk(locations.items);
    }

    const locations = await Promise.all(
      input.locationIds.slice(0, input.limit).map((locationId) =>
        this.repositories.locations.getById(locationId),
      ),
    );
    return serviceOk(
      locations.filter(
        (location): location is Location => Boolean(location && !location.isDeleted),
      ),
    );
  }

  async getLocation(locationId: EntityId): Promise<ServiceResult<Location>> {
    const location = await this.repositories.locations.getById(locationId);
    if (!location || location.isDeleted) {
      return serviceFail(notFoundError("Location could not be found."));
    }

    return serviceOk(location);
  }

  async createLocation(
    input: CreateLocationInput,
  ): Promise<ServiceResult<Location>> {
    const name = normalizeRequiredText(input.name, "Location name");
    if (!name.ok) {
      return name;
    }

    const client = await this.getClient(input.clientOrganizationId);
    if (!client.ok) {
      return client;
    }

    const primaryContactId = normalizeNullableText(input.primaryContactId);
    const siteContactId = normalizeNullableText(input.siteContactId);
    const linkedContacts = resolveNormalizedLinks({
      requestedLinks: input.linkedContacts ?? [],
      roleSlots: toLocationRoleSlots({
        primaryContactId,
        siteContactId,
      }),
    });
    const locationContactValidation = await validateContactsExist(
      this.repositories.contacts,
      linkedContacts.map((link) => link.contactId),
    );
    if (!locationContactValidation.ok) {
      return locationContactValidation;
    }

    const location: Location = {
      id: this.repositories.locations.newId(),
      ...createAuditFields(input),
      clientOrganizationId: client.value.id,
      name: name.value,
      displayName: normalizeNullableText(input.displayName),
      code: normalizeNullableText(input.code),
      storeNumber: normalizeNullableText(input.storeNumber),
      status: input.status ?? "active",
      primaryContactId,
      siteContactId,
      addressLine1: normalizeNullableText(input.addressLine1),
      addressLine2: normalizeNullableText(input.addressLine2),
      city: normalizeNullableText(input.city),
      region: normalizeNullableText(input.region),
      postalCode: normalizeNullableText(input.postalCode),
      countryCode: normalizeNullableText(input.countryCode),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      timeZone: normalizeNullableText(input.timeZone),
      accessNotes: normalizeNullableText(input.accessNotes),
      serviceNotes: normalizeNullableText(input.serviceNotes),
      notes: normalizeNullableText(input.notes),
    };

    await this.repositories.locations.create(location);
    await this.repositories.locationContactLinks.replaceForLocationId(
      location.id,
      buildLocationContactLinks({
        location,
        linkedContacts,
        roleSlots: toLocationRoleSlots({
          primaryContactId,
          siteContactId,
        }),
        audit: input,
      }),
    );
    return serviceOk(location);
  }

  async updateLocation(
    input: UpdateLocationInput,
  ): Promise<ServiceResult<Location>> {
    const existing = await this.repositories.locations.getById(input.locationId);
    if (!existing || existing.isDeleted) {
      return serviceFail(notFoundError("Location could not be found."));
    }

    const name =
      input.name === undefined
        ? serviceOk(existing.name)
        : normalizeRequiredText(input.name, "Location name");
    if (!name.ok) {
      return name;
    }

    const nextClientOrganizationId =
      input.clientOrganizationId ?? existing.clientOrganizationId;
    const client = await this.getClient(nextClientOrganizationId);
    if (!client.ok) {
      return client;
    }

    if (nextClientOrganizationId !== existing.clientOrganizationId) {
      return serviceFail(
        validationError(
          "Locations cannot be reassigned across client organizations.",
        ),
      );
    }

    const primaryContactId =
      input.primaryContactId === undefined
        ? existing.primaryContactId
        : normalizeNullableText(input.primaryContactId);
    const siteContactId =
      input.siteContactId === undefined
        ? existing.siteContactId
        : normalizeNullableText(input.siteContactId);
    const existingLinks = await this.repositories.locationContactLinks.listByLocationId(
      existing.id,
      { limit: 100 },
    );
    const roleSlots = toLocationRoleSlots({
      primaryContactId: primaryContactId ?? null,
      siteContactId: siteContactId ?? null,
    });
    const linkedContacts = resolveNormalizedLinks({
      existingLinks: existingLinks.items,
      requestedLinks: input.linkedContacts,
      roleSlots,
    });
    const locationContactValidation = await validateContactsExist(
      this.repositories.contacts,
      linkedContacts.map((link) => link.contactId),
    );
    if (!locationContactValidation.ok) {
      return locationContactValidation;
    }

    const updated = touchAuditFields(
      {
        ...existing,
        clientOrganizationId: client.value.id,
        name: name.value,
        displayName:
          input.displayName === undefined
            ? existing.displayName
            : normalizeNullableText(input.displayName),
        code:
          input.code === undefined ? existing.code : normalizeNullableText(input.code),
        storeNumber:
          input.storeNumber === undefined
            ? existing.storeNumber
            : normalizeNullableText(input.storeNumber),
        status: input.status ?? existing.status,
        primaryContactId,
        siteContactId,
        addressLine1:
          input.addressLine1 === undefined
            ? existing.addressLine1
            : normalizeNullableText(input.addressLine1),
        addressLine2:
          input.addressLine2 === undefined
            ? existing.addressLine2
            : normalizeNullableText(input.addressLine2),
        city:
          input.city === undefined ? existing.city : normalizeNullableText(input.city),
        region:
          input.region === undefined
            ? existing.region
            : normalizeNullableText(input.region),
        postalCode:
          input.postalCode === undefined
            ? existing.postalCode
            : normalizeNullableText(input.postalCode),
        countryCode:
          input.countryCode === undefined
            ? existing.countryCode
            : normalizeNullableText(input.countryCode),
        latitude:
          input.latitude === undefined ? existing.latitude : input.latitude ?? null,
        longitude:
          input.longitude === undefined
            ? existing.longitude
            : input.longitude ?? null,
        timeZone:
          input.timeZone === undefined
            ? existing.timeZone
            : normalizeNullableText(input.timeZone),
        accessNotes:
          input.accessNotes === undefined
            ? existing.accessNotes
            : normalizeNullableText(input.accessNotes),
        serviceNotes:
          input.serviceNotes === undefined
            ? existing.serviceNotes
            : normalizeNullableText(input.serviceNotes),
        notes:
          input.notes === undefined ? existing.notes : normalizeNullableText(input.notes),
      },
      input,
    );

    await this.repositories.locations.save(updated);
    await this.repositories.locationContactLinks.replaceForLocationId(
      updated.id,
      buildLocationContactLinks({
        location: updated,
        linkedContacts,
        roleSlots,
        audit: input,
      }),
    );
    return serviceOk(updated);
  }

  async archiveLocation(
    input: ArchiveLocationInput,
  ): Promise<ServiceResult<Location>> {
    const existing = await this.repositories.locations.getById(input.locationId);
    if (!existing || existing.isDeleted) {
      return serviceFail(notFoundError("Location could not be found."));
    }

    const workOrders = await this.repositories.workOrders.listByLocationId(
      existing.id,
      { limit: 1 },
    );
    if (workOrders.items.length > 0) {
      return serviceFail(
        conflictError("Locations with work orders cannot be archived."),
      );
    }

    const archivedAt = input.now ?? new Date().toISOString();
    const archived = touchAuditFields(
      {
        ...existing,
        recordStatus: "archived" as const,
        isDeleted: true,
        deletedAt: archivedAt,
        deletedByUserId: input.actor.userId,
      },
      { ...input, now: archivedAt },
    );

    await this.repositories.locations.save(archived);
    return serviceOk(archived);
  }

  async getClientLocationContext(
    input: ClientLocationContextInput,
  ): Promise<ServiceResult<ClientLocationContext>> {
    if (
      !input.organizationId.trim() ||
      !input.clientOrganizationId.trim() ||
      !input.locationId.trim()
    ) {
      return serviceFail(
        validationError("Organization, client organization, and location are required."),
      );
    }

    const [clientResult, locationResult] = await Promise.all([
      this.getClient(input.clientOrganizationId),
      this.getLocation(input.locationId),
    ]);

    if (!clientResult.ok) {
      return clientResult;
    }

    if (!locationResult.ok) {
      return locationResult;
    }

    if (clientResult.value.organizationId !== input.organizationId) {
      return serviceFail(
        notFoundError("Client organization could not be found."),
      );
    }

    if (locationResult.value.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Location could not be found."));
    }

    if (clientResult.value.organizationId !== locationResult.value.organizationId) {
      return serviceFail(
        validationError(
          "Selected client organization and location must belong to the same organization.",
        ),
      );
    }

    try {
      assertValidWorkOrderLocationSelection({
        clientOrganization: clientResult.value,
        location: locationResult.value,
      });
    } catch (error) {
      return serviceFail(
        error instanceof AppError
          ? error
          : validationError("Client organization and location must both be valid."),
      );
    }

    return serviceOk({ client: clientResult.value, location: locationResult.value });
  }
}

function normalizeRequiredText(
  value: string,
  label: string,
): ServiceResult<string> {
  const normalized = value.trim();
  if (!normalized) {
    return serviceFail(validationError(`${label} is required.`));
  }

  return serviceOk(normalized);
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function validateContactsExist(
  repository: Pick<FirestoreRepositories, "contacts">["contacts"],
  contactIds: Array<EntityId | null | undefined>,
): Promise<ServiceResult<void>> {
  const normalizedIds = [...new Set(contactIds.filter(Boolean).map((contactId) => contactId!.trim()))];
  if (normalizedIds.length === 0) {
    return serviceOk(undefined);
  }

  const contacts = await repository.listByIds(normalizedIds);
  const foundIds = new Set(contacts.items.map((contact) => contact.id));
  const missingId = normalizedIds.find((contactId) => !foundIds.has(contactId));
  if (missingId) {
    return serviceFail(validationError(`Contact ${missingId} could not be found.`));
  }

  return serviceOk(undefined);
}

function buildClientOrganizationContactLinks(input: {
  client: ClientOrganization;
  linkedContacts: ContactLinkInput[];
  roleSlots: ContactRoleSlotAssignment<"primaryContactId" | "billingContactId">[];
  audit: ServiceAuditContext;
}): ClientOrganizationContactLink[] {
  return input.linkedContacts.map((link) => ({
    id: `${input.client.id}:${link.contactId}`,
    ...createAuditFields({
      ...input.audit,
      organizationId: input.client.organizationId,
    }),
    clientOrganizationId: input.client.id,
    contactId: link.contactId,
    relationshipType: link.relationshipType,
    isPrimary: isContactAssignedToPrimaryRole(link.contactId, input.roleSlots),
    notes: normalizeNullableText(link.notes),
  }));
}

function buildLocationContactLinks(input: {
  location: Location;
  linkedContacts: ContactLinkInput[];
  roleSlots: ContactRoleSlotAssignment<"primaryContactId" | "siteContactId">[];
  audit: ServiceAuditContext;
}): LocationContactLink[] {
  return input.linkedContacts.map((link) => ({
    id: `${input.location.id}:${link.contactId}`,
    ...createAuditFields({
      ...input.audit,
      organizationId: input.location.organizationId,
    }),
    locationId: input.location.id,
    contactId: link.contactId,
    relationshipType: link.relationshipType,
    isPrimary: isContactAssignedToPrimaryRole(link.contactId, input.roleSlots),
    notes: normalizeNullableText(link.notes),
  }));
}

function resolveNormalizedLinks(input: {
  existingLinks?: Array<
    Pick<ClientOrganizationContactLink, "contactId" | "relationshipType" | "notes"> |
      Pick<LocationContactLink, "contactId" | "relationshipType" | "notes">
  >;
  requestedLinks?: ContactLinkInput[];
  roleSlots: readonly ContactRoleSlotAssignment<string>[];
}): ContactLinkInput[] {
  const baseLinks =
    input.requestedLinks ??
    input.existingLinks?.map((link) => ({
      contactId: link.contactId,
      relationshipType: link.relationshipType,
      notes: link.notes,
    })) ??
    [];

  return ensureRoleSlotContactsAreLinked(baseLinks, input.roleSlots);
}

function toClientRoleSlots(input: {
  primaryContactId: EntityId | null;
  billingContactId: EntityId | null;
}): ContactRoleSlotAssignment<"primaryContactId" | "billingContactId">[] {
  return [
    {
      key: "primaryContactId",
      label: "Primary",
      relationshipType: "primary",
      contactId: input.primaryContactId,
      isPrimary: true,
    },
    {
      key: "billingContactId",
      label: "Billing",
      relationshipType: "billing",
      contactId: input.billingContactId,
    },
  ];
}

function toLocationRoleSlots(input: {
  primaryContactId: EntityId | null;
  siteContactId: EntityId | null;
}): ContactRoleSlotAssignment<"primaryContactId" | "siteContactId">[] {
  return [
    {
      key: "primaryContactId",
      label: "Primary",
      relationshipType: "primary",
      contactId: input.primaryContactId,
      isPrimary: true,
    },
    {
      key: "siteContactId",
      label: "Site",
      relationshipType: "site",
      contactId: input.siteContactId,
    },
  ];
}
