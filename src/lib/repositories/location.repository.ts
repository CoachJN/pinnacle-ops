import "server-only";

import {
  createFirestoreRepositories,
  type FirestoreRepositories,
  type Location as FirestoreLocation,
} from "@/server/repositories";
import type { ClientOrganization } from "@/types/client-organization";
import type {
  CreateLocationSchemaOutput,
  UpdateLocationSchemaOutput,
} from "@/lib/validation/locations";
import type { Location, LocationStatus } from "@/types/location";
import type { EntityId, IsoDateTimeString, RecordStatus } from "@/types/entity";

export interface RepositoryMutationContext {
  organizationId: EntityId;
  actorUserId: EntityId;
  now?: IsoDateTimeString;
}

export interface LocationListFilters {
  organizationId?: EntityId;
  clientOrganizationId?: EntityId;
  locationIds?: EntityId[];
  status?: LocationStatus;
  recordStatus?: RecordStatus;
  search?: string;
  limit?: number;
}

export interface CreateLocationRepositoryInput extends RepositoryMutationContext {
  data: CreateLocationSchemaOutput;
  clientOrganization: Pick<ClientOrganization, "id">;
}

export interface UpdateLocationRepositoryInput extends RepositoryMutationContext {
  locationId: EntityId;
  data: UpdateLocationSchemaOutput;
  clientOrganization?: Pick<ClientOrganization, "id">;
}

export interface SetLocationActiveStateInput extends RepositoryMutationContext {
  locationId: EntityId;
  isActive: boolean;
}

export interface LocationRepository {
  create(input: CreateLocationRepositoryInput): Promise<Location>;
  update(input: UpdateLocationRepositoryInput): Promise<Location | null>;
  getById(id: EntityId): Promise<Location | null>;
  list(filters?: LocationListFilters): Promise<Location[]>;
  listByClientOrganizationId(
    clientOrganizationId: EntityId,
    filters?: Omit<LocationListFilters, "clientOrganizationId">,
  ): Promise<Location[]>;
  setActiveState(input: SetLocationActiveStateInput): Promise<Location | null>;
  verifyBelongsToOrganization(
    locationId: EntityId,
    clientOrganizationId: EntityId,
  ): Promise<boolean>;
}

export function createLocationRepository(
  repositories: Pick<FirestoreRepositories, "locations"> =
    createFirestoreRepositories(),
): LocationRepository {
  return new FirestoreLocationRepository(repositories.locations);
}

class FirestoreLocationRepository implements LocationRepository {
  constructor(
    private readonly repository: Pick<FirestoreRepositories, "locations">["locations"],
  ) {}

  async create(input: CreateLocationRepositoryInput): Promise<Location> {
    const timestamp = input.now ?? new Date().toISOString();
    const entity: FirestoreLocation = {
      id: this.repository.newId(),
      organizationId: input.organizationId,
      recordStatus: "active",
      isDeleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
      deletedAt: null,
      deletedByUserId: null,
      clientOrganizationId: input.clientOrganization.id,
      name: input.data.name,
      displayName: input.data.displayName ?? null,
      code: input.data.code ?? null,
      storeNumber: input.data.storeNumber ?? null,
      status: input.data.status ?? "active",
      primaryContactId: input.data.primaryContactId ?? null,
      siteContactId: input.data.siteContactId ?? null,
      addressLine1: input.data.addressLine1 ?? null,
      addressLine2: input.data.addressLine2 ?? null,
      city: input.data.city ?? null,
      region: input.data.region ?? null,
      postalCode: input.data.postalCode ?? null,
      countryCode: input.data.countryCode ?? null,
      latitude: input.data.latitude ?? null,
      longitude: input.data.longitude ?? null,
      timeZone: input.data.timeZone ?? null,
      accessNotes: input.data.accessNotes ?? null,
      serviceNotes: input.data.serviceNotes ?? null,
      notes: input.data.notes ?? null,
    };

    await this.repository.create(entity);
    return mapLocation(entity);
  }

  async update(input: UpdateLocationRepositoryInput): Promise<Location | null> {
    const existing = await this.repository.getById(input.locationId);
    if (!existing) {
      return null;
    }

    const entity: FirestoreLocation = {
      ...existing,
      updatedAt: input.now ?? new Date().toISOString(),
      updatedByUserId: input.actorUserId,
      clientOrganizationId:
        input.clientOrganization?.id ?? existing.clientOrganizationId,
      name: input.data.name ?? existing.name,
      displayName:
        input.data.displayName === undefined
          ? existing.displayName
          : input.data.displayName ?? null,
      code: input.data.code === undefined ? existing.code : input.data.code ?? null,
      storeNumber:
        input.data.storeNumber === undefined
          ? existing.storeNumber
          : input.data.storeNumber ?? null,
      status: input.data.status ?? existing.status,
      primaryContactId:
        input.data.primaryContactId === undefined
          ? existing.primaryContactId
          : input.data.primaryContactId ?? null,
      siteContactId:
        input.data.siteContactId === undefined
          ? existing.siteContactId
          : input.data.siteContactId ?? null,
      addressLine1:
        input.data.addressLine1 === undefined
          ? existing.addressLine1
          : input.data.addressLine1 ?? null,
      addressLine2:
        input.data.addressLine2 === undefined
          ? existing.addressLine2
          : input.data.addressLine2 ?? null,
      city: input.data.city === undefined ? existing.city : input.data.city ?? null,
      region:
        input.data.region === undefined ? existing.region : input.data.region ?? null,
      postalCode:
        input.data.postalCode === undefined
          ? existing.postalCode
          : input.data.postalCode ?? null,
      countryCode:
        input.data.countryCode === undefined
          ? existing.countryCode
          : input.data.countryCode ?? null,
      latitude:
        input.data.latitude === undefined
          ? existing.latitude
          : input.data.latitude ?? null,
      longitude:
        input.data.longitude === undefined
          ? existing.longitude
          : input.data.longitude ?? null,
      timeZone:
        input.data.timeZone === undefined
          ? existing.timeZone
          : input.data.timeZone ?? null,
      accessNotes:
        input.data.accessNotes === undefined
          ? existing.accessNotes
          : input.data.accessNotes ?? null,
      serviceNotes:
        input.data.serviceNotes === undefined
          ? existing.serviceNotes
          : input.data.serviceNotes ?? null,
      notes:
        input.data.notes === undefined ? existing.notes : input.data.notes ?? null,
    };

    await this.repository.save(entity);
    return mapLocation(entity);
  }

  async getById(id: EntityId): Promise<Location | null> {
    const entity = await this.repository.getById(id);
    if (!entity) {
      return null;
    }

    return mapLocation(entity);
  }

  async list(filters: LocationListFilters = {}): Promise<Location[]> {
    const entities = filters.locationIds?.length
      ? await this.listByIds(filters.locationIds)
      : filters.clientOrganizationId
        ? (
            await this.repository.listByClientOrganizationId(
              filters.clientOrganizationId,
              { limit: filters.limit },
            )
          ).items
        : filters.organizationId
          ? (
              await this.repository.listByOrganizationId(filters.organizationId, {
                limit: filters.limit,
              })
            ).items
          : [];

    return applyLocationFilters(entities.map(mapLocation), filters);
  }

  async listByClientOrganizationId(
    clientOrganizationId: EntityId,
    filters: Omit<LocationListFilters, "clientOrganizationId"> = {},
  ): Promise<Location[]> {
    return this.list({ ...filters, clientOrganizationId });
  }

  async setActiveState(
    input: SetLocationActiveStateInput,
  ): Promise<Location | null> {
    const existing = await this.repository.getById(input.locationId);
    if (!existing) {
      return null;
    }

    const entity: FirestoreLocation = {
      ...existing,
      status: input.isActive ? "active" : "inactive",
      updatedAt: input.now ?? new Date().toISOString(),
      updatedByUserId: input.actorUserId,
    };

    await this.repository.save(entity);
    return mapLocation(entity);
  }

  async verifyBelongsToOrganization(
    locationId: EntityId,
    clientOrganizationId: EntityId,
  ): Promise<boolean> {
    const location = await this.getById(locationId);
    return Boolean(
      location &&
        !location.isDeleted &&
        location.recordStatus === "active" &&
        location.clientOrganizationId === clientOrganizationId,
    );
  }

  private async listByIds(ids: EntityId[]): Promise<FirestoreLocation[]> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const results = await Promise.all(
      uniqueIds.map((id) => this.repository.getById(id)),
    );

    return results.filter((entity): entity is FirestoreLocation => entity !== null);
  }
}

function mapLocation(entity: FirestoreLocation): Location {
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
    displayName: entity.displayName ?? undefined,
    code: entity.code ?? undefined,
    storeNumber: entity.storeNumber ?? undefined,
    status: entity.status,
    primaryContactId: entity.primaryContactId ?? undefined,
    siteContactId: entity.siteContactId ?? undefined,
    addressLine1: entity.addressLine1 ?? undefined,
    addressLine2: entity.addressLine2 ?? undefined,
    city: entity.city ?? undefined,
    region: entity.region ?? undefined,
    postalCode: entity.postalCode ?? undefined,
    countryCode: entity.countryCode ?? undefined,
    latitude: entity.latitude ?? undefined,
    longitude: entity.longitude ?? undefined,
    timeZone: entity.timeZone ?? undefined,
    accessNotes: entity.accessNotes ?? undefined,
    serviceNotes: entity.serviceNotes ?? undefined,
    notes: entity.notes ?? undefined,
  };
}

function applyLocationFilters(
  locations: Location[],
  filters: LocationListFilters,
): Location[] {
  const normalizedSearch = filters.search?.trim().toLowerCase();

  return locations
    .filter((location) =>
      filters.recordStatus ? location.recordStatus === filters.recordStatus : true,
    )
    .filter((location) =>
      filters.status ? location.status === filters.status : true,
    )
    .filter((location) =>
      normalizedSearch
        ? [
            location.name,
            location.displayName,
            location.code,
            location.storeNumber,
            location.addressLine1,
            location.city,
            location.region,
          ]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(normalizedSearch))
        : true,
    )
    .slice(0, filters.limit);
}
