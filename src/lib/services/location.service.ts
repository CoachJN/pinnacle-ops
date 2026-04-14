import "server-only";

import { clientOrganizationPolicy, locationPolicy } from "@/lib/access-policy";
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
  createLocationSchema,
  locationQueryFiltersSchema,
  updateLocationSchema,
  type LocationQueryFiltersSchemaOutput,
} from "@/lib/validation/locations";
import { notFoundError, validationError } from "@/server/services/errors";
import {
  serviceFail,
  serviceOk,
  type ServiceResult,
} from "@/server/services/types";
import {
  assertLocationOwnershipUnchanged,
  getScopedLocationClientOrganizationId,
} from "@/lib/permissions/locations";
import { assertValidWorkOrderLocationSelection } from "@/lib/permissions/work-orders";
import type { AccessActor } from "@/types/auth";
import type { ClientOrganization } from "@/types/client-organization";
import type { EntityId } from "@/types/entity";
import type { Location } from "@/types/location";

export interface CreateLocationInput {
  actor: AccessActor;
  payload: unknown;
}

export interface UpdateLocationInput {
  actor: AccessActor;
  locationId: EntityId;
  payload: unknown;
}

export interface GetLocationDetailInput {
  actor: AccessActor;
  locationId: EntityId;
}

export interface ListLocationsInput {
  actor: AccessActor;
  filters?: unknown;
}

export interface ListLocationsByOrganizationInput {
  actor: AccessActor;
  clientOrganizationId: EntityId;
  filters?: unknown;
}

export interface SetLocationActiveStateInput {
  actor: AccessActor;
  locationId: EntityId;
  isActive: boolean;
}

export interface ValidateWorkOrderLocationLinkageInput {
  actor: AccessActor;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}

export interface ValidatedWorkOrderLocationLinkage {
  clientOrganization: ClientOrganization;
  location: Location;
}

export interface LocationService {
  createLocation(input: CreateLocationInput): Promise<ServiceResult<Location>>;
  updateLocation(input: UpdateLocationInput): Promise<ServiceResult<Location>>;
  getLocationDetail(
    input: GetLocationDetailInput,
  ): Promise<ServiceResult<Location>>;
  listLocations(input: ListLocationsInput): Promise<ServiceResult<Location[]>>;
  listLocationsByClientOrganization(
    input: ListLocationsByOrganizationInput,
  ): Promise<ServiceResult<Location[]>>;
  setLocationActiveState(
    input: SetLocationActiveStateInput,
  ): Promise<ServiceResult<Location>>;
  deactivateLocation(
    input: Omit<SetLocationActiveStateInput, "isActive">,
  ): Promise<ServiceResult<Location>>;
  validateWorkOrderLocationLinkage(
    input: ValidateWorkOrderLocationLinkageInput,
  ): Promise<ServiceResult<ValidatedWorkOrderLocationLinkage>>;
}

export function createLocationService(
  dependencies: {
    clientOrganizations?: ClientOrganizationRepository;
    locations?: LocationRepository;
  } = {},
): LocationService {
  return new DefaultLocationService({
    clientOrganizations:
      dependencies.clientOrganizations ?? createClientOrganizationRepository(),
    locations: dependencies.locations ?? createLocationRepository(),
  });
}

class DefaultLocationService implements LocationService {
  constructor(
    private readonly dependencies: {
      clientOrganizations: ClientOrganizationRepository;
      locations: LocationRepository;
    },
  ) {}

  async createLocation(
    input: CreateLocationInput,
  ): Promise<ServiceResult<Location>> {
    const parsed = parseSchema(createLocationSchema, input.payload);
    if (!parsed.ok) {
      return parsed;
    }

    let scopedClientOrganizationId: EntityId;
    try {
      scopedClientOrganizationId = getScopedLocationClientOrganizationId(
        input.actor,
        parsed.value.clientOrganizationId,
      );
    } catch (error) {
      return serviceFail(
        error instanceof AppError ? error : forbiddenError(),
      );
    }

    if (
      !locationPolicy.canCreate(input.actor, {
        organizationId: input.actor.scope.organizationId,
        clientOrganizationId: scopedClientOrganizationId,
      })
    ) {
      return serviceFail(forbiddenError());
    }

    const clientOrganizationResult = await this.requireClientOrganizationForMutation(
      input.actor,
      scopedClientOrganizationId,
    );
    if (!clientOrganizationResult.ok) {
      return clientOrganizationResult;
    }

    const location = await this.dependencies.locations.create({
      organizationId: input.actor.scope.organizationId,
      actorUserId: input.actor.userId,
      data: {
        ...parsed.value,
        clientOrganizationId: scopedClientOrganizationId,
      },
      clientOrganization: clientOrganizationResult.value,
    });

    return serviceOk(location);
  }

  async updateLocation(
    input: UpdateLocationInput,
  ): Promise<ServiceResult<Location>> {
    const existing = await this.dependencies.locations.getById(input.locationId);
    if (
      !existing ||
      existing.isDeleted ||
      existing.organizationId !== input.actor.scope.organizationId
    ) {
      return serviceFail(notFoundError("Location could not be found."));
    }

    if (!locationPolicy.canUpdate(input.actor, existing)) {
      return serviceFail(forbiddenError());
    }

    const parsed = parseSchema(updateLocationSchema, input.payload);
    if (!parsed.ok) {
      return parsed;
    }

    if (parsed.value.status !== undefined) {
      return serviceFail(
        validationError(
          "Location status changes must use the activation/deactivation service method.",
        ),
      );
    }

    try {
      assertLocationOwnershipUnchanged(existing, parsed.value.clientOrganizationId);
    } catch (error) {
      return serviceFail(
        error instanceof AppError
          ? error
          : validationError("Locations cannot be reassigned across client organizations."),
      );
    }

    const updated = await this.dependencies.locations.update({
      organizationId: input.actor.scope.organizationId,
      actorUserId: input.actor.userId,
      locationId: input.locationId,
      data: parsed.value,
    });

    if (!updated) {
      return serviceFail(notFoundError("Location could not be found."));
    }

    return serviceOk(updated);
  }

  async getLocationDetail(
    input: GetLocationDetailInput,
  ): Promise<ServiceResult<Location>> {
    const location = await this.dependencies.locations.getById(input.locationId);
    if (
      !location ||
      location.isDeleted ||
      location.organizationId !== input.actor.scope.organizationId
    ) {
      return serviceFail(notFoundError("Location could not be found."));
    }

    if (!locationPolicy.canRead(input.actor, location)) {
      return serviceFail(forbiddenError("You do not have access to this location."));
    }

    return serviceOk(location);
  }

  async listLocations(
    input: ListLocationsInput,
  ): Promise<ServiceResult<Location[]>> {
    const parsed = parseSchema(locationQueryFiltersSchema, input.filters ?? {});
    if (!parsed.ok) {
      return parsed;
    }

    const scopedFilters = this.getScopedLocationFilters(input.actor, parsed.value);
    if (!scopedFilters.ok) {
      return scopedFilters;
    }

    const locations = await this.dependencies.locations.list(scopedFilters.value);

    return serviceOk(
      locations.filter((location) => locationPolicy.canRead(input.actor, location)),
    );
  }

  async listLocationsByClientOrganization(
    input: ListLocationsByOrganizationInput,
  ): Promise<ServiceResult<Location[]>> {
    const parsed = parseSchema(locationQueryFiltersSchema, input.filters ?? {});
    if (!parsed.ok) {
      return parsed;
    }

    if (
      parsed.value.clientOrganizationId &&
      parsed.value.clientOrganizationId !== input.clientOrganizationId
    ) {
      return serviceFail(
        validationError(
          "Location listing filters must match the requested client organization.",
        ),
      );
    }

    const scopedFilters = this.getScopedLocationFilters(input.actor, {
      ...parsed.value,
      clientOrganizationId: input.clientOrganizationId,
    });
    if (!scopedFilters.ok) {
      return scopedFilters;
    }

    const locations = await this.dependencies.locations.listByClientOrganizationId(
      input.clientOrganizationId,
      scopedFilters.value,
    );

    return serviceOk(
      locations.filter((location) => locationPolicy.canRead(input.actor, location)),
    );
  }

  async setLocationActiveState(
    input: SetLocationActiveStateInput,
  ): Promise<ServiceResult<Location>> {
    const existing = await this.dependencies.locations.getById(input.locationId);
    if (
      !existing ||
      existing.isDeleted ||
      existing.organizationId !== input.actor.scope.organizationId
    ) {
      return serviceFail(notFoundError("Location could not be found."));
    }

    if (!locationPolicy.canTransition(input.actor, existing)) {
      return serviceFail(
        forbiddenError("You do not have access to change location status."),
      );
    }

    if (input.isActive) {
      const clientOrganization = await this.dependencies.clientOrganizations.getById(
        existing.clientOrganizationId,
      );
      if (!clientOrganization || !isActiveClientOrganization(clientOrganization)) {
        return serviceFail(
          validationError(
            "Locations can only be activated under an active client organization.",
          ),
        );
      }
    }

    const updated = await this.dependencies.locations.setActiveState({
      organizationId: input.actor.scope.organizationId,
      actorUserId: input.actor.userId,
      locationId: input.locationId,
      isActive: input.isActive,
    });

    if (!updated) {
      return serviceFail(notFoundError("Location could not be found."));
    }

    return serviceOk(updated);
  }

  async deactivateLocation(
    input: Omit<SetLocationActiveStateInput, "isActive">,
  ): Promise<ServiceResult<Location>> {
    return this.setLocationActiveState({ ...input, isActive: false });
  }

  async validateWorkOrderLocationLinkage(
    input: ValidateWorkOrderLocationLinkageInput,
  ): Promise<ServiceResult<ValidatedWorkOrderLocationLinkage>> {
    if (!input.clientOrganizationId.trim() || !input.locationId.trim()) {
      return serviceFail(
        validationError("Client organization and location are required."),
      );
    }

    const clientOrganizationResult = await this.requireReadableClientOrganization(
      input.actor,
      input.clientOrganizationId,
    );
    if (!clientOrganizationResult.ok) {
      return clientOrganizationResult;
    }

    const locationResult = await this.getLocationDetail({
      actor: input.actor,
      locationId: input.locationId,
    });
    if (!locationResult.ok) {
      return locationResult;
    }

    const belongsToOrganization =
      await this.dependencies.locations.verifyBelongsToOrganization(
        input.locationId,
        input.clientOrganizationId,
      );
    if (!belongsToOrganization) {
      return serviceFail(
        validationError(
          "Selected location does not belong to the specified client organization.",
        ),
      );
    }

    try {
      assertValidWorkOrderLocationSelection({
        clientOrganization: clientOrganizationResult.value,
        location: locationResult.value,
      });
    } catch (error) {
      return serviceFail(
        error instanceof AppError
          ? error
          : validationError(
              "Selected client organization and location are not valid for work orders.",
            ),
      );
    }

    return serviceOk({
      clientOrganization: clientOrganizationResult.value,
      location: locationResult.value,
    });
  }

  private async requireClientOrganizationForMutation(
    actor: AccessActor,
    clientOrganizationId: EntityId,
  ): Promise<ServiceResult<ClientOrganization>> {
    const clientOrganization = await this.dependencies.clientOrganizations.getById(
      clientOrganizationId,
    );
    if (
      !clientOrganization ||
      clientOrganization.isDeleted ||
      clientOrganization.organizationId !== actor.scope.organizationId
    ) {
      return serviceFail(notFoundError("Client organization could not be found."));
    }

    if (!clientOrganizationPolicy.canRead(actor, clientOrganization)) {
      if (actor.actorType === "client") {
        return serviceFail(
          validationError(
            "Client users can only act within their own client organization.",
          ),
        );
      }

      return serviceFail(
        forbiddenError("You do not have access to this client organization."),
      );
    }

    if (!isActiveClientOrganization(clientOrganization)) {
      return serviceFail(
        validationError("Locations can only be managed for active client organizations."),
      );
    }

    return serviceOk(clientOrganization);
  }

  private async requireReadableClientOrganization(
    actor: AccessActor,
    clientOrganizationId: EntityId,
  ): Promise<ServiceResult<ClientOrganization>> {
    const clientOrganization = await this.dependencies.clientOrganizations.getById(
      clientOrganizationId,
    );
    if (
      !clientOrganization ||
      clientOrganization.isDeleted ||
      clientOrganization.organizationId !== actor.scope.organizationId
    ) {
      return serviceFail(notFoundError("Client organization could not be found."));
    }

    if (!clientOrganizationPolicy.canRead(actor, clientOrganization)) {
      return serviceFail(
        forbiddenError("You do not have access to this client organization."),
      );
    }

    return serviceOk(clientOrganization);
  }

  private getScopedLocationFilters(
    actor: AccessActor,
    filters: LocationQueryFiltersSchemaOutput,
  ): ServiceResult<{
    organizationId?: EntityId;
    clientOrganizationId?: EntityId;
    locationIds?: EntityId[];
    status?: Location["status"];
    recordStatus?: Location["recordStatus"];
    search?: string;
    limit?: number;
  }> {
    if (actor.actorType === "contractor") {
      return serviceFail(
        forbiddenError("You do not have access to locations."),
      );
    }

    if (actor.actorType === "client") {
      if (
        filters.clientOrganizationId &&
        filters.clientOrganizationId !== actor.scope.clientOrganizationId
      ) {
        return serviceFail(
          validationError(
            "Client users can only query locations within their own client organization.",
          ),
        );
      }

      return serviceOk({
        clientOrganizationId: actor.scope.clientOrganizationId,
        locationIds:
          actor.scope.locationAccess.kind === "selected_client_locations"
            ? actor.scope.locationAccess.locationIds
            : undefined,
        status: filters.status,
        recordStatus: filters.recordStatus,
        search: filters.search,
        limit: filters.limit,
      });
    }

    return serviceOk({
      organizationId: actor.scope.organizationId,
      clientOrganizationId: filters.clientOrganizationId,
      status: filters.status,
      recordStatus: filters.recordStatus,
      search: filters.search,
      limit: filters.limit,
    });
  }
}

function parseSchema<TValue>(
  schema: { parse(input: unknown): TValue },
  input: unknown,
): ServiceResult<TValue> {
  try {
    return serviceOk(schema.parse(input));
  } catch (error) {
    return serviceFail(
      validationError(
        error instanceof Error ? error.message : "Invalid request payload.",
        error,
      ),
    );
  }
}

function isActiveClientOrganization(
  clientOrganization: ClientOrganization,
): boolean {
  return (
    clientOrganization.recordStatus === "active" &&
    !clientOrganization.isDeleted &&
    clientOrganization.status === "active"
  );
}

function forbiddenError(
  message = "You do not have access to locations.",
): AppError {
  return new AppError({
    code: ERROR_CODES.Forbidden,
    message,
    safeMessage: message,
  });
}
