import type { AuditableEntity, EntityId } from "@/types/entity";
export type {
  AppRole,
  AuthErrorResponse,
  AuthGuardFailure,
  AuthGuardFailureReason,
  AuthGuardResult,
  AuthGuardSuccess,
  AuthResponse,
  AuthSession,
  AuthSuccessResponse,
  AuthenticatedUser,
  FirebaseCustomClaims,
  RoleSubject,
  SessionUser,
  SignInFormStatus,
  UserWithAllowedRole,
} from "@/lib/auth/auth-types";
export { APP_ROLES as USER_ROLES } from "@/lib/rbac/roles";
import type {
  AppRole as AuthAppRole,
  AuthenticatedUser,
} from "@/lib/auth/auth-types";
export type {
  ClientUserRole,
  ContractorUserRole,
  CoordinatorRole,
  ExternalUserRole,
  FinanceAdminRole,
  InternalUserRole,
  ManagerRole,
  OwnerRole,
  UserRole,
} from "@/types/permissions";
import type {
  ClientUserRole,
  ContractorUserRole,
  InternalUserRole,
  UserRole,
} from "@/types/permissions";

export type ClientLocationAccess =
  | { kind: "all_client_locations" }
  | { kind: "selected_client_locations"; locationIds: EntityId[] };

export interface InternalAccessScope {
  kind: "internal";
  organizationId: EntityId;
}

export interface ClientAccessScope {
  kind: "client";
  organizationId: EntityId;
  clientOrganizationId: EntityId;
  locationAccess: ClientLocationAccess;
}

export interface ContractorAccessScope {
  kind: "contractor";
  organizationId: EntityId;
  contractorOrganizationId: EntityId;
  assignedWorkOrderIds?: EntityId[];
}

export type ActorAccessScope =
  | InternalAccessScope
  | ClientAccessScope
  | ContractorAccessScope;

export interface InternalAccessActor {
  actorType: "internal";
  userId: EntityId;
  role: InternalUserRole;
  scope: InternalAccessScope;
}

export interface ClientAccessActor {
  actorType: "client";
  userId: EntityId;
  role: ClientUserRole;
  scope: ClientAccessScope;
}

export interface ContractorAccessActor {
  actorType: "contractor";
  userId: EntityId;
  role: ContractorUserRole;
  scope: ContractorAccessScope;
}

export type AccessActor =
  | InternalAccessActor
  | ClientAccessActor
  | ContractorAccessActor;

export interface Role extends AuditableEntity {
  code: UserRole;
  name: string;
  description?: string;
}

export interface User extends AuditableEntity {
  email: string;
  displayName?: string;
  roleId: EntityId;
  roleCode: UserRole;
  isActive: boolean;
  clientOrganizationId?: EntityId;
  contractorOrganizationId?: EntityId;
  contractorId?: EntityId;
  locationId?: EntityId;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  roleId?: EntityId;
  organizationId?: EntityId;
  clientOrganizationId?: EntityId;
  contractorOrganizationId?: EntityId;
  contractorId?: EntityId;
  locationId?: EntityId;
  accessScope?: ActorAccessScope;
}

export interface NormalizedCurrentUser
  extends Pick<
    AuthenticatedUser,
    "uid" | "email" | "displayName" | "organizationId" | "emailVerified"
  > {
  displayLabel: string;
  role: AuthAppRole;
  roleLabel: string;
}
