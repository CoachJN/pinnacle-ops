import type {
  AccessActor,
  AuthUser,
  ClientAccessActor,
  ContractorAccessActor,
  InternalAccessActor,
} from "@/types/auth";
import type { EntityId } from "@/types/entity";
import {
  USER_ROLES,
  isInternalRole,
  type ClientUserRole,
  type ContractorUserRole,
  type InternalUserRole,
  type UserRole,
} from "@/types/permissions";

export class AuthContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthContextError";
  }
}

export function accessActorFromAuthUser(authUser: AuthUser): AccessActor {
  const role = requireValidRole(authUser.role);
  const organizationId = requireEntityId(
    authUser.organizationId,
    "Auth user organization scope is required.",
  );

  if (isInternalRole(role)) {
    rejectExternalScopeOnInternalUser(authUser);

    const actor: InternalAccessActor = {
      actorType: "internal",
      userId: requireEntityId(authUser.uid, "Auth user id is required."),
      role: role as InternalUserRole,
      scope: { kind: "internal", organizationId },
    };

    assertProvidedAccessScopeMatchesActor(authUser, actor);
    return actor;
  }

  if (role === USER_ROLES.ClientUser) {
    const locationAccess = authUser.locationId
      ? {
          kind: "selected_client_locations" as const,
          locationIds: [authUser.locationId],
        }
      : { kind: "all_client_locations" as const };

    const actor: ClientAccessActor = {
      actorType: "client",
      userId: requireEntityId(authUser.uid, "Auth user id is required."),
      role: role as ClientUserRole,
      scope: {
        kind: "client",
        organizationId,
        clientOrganizationId: requireEntityId(
          authUser.clientOrganizationId,
          "Client users require a client organization scope.",
        ),
        locationAccess,
      },
    };

    if (authUser.contractorOrganizationId) {
      throw new AuthContextError(
        "Client users cannot be scoped to contractor organizations.",
      );
    }

    assertProvidedAccessScopeMatchesActor(authUser, actor);
    return actor;
  }

  if (role === USER_ROLES.ContractorUser) {
    const actor: ContractorAccessActor = {
      actorType: "contractor",
      userId: requireEntityId(authUser.uid, "Auth user id is required."),
      role: role as ContractorUserRole,
      scope: {
        kind: "contractor",
        organizationId,
        contractorOrganizationId: requireEntityId(
          authUser.contractorOrganizationId,
          "Contractor users require a contractor organization scope.",
        ),
      },
    };

    if (authUser.clientOrganizationId || authUser.locationId) {
      throw new AuthContextError(
        "Contractor users cannot be scoped to client organizations or locations.",
      );
    }

    assertProvidedAccessScopeMatchesActor(authUser, actor);
    return actor;
  }

  throw new AuthContextError(`Unsupported role: ${String(role)}`);
}

function requireValidRole(role: unknown): UserRole {
  if (
    typeof role === "string" &&
    Object.values(USER_ROLES).includes(role as UserRole)
  ) {
    return role as UserRole;
  }

  throw new AuthContextError("Auth user role is invalid.");
}

function requireEntityId(value: unknown, message: string): EntityId {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new AuthContextError(message);
}

function rejectExternalScopeOnInternalUser(authUser: AuthUser): void {
  if (authUser.clientOrganizationId || authUser.contractorOrganizationId) {
    throw new AuthContextError(
      "Internal users cannot carry client or contractor organization scope.",
    );
  }

  if (authUser.locationId) {
    throw new AuthContextError("Internal users cannot carry location scope.");
  }
}

function assertProvidedAccessScopeMatchesActor(
  authUser: AuthUser,
  actor: AccessActor,
): void {
  if (!authUser.accessScope) {
    return;
  }

  const providedScope = authUser.accessScope;

  if (providedScope.kind !== actor.scope.kind) {
    throw new AuthContextError("Auth user access scope does not match role type.");
  }

  if (providedScope.organizationId !== actor.scope.organizationId) {
    throw new AuthContextError("Auth user organization scope is inconsistent.");
  }

  if (
    actor.actorType === "client" &&
    (providedScope.kind !== "client" ||
      providedScope.clientOrganizationId !== actor.scope.clientOrganizationId)
  ) {
    throw new AuthContextError(
      "Auth user client organization scope is inconsistent.",
    );
  }

  if (
    actor.actorType === "contractor" &&
    (providedScope.kind !== "contractor" ||
      providedScope.contractorOrganizationId !==
        actor.scope.contractorOrganizationId)
  ) {
    throw new AuthContextError(
      "Auth user contractor organization scope is inconsistent.",
    );
  }
}
