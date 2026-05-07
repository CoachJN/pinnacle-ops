import "server-only";

import { revalidatePath } from "next/cache";
import type {
  ClientOrganization,
  ContractorOrganization,
  FirestoreContractorOrganizationStatus,
  FirestoreOrganizationStatus,
  Location,
} from "@/server/repositories";
import type { WorkOrderApiContext } from "@/server/api/work-orders";
import {
  resolveClientOrganizationContactLinks,
  resolveContactsById,
  resolveContractorContactLinks,
} from "@/server/api/contact-projections";
import {
  getWorkOrderApiContext,
  jsonError,
  jsonOk,
  parseJsonObject,
} from "@/server/api/work-orders";
import {
  safeLocationDetail,
  safeLocationDetailForActor,
  safeLocationSummary,
  safeLocationSummaryForActor,
} from "@/server/api/business-entity-projections";
import {
  canUserPerformAction,
  createAccessDeniedError,
} from "@/server/authorization";
import {
  createClientOrganizationSchema,
  updateClientOrganizationSchema,
} from "@/lib/validation/client-organizations";
import {
  createLocationSchema,
  updateLocationSchema,
} from "@/lib/validation/locations";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import {
  assertCanArchiveLocation,
  assertCanCreateLocation,
  assertCanReadLocation,
  assertCanUpdateLocation,
  toLocationPermissionTarget,
} from "@/lib/permissions/locations";
import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";

const ORGANIZATION_STATUSES = [
  "active",
  "inactive",
] as const satisfies readonly FirestoreOrganizationStatus[];

const CONTRACTOR_STATUSES = [
  "active",
  "inactive",
  "onboarding",
  "suspended",
] as const satisfies readonly FirestoreContractorOrganizationStatus[];

export {
  getWorkOrderApiContext as getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  parseJsonObject,
};

export type BusinessEntityApiContext = WorkOrderApiContext;

export function parseEntityListLimit(request: { nextUrl: URL }): number {
  const rawLimit = request.nextUrl.searchParams.get("limit");
  if (!rawLimit) {
    return 50;
  }

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw validationError("limit must be an integer between 1 and 100.");
  }

  return limit;
}

export function parseCreateClientPayload(input: Record<string, unknown>) {
  return createClientOrganizationSchema.parse(input);
}

export function parseUpdateClientPayload(input: Record<string, unknown>) {
  return updateClientOrganizationSchema.parse(input);
}

export function parseCreateLocationPayload(input: Record<string, unknown>) {
  return createLocationSchema.parse(input);
}

export function parseUpdateLocationPayload(input: Record<string, unknown>) {
  return updateLocationSchema.parse(input);
}

export function parseCreateContractorPayload(input: Record<string, unknown>) {
  assertAllowedFields(input, [
    "name",
    "displayName",
    "parentContractorId",
    "status",
    "isAssignable",
    "businessEmail",
    "mainPhone",
    "altPhone",
    "fax",
    "primaryContactId",
    "billingContactId",
    "dispatchContactId",
    "trades",
    "serviceArea",
    "notes",
  ]);

  return {
    name: requiredString(input.name, "name"),
    displayName: nullableString(input.displayName, "displayName"),
    parentContractorId: optionalNullableString(
      input.parentContractorId,
      "parentContractorId",
    ),
    status: parseOptionalContractorStatus(input.status, "status"),
    isAssignable: optionalBoolean(input.isAssignable, "isAssignable"),
    businessEmail: optionalNullableString(input.businessEmail, "businessEmail"),
    mainPhone: optionalNullableString(input.mainPhone, "mainPhone"),
    altPhone: optionalNullableString(input.altPhone, "altPhone"),
    fax: optionalNullableString(input.fax, "fax"),
    primaryContactId: optionalNullableString(input.primaryContactId, "primaryContactId"),
    billingContactId: optionalNullableString(input.billingContactId, "billingContactId"),
    dispatchContactId: optionalNullableString(input.dispatchContactId, "dispatchContactId"),
    trades: optionalStringArray(input.trades, "trades"),
    serviceArea: optionalNullableString(input.serviceArea, "serviceArea"),
    notes: nullableString(input.notes, "notes"),
  };
}

export function parseUpdateContractorPayload(input: Record<string, unknown>) {
  assertAllowedFields(input, [
    "name",
    "displayName",
    "parentContractorId",
    "status",
    "isAssignable",
    "businessEmail",
    "mainPhone",
    "altPhone",
    "fax",
    "primaryContactId",
    "billingContactId",
    "dispatchContactId",
    "trades",
    "serviceArea",
    "notes",
  ]);

  return pruneUndefined({
    name: optionalString(input.name, "name"),
    displayName: optionalNullableString(input.displayName, "displayName"),
    parentContractorId: optionalNullableString(
      input.parentContractorId,
      "parentContractorId",
    ),
    status: parseOptionalContractorStatus(input.status, "status"),
    isAssignable: optionalBoolean(input.isAssignable, "isAssignable"),
    businessEmail: optionalNullableString(input.businessEmail, "businessEmail"),
    mainPhone: optionalNullableString(input.mainPhone, "mainPhone"),
    altPhone: optionalNullableString(input.altPhone, "altPhone"),
    fax: optionalNullableString(input.fax, "fax"),
    primaryContactId: optionalNullableString(input.primaryContactId, "primaryContactId"),
    billingContactId: optionalNullableString(input.billingContactId, "billingContactId"),
    dispatchContactId: optionalNullableString(input.dispatchContactId, "dispatchContactId"),
    trades: optionalStringArray(input.trades, "trades"),
    serviceArea: optionalNullableString(input.serviceArea, "serviceArea"),
    notes: optionalNullableString(input.notes, "notes"),
  });
}

export function authorizeClientCreate(context: WorkOrderApiContext): void {
  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "client_organization",
      action: "create",
      target: { organizationId: context.actor.scope.organizationId },
    }),
  );
}

export function authorizeClientRead(
  context: WorkOrderApiContext,
  client: ClientOrganization,
): void {
  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "client_organization",
      action: "read",
      target: {
        id: client.id,
        organizationId: client.organizationId,
      },
    }),
  );
}

export function authorizeClientEdit(
  context: WorkOrderApiContext,
  client: ClientOrganization,
): void {
  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "client_organization",
      action: "edit",
      target: {
        id: client.id,
        organizationId: client.organizationId,
      },
    }),
  );
}

export function authorizeLocationCreate(
  context: WorkOrderApiContext,
  clientOrganizationId: EntityId,
): void {
  assertCanCreateLocation(context.actor, {
    organizationId: context.actor.scope.organizationId,
    clientOrganizationId,
  });
}

export function authorizeLocationRead(
  context: WorkOrderApiContext,
  location: Location,
): void {
  assertCanReadLocation(context.actor, toLocationPermissionTarget(location));
}

export function authorizeLocationEdit(
  context: WorkOrderApiContext,
  location: Location,
): void {
  assertCanUpdateLocation(context.actor, toLocationPermissionTarget(location));
}

export function authorizeLocationArchive(
  context: WorkOrderApiContext,
  location: Location,
): void {
  assertCanArchiveLocation(context.actor, toLocationPermissionTarget(location));
}

export function authorizeContractorCreate(context: WorkOrderApiContext): void {
  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "contractor_organization",
      action: "create",
      target: { organizationId: context.actor.scope.organizationId },
    }),
  );
}

export function authorizeContractorRead(
  context: WorkOrderApiContext,
  contractor: ContractorOrganization,
): void {
  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "contractor_organization",
      action: "read",
      target: {
        id: contractor.id,
        organizationId: contractor.organizationId,
      },
    }),
  );
}

export function authorizeContractorEdit(
  context: WorkOrderApiContext,
  contractor: ContractorOrganization,
): void {
  assertAuthorized(
    canUserPerformAction({
      actor: context.actor,
      entity: "contractor_organization",
      action: "edit",
      target: {
        id: contractor.id,
        organizationId: contractor.organizationId,
      },
    }),
  );
}

export async function listClientsForActor(
  context: WorkOrderApiContext,
  limit: number,
): Promise<ClientOrganization[]> {
  if (context.actor.actorType === "contractor") {
    throw createAccessDeniedError();
  }

  if (context.actor.actorType === "client") {
    const client = await context.services.clientLocations.getClient(
      context.actor.scope.clientOrganizationId,
    );
    if (!client.ok) {
      throw client.error;
    }
    authorizeClientRead(context, client.value);
    return [client.value];
  }

  const clients = await context.services.clientLocations.listClients({
    organizationId: context.actor.scope.organizationId,
    limit,
  });
  if (!clients.ok) {
    throw clients.error;
  }

  return clients.value.filter((client) => canReadClient(context.actor, client));
}

export async function listLocationsForActor(
  context: WorkOrderApiContext,
  limit: number,
): Promise<Location[]> {
  if (context.actor.actorType === "contractor") {
    throw createAccessDeniedError();
  }

  const result =
    context.actor.actorType === "internal"
      ? await context.services.clientLocations.listLocations({
          scope: "organization",
          organizationId: context.actor.scope.organizationId,
          limit,
        })
      : context.actor.scope.locationAccess.kind === "selected_client_locations"
        ? await context.services.clientLocations.listLocations({
            scope: "ids",
            locationIds: context.actor.scope.locationAccess.locationIds,
            limit,
          })
        : await context.services.clientLocations.listLocations({
            scope: "clientOrganization",
            clientOrganizationId: context.actor.scope.clientOrganizationId,
            limit,
          });

  if (!result.ok) {
    throw result.error;
  }

  return result.value.filter((location) => canReadLocation(context.actor, location));
}

export async function listContractorsForActor(
  context: WorkOrderApiContext,
  limit: number,
): Promise<ContractorOrganization[]> {
  if (context.actor.actorType === "client") {
    throw createAccessDeniedError();
  }

  if (context.actor.actorType === "contractor") {
    const contractor =
      await context.services.contractors.getContractorOrganization(
        context.actor.scope.contractorOrganizationId,
      );
    if (!contractor.ok) {
      throw contractor.error;
    }
    authorizeContractorRead(context, contractor.value);
    return [contractor.value];
  }

  const contractors =
    await context.services.contractors.listContractorOrganizations({
      organizationId: context.actor.scope.organizationId,
      limit,
    });
  if (!contractors.ok) {
    throw contractors.error;
  }

  return contractors.value.filter((contractor) =>
    canReadContractor(context.actor, contractor),
  );
}

export async function safeClientSummary(
  repositories: Pick<
    WorkOrderApiContext["repositories"],
    "clientOrganizationContactLinks" | "contacts"
  >,
  client: ClientOrganization,
) {
  const [contactsById, linkedContacts] = await Promise.all([
    resolveContactsById(repositories, [
      client.primaryContactId,
      client.billingContactId,
    ]),
    resolveClientOrganizationContactLinks(repositories, client.id),
  ]);
  const primaryContact = client.primaryContactId
    ? contactsById[client.primaryContactId] ?? null
    : null;
  const billingContact = client.billingContactId
    ? contactsById[client.billingContactId] ?? null
    : null;
  return {
    id: client.id,
    name: client.name,
    displayName: client.displayName,
    status: client.status,
    primaryContactId: client.primaryContactId,
    billingContactId: client.billingContactId,
    primaryContact,
    billingContact,
    linkedContacts,
    updatedAt: client.updatedAt,
  };
}

export async function safeClientDetail(
  repositories: Pick<
    WorkOrderApiContext["repositories"],
    "clientOrganizationContactLinks" | "contacts"
  >,
  client: ClientOrganization,
) {
  return {
    ...(await safeClientSummary(repositories, client)),
    notes: client.notes,
    createdAt: client.createdAt,
    recordStatus: client.recordStatus,
  };
}

export {
  safeLocationDetail,
  safeLocationDetailForActor,
  safeLocationSummary,
  safeLocationSummaryForActor,
};

export async function safeContractorSummary(
  repositories: Pick<
    WorkOrderApiContext["repositories"],
    "contacts" | "contractorContactLinks"
  >,
  contractor: ContractorOrganization,
) {
  const [contactsById, linkedContacts] = await Promise.all([
    resolveContactsById(repositories, [
      contractor.primaryContactId,
      contractor.billingContactId,
      contractor.dispatchContactId,
    ]),
    resolveContractorContactLinks(repositories, contractor.id),
  ]);
  const primaryContact = contractor.primaryContactId
    ? contactsById[contractor.primaryContactId] ?? null
    : null;
  const billingContact = contractor.billingContactId
    ? contactsById[contractor.billingContactId] ?? null
    : null;
  const dispatchContact = contractor.dispatchContactId
    ? contactsById[contractor.dispatchContactId] ?? null
    : null;
  return {
    id: contractor.id,
    name: contractor.name,
    displayName: contractor.displayName,
    parentContractorId: contractor.parentContractorId ?? null,
    status: contractor.status,
    isAssignable: contractor.isAssignable ?? null,
    businessEmail: contractor.businessEmail ?? null,
    mainPhone: contractor.mainPhone ?? null,
    altPhone: contractor.altPhone ?? null,
    fax: contractor.fax ?? null,
    primaryContactId: contractor.primaryContactId,
    billingContactId: contractor.billingContactId,
    dispatchContactId: contractor.dispatchContactId,
    primaryContact,
    billingContact,
    dispatchContact,
    linkedContacts,
    trades: contractor.trades ?? [],
    serviceArea: contractor.serviceArea ?? null,
    updatedAt: contractor.updatedAt,
  };
}

export async function safeContractorDetail(
  repositories: Pick<
    WorkOrderApiContext["repositories"],
    "contacts" | "contractorContactLinks"
  >,
  contractor: ContractorOrganization,
) {
  return {
    ...(await safeContractorSummary(repositories, contractor)),
    notes: contractor.notes,
    createdAt: contractor.createdAt,
    recordStatus: contractor.recordStatus,
  };
}

export function revalidateClientPaths(id?: EntityId): void {
  revalidatePath("/client-organizations");
  if (id) {
    revalidatePath(`/client-organizations/${id}`);
  }
}

export function revalidateLocationPaths(id?: EntityId): void {
  revalidatePath("/locations");
  if (id) {
    revalidatePath(`/locations/${id}`);
  }
}

export function revalidateContractorPaths(id?: EntityId): void {
  revalidatePath("/contractors");
  if (id) {
    revalidatePath(`/contractors/${id}`);
  }
}

function canReadClient(actor: AccessActor, client: ClientOrganization): boolean {
  return canUserPerformAction({
    actor,
    entity: "client_organization",
    action: "read",
    target: {
      id: client.id,
      organizationId: client.organizationId,
    },
  });
}

function canReadLocation(actor: AccessActor, location: Location): boolean {
  return canUserPerformAction({
    actor,
    entity: "location",
    action: "read",
    target: toLocationPermissionTarget(location),
  });
}

function canReadContractor(
  actor: AccessActor,
  contractor: ContractorOrganization,
): boolean {
  return canUserPerformAction({
    actor,
    entity: "contractor_organization",
    action: "read",
    target: {
      id: contractor.id,
      organizationId: contractor.organizationId,
    },
  });
}

function assertAuthorized(allowed: boolean): void {
  if (!allowed) {
    throw createAccessDeniedError();
  }
}

function validationError(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.ValidationFailed,
    message,
    safeMessage: message,
  });
}

function assertAllowedFields(
  input: Record<string, unknown>,
  allowedFields: readonly string[],
): void {
  const allowed = new Set(allowedFields);
  const invalidFields = Object.keys(input).filter((field) => !allowed.has(field));

  if (invalidFields.length > 0) {
    throw validationError(`Unsupported fields: ${invalidFields.join(", ")}.`);
  }
}

function requiredString(value: unknown, field: string): string {
  const parsed = optionalString(value, field);
  if (!parsed) {
    throw validationError(`${field} is required.`);
  }

  return parsed;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw validationError(`${field} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw validationError(`${field} cannot be blank.`);
  }

  return trimmed;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return requiredString(value, field);
}

function optionalNullableString(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return nullableString(value, field);
}

function parseOptionalOrganizationStatus(
  value: unknown,
  field: string,
): FirestoreOrganizationStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !(ORGANIZATION_STATUSES as readonly string[]).includes(value)
  ) {
    throw validationError(`${field} must be active or inactive.`);
  }

  return value as FirestoreOrganizationStatus;
}

function parseOptionalContractorStatus(
  value: unknown,
  field: string,
): FirestoreContractorOrganizationStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !(CONTRACTOR_STATUSES as readonly string[]).includes(value)
  ) {
    throw validationError(
      `${field} must be active, inactive, onboarding, or suspended.`,
    );
  }

  return value as FirestoreContractorOrganizationStatus;
}

function optionalStringArray(
  value: unknown,
  field: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw validationError(`${field} must be an array of strings.`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw validationError(`${field} must be a boolean.`);
  }

  return value;
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
