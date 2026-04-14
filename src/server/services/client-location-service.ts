import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { assertValidWorkOrderLocationSelection } from "@/lib/permissions/work-orders";
import type {
  ClientOrganization,
  FirestoreOrganizationStatus,
  FirestoreRepositories,
  Location,
} from "@/server/repositories";
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
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  billingEmail?: string | null;
  notes?: string | null;
}

export interface UpdateClientOrganizationInput extends ServiceAuditContext {
  clientOrganizationId: EntityId;
  name?: string;
  displayName?: string | null;
  status?: FirestoreOrganizationStatus;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  billingEmail?: string | null;
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
  code?: string | null;
  status?: FirestoreOrganizationStatus;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  locationContactName?: string | null;
  locationContactEmail?: string | null;
  locationContactPhone?: string | null;
  accessNotes?: string | null;
  notes?: string | null;
}

export interface UpdateLocationInput extends ServiceAuditContext {
  locationId: EntityId;
  clientOrganizationId?: EntityId;
  name?: string;
  code?: string | null;
  status?: FirestoreOrganizationStatus;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  locationContactName?: string | null;
  locationContactEmail?: string | null;
  locationContactPhone?: string | null;
  accessNotes?: string | null;
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
    "clientOrganizations" | "locations" | "workOrders"
  >,
): ClientLocationService {
  return new FirestoreClientLocationService(repositories);
}

class FirestoreClientLocationService implements ClientLocationService {
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      "clientOrganizations" | "locations" | "workOrders"
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

    const client: ClientOrganization = {
      id: this.repositories.clientOrganizations.newId(),
      ...createAuditFields(input),
      name: name.value,
      displayName: normalizeNullableText(input.displayName),
      status: input.status ?? "active",
      primaryContactName: normalizeNullableText(input.primaryContactName),
      primaryContactEmail: normalizeNullableText(input.primaryContactEmail),
      primaryContactPhone: normalizeNullableText(input.primaryContactPhone),
      billingEmail: normalizeNullableText(input.billingEmail),
      notes: normalizeNullableText(input.notes),
    };

    await this.repositories.clientOrganizations.create(client);
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

    const updated = touchAuditFields(
      {
        ...existing,
        name: name.value,
        displayName:
          input.displayName === undefined
            ? existing.displayName
            : normalizeNullableText(input.displayName),
        status: input.status ?? existing.status,
        primaryContactName:
          input.primaryContactName === undefined
            ? existing.primaryContactName
            : normalizeNullableText(input.primaryContactName),
        primaryContactEmail:
          input.primaryContactEmail === undefined
            ? existing.primaryContactEmail
            : normalizeNullableText(input.primaryContactEmail),
        primaryContactPhone:
          input.primaryContactPhone === undefined
            ? existing.primaryContactPhone
            : normalizeNullableText(input.primaryContactPhone),
        billingEmail:
          input.billingEmail === undefined
            ? existing.billingEmail
            : normalizeNullableText(input.billingEmail),
        notes:
          input.notes === undefined
            ? existing.notes
            : normalizeNullableText(input.notes),
      },
      input,
    );

    await this.repositories.clientOrganizations.save(updated);
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

    const location: Location = {
      id: this.repositories.locations.newId(),
      ...createAuditFields(input),
      clientOrganizationId: client.value.id,
      clientSnapshot: {
        id: client.value.id,
        name: client.value.displayName ?? client.value.name,
      },
      name: name.value,
      code: normalizeNullableText(input.code),
      status: input.status ?? "active",
      addressLine1: normalizeNullableText(input.addressLine1),
      addressLine2: normalizeNullableText(input.addressLine2),
      city: normalizeNullableText(input.city),
      region: normalizeNullableText(input.region),
      postalCode: normalizeNullableText(input.postalCode),
      countryCode: normalizeNullableText(input.countryCode),
      locationContactName: normalizeNullableText(input.locationContactName),
      locationContactEmail: normalizeNullableText(input.locationContactEmail),
      locationContactPhone: normalizeNullableText(input.locationContactPhone),
      accessNotes: normalizeNullableText(input.accessNotes),
      notes: normalizeNullableText(input.notes),
    };

    await this.repositories.locations.create(location);
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

    const updated = touchAuditFields(
      {
        ...existing,
        clientOrganizationId: client.value.id,
        clientSnapshot: {
          id: client.value.id,
          name: client.value.displayName ?? client.value.name,
        },
        name: name.value,
        code:
          input.code === undefined ? existing.code : normalizeNullableText(input.code),
        status: input.status ?? existing.status,
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
        locationContactName:
          input.locationContactName === undefined
            ? existing.locationContactName
            : normalizeNullableText(input.locationContactName),
        locationContactEmail:
          input.locationContactEmail === undefined
            ? existing.locationContactEmail
            : normalizeNullableText(input.locationContactEmail),
        locationContactPhone:
          input.locationContactPhone === undefined
            ? existing.locationContactPhone
            : normalizeNullableText(input.locationContactPhone),
        accessNotes:
          input.accessNotes === undefined
            ? existing.accessNotes
            : normalizeNullableText(input.accessNotes),
        notes:
          input.notes === undefined ? existing.notes : normalizeNullableText(input.notes),
      },
      input,
    );

    await this.repositories.locations.save(updated);
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
