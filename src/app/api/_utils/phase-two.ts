import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import type { AccessActor } from "@/types/auth";
import type { Location } from "@/server/repositories";

export interface LocationListFilters {
  clientOrganizationId?: string;
  isActive?: boolean;
  search?: string;
  limit: number;
}

export function normalizePhaseTwoRouteError(error: unknown): unknown {
  if (
    error instanceof AppError &&
    error.code === ERROR_CODES.ValidationFailed &&
    error.statusCode === 400
  ) {
    return new AppError({
      code: error.code,
      message: error.message,
      safeMessage: error.safeMessage,
      cause: error,
      statusCode: 422,
    });
  }

  return error;
}

export function parseLocationListFilters(
  request: NextRequest,
  actor: AccessActor,
): LocationListFilters {
  return {
    clientOrganizationId: getScopedClientOrganizationId(
      actor,
      readOptionalQueryParam(
        request.nextUrl.searchParams.get("clientOrganizationId"),
      ),
    ),
    isActive: parseOptionalBooleanQueryParam(
      request.nextUrl.searchParams.get("isActive"),
      "isActive",
    ),
    search: readOptionalQueryParam(request.nextUrl.searchParams.get("search")),
    limit: parseLimitQueryParam(request.nextUrl.searchParams.get("limit")),
  };
}

export function filterLocations(
  locations: Location[],
  filters: Omit<LocationListFilters, "limit">,
): Location[] {
  const normalizedSearch = filters.search?.toLowerCase();

  return locations.filter((location) => {
    if (
      filters.clientOrganizationId &&
      location.clientOrganizationId !== filters.clientOrganizationId
    ) {
      return false;
    }

    if (
      filters.isActive !== undefined &&
      (location.status === "active") !== filters.isActive
    ) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [location.name, location.city]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });
}

function getScopedClientOrganizationId(
  actor: AccessActor,
  requestedClientOrganizationId?: string,
): string | undefined {
  if (actor.actorType === "client") {
    return actor.scope.clientOrganizationId;
  }

  return requestedClientOrganizationId;
}

function readOptionalQueryParam(value: string | null): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function parseLimitQueryParam(value: string | null): number {
  if (!value) {
    return 50;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createValidationError("limit must be an integer between 1 and 100.");
  }

  return limit;
}

function parseOptionalBooleanQueryParam(
  value: string | null,
  field: string,
): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw createValidationError(`${field} must be true or false.`);
}

function createValidationError(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.ValidationFailed,
    message,
    safeMessage: message,
    statusCode: 422,
  });
}
