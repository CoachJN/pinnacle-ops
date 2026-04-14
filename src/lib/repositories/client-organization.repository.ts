import "server-only";

import {
  createFirestoreRepositories,
  type ClientOrganization as FirestoreClientOrganization,
  type FirestoreRepositories,
} from "@/server/repositories";
import type {
  ClientOrganization,
  ClientOrganizationStatus,
} from "@/types/client-organization";
import type { EntityId, RecordStatus } from "@/types/entity";

export interface ClientOrganizationSelector {
  id: EntityId;
  name: string;
  displayName?: string;
  status: ClientOrganizationStatus;
}

export interface ClientOrganizationListFilters {
  organizationId?: EntityId;
  ids?: EntityId[];
  status?: ClientOrganizationStatus;
  recordStatus?: RecordStatus;
  search?: string;
  limit?: number;
}

export interface ClientOrganizationRepository {
  getById(id: EntityId): Promise<ClientOrganization | null>;
  list(filters?: ClientOrganizationListFilters): Promise<ClientOrganization[]>;
  exists(id: EntityId): Promise<boolean>;
  isActive(id: EntityId): Promise<boolean>;
  listSelectors(
    filters?: ClientOrganizationListFilters,
  ): Promise<ClientOrganizationSelector[]>;
}

export function createClientOrganizationRepository(
  repositories: Pick<FirestoreRepositories, "clientOrganizations"> =
    createFirestoreRepositories(),
): ClientOrganizationRepository {
  return new FirestoreClientOrganizationRepository(
    repositories.clientOrganizations,
  );
}

class FirestoreClientOrganizationRepository
  implements ClientOrganizationRepository
{
  constructor(
    private readonly repository: Pick<
      FirestoreRepositories,
      "clientOrganizations"
    >["clientOrganizations"],
  ) {}

  async getById(id: EntityId): Promise<ClientOrganization | null> {
    const entity = await this.repository.getById(id);
    if (!entity) {
      return null;
    }

    return mapClientOrganization(entity);
  }

  async list(
    filters: ClientOrganizationListFilters = {},
  ): Promise<ClientOrganization[]> {
    const entities = filters.ids?.length
      ? await this.listByIds(filters.ids)
      : filters.organizationId
        ? (
            await this.repository.listByOrganizationId(filters.organizationId, {
              limit: filters.limit,
            })
          ).items
        : [];

    return applyClientOrganizationFilters(
      entities.map(mapClientOrganization),
      filters,
    );
  }

  async exists(id: EntityId): Promise<boolean> {
    const entity = await this.getById(id);
    return Boolean(entity && !entity.isDeleted);
  }

  async isActive(id: EntityId): Promise<boolean> {
    const entity = await this.getById(id);
    return Boolean(
      entity &&
        !entity.isDeleted &&
        entity.recordStatus === "active" &&
        entity.status === "active",
    );
  }

  async listSelectors(
    filters: ClientOrganizationListFilters = {},
  ): Promise<ClientOrganizationSelector[]> {
    const organizations = await this.list(filters);

    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      displayName: organization.displayName,
      status: organization.status,
    }));
  }

  private async listByIds(ids: EntityId[]): Promise<FirestoreClientOrganization[]> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const results = await Promise.all(
      uniqueIds.map((id) => this.repository.getById(id)),
    );

    return results.filter(
      (
        entity,
      ): entity is FirestoreClientOrganization => entity !== null,
    );
  }
}

function mapClientOrganization(
  entity: FirestoreClientOrganization,
): ClientOrganization {
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
    primaryContactName: entity.primaryContactName ?? undefined,
    primaryContactEmail: entity.primaryContactEmail ?? undefined,
    primaryContactPhone: entity.primaryContactPhone ?? undefined,
    billingEmail: entity.billingEmail ?? undefined,
    notes: entity.notes ?? undefined,
  };
}

function applyClientOrganizationFilters(
  organizations: ClientOrganization[],
  filters: ClientOrganizationListFilters,
): ClientOrganization[] {
  const normalizedSearch = filters.search?.trim().toLowerCase();

  return organizations
    .filter((organization) =>
      filters.recordStatus ? organization.recordStatus === filters.recordStatus : true,
    )
    .filter((organization) =>
      filters.status ? organization.status === filters.status : true,
    )
    .filter((organization) =>
      normalizedSearch
        ? [organization.name, organization.displayName]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(normalizedSearch))
        : true,
    )
    .slice(0, filters.limit);
}
