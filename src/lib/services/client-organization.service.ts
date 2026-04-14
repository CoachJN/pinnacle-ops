import "server-only";

import { clientOrganizationPolicy } from "@/lib/access-policy";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import {
  createClientOrganizationRepository,
  type ClientOrganizationListFilters,
  type ClientOrganizationRepository,
} from "@/lib/repositories/client-organization.repository";
import { notFoundError } from "@/server/services/errors";
import {
  serviceFail,
  serviceOk,
  type ServiceResult,
} from "@/server/services/types";
import type { AccessActor } from "@/types/auth";
import type { ClientOrganization } from "@/types/client-organization";
import type { EntityId } from "@/types/entity";

export interface ListClientOrganizationsInput {
  actor: AccessActor;
  filters?: Pick<ClientOrganizationListFilters, "status" | "search" | "limit">;
}

export interface GetClientOrganizationDetailInput {
  actor: AccessActor;
  clientOrganizationId: EntityId;
}

export interface ClientOrganizationService {
  listOrganizations(
    input: ListClientOrganizationsInput,
  ): Promise<ServiceResult<ClientOrganization[]>>;
  getOrganizationDetail(
    input: GetClientOrganizationDetailInput,
  ): Promise<ServiceResult<ClientOrganization>>;
}

export function createClientOrganizationService(
  repository: ClientOrganizationRepository = createClientOrganizationRepository(),
): ClientOrganizationService {
  return new DefaultClientOrganizationService(repository);
}

class DefaultClientOrganizationService implements ClientOrganizationService {
  constructor(private readonly repository: ClientOrganizationRepository) {}

  async listOrganizations(
    input: ListClientOrganizationsInput,
  ): Promise<ServiceResult<ClientOrganization[]>> {
    if (!canReadClientOrganizations(input.actor)) {
      return serviceFail(forbiddenError());
    }

    if (input.actor.actorType === "client") {
      const organization = await this.repository.getById(
        input.actor.scope.clientOrganizationId,
      );

      if (
        !organization ||
        !clientOrganizationPolicy.canRead(input.actor, organization)
      ) {
        return serviceOk([]);
      }

      return serviceOk(filterOrganizations([organization], input.filters));
    }

    const organizations = await this.repository.list({
      organizationId: input.actor.scope.organizationId,
      ...input.filters,
    });

    return serviceOk(
      filterOrganizations(
        organizations.filter((organization) =>
          clientOrganizationPolicy.canRead(input.actor, organization),
        ),
        input.filters,
      ),
    );
  }

  async getOrganizationDetail(
    input: GetClientOrganizationDetailInput,
  ): Promise<ServiceResult<ClientOrganization>> {
    const organization = await this.repository.getById(input.clientOrganizationId);
    if (
      !organization ||
      organization.isDeleted ||
      organization.organizationId !== input.actor.scope.organizationId
    ) {
      return serviceFail(notFoundError("Client organization could not be found."));
    }

    if (!clientOrganizationPolicy.canRead(input.actor, organization)) {
      return serviceFail(forbiddenError());
    }

    return serviceOk(organization);
  }
}

function canReadClientOrganizations(actor: AccessActor): boolean {
  return actor.actorType === "internal" || actor.actorType === "client";
}

function filterOrganizations(
  organizations: ClientOrganization[],
  filters: ListClientOrganizationsInput["filters"],
): ClientOrganization[] {
  const normalizedSearch = filters?.search?.trim().toLowerCase();

  return organizations
    .filter((organization) =>
      filters?.status ? organization.status === filters.status : true,
    )
    .filter((organization) =>
      normalizedSearch
        ? [organization.name, organization.displayName]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(normalizedSearch))
        : true,
    )
    .slice(0, filters?.limit);
}

function forbiddenError(
  message = "You do not have access to client organizations.",
): AppError {
  return new AppError({
    code: ERROR_CODES.Forbidden,
    message,
    safeMessage: message,
  });
}
