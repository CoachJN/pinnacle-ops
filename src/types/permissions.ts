import { APP_ROLES } from "@/lib/rbac/roles";

export const USER_ROLES = APP_ROLES;

export type CoordinatorRole = typeof USER_ROLES.Coordinator;
export type ManagerRole = typeof USER_ROLES.Manager;
export type FinanceAdminRole = typeof USER_ROLES.FinanceAdmin;
export type OwnerRole = typeof USER_ROLES.Owner;
export type ClientUserRole = typeof USER_ROLES.ClientUser;
export type ContractorUserRole = typeof USER_ROLES.ContractorUser;

export type InternalUserRole =
  | CoordinatorRole
  | ManagerRole
  | FinanceAdminRole
  | OwnerRole;

export type ExternalUserRole = ClientUserRole | ContractorUserRole;

export type UserRole = InternalUserRole | ExternalUserRole;

export const ROLE_CATEGORIES = {
  Internal: "internal",
  External: "external",
} as const;

export type RoleCategory =
  (typeof ROLE_CATEGORIES)[keyof typeof ROLE_CATEGORIES];

export const AUTHORITY_CATEGORIES = {
  View: "view",
  Create: "create",
  Edit: "edit",
  Approve: "approve",
  Transition: "transition",
} as const;

export type AuthorityCategory =
  (typeof AUTHORITY_CATEGORIES)[keyof typeof AUTHORITY_CATEGORIES];

export const PERMISSION_ENTITIES = {
  WorkOrders: "work_orders",
  ClientOrganizations: "client_organizations",
  Locations: "locations",
  Contractors: "contractors",
  Assignments: "assignments",
  ContractorQuotes: "contractor_quotes",
  ClientFacingQuotes: "client_facing_quotes",
  Invoices: "invoices",
  ActivityLogs: "activity_logs",
  DashboardAccess: "dashboard_access",
  InternalNotes: "internal_notes",
  PaymentStatus: "payment_status",
  BillingData: "billing_data",
} as const;

export type PermissionEntity =
  (typeof PERMISSION_ENTITIES)[keyof typeof PERMISSION_ENTITIES];

export const PERMISSION_ACTIONS = [
  AUTHORITY_CATEGORIES.View,
  AUTHORITY_CATEGORIES.Create,
  AUTHORITY_CATEGORIES.Edit,
  AUTHORITY_CATEGORIES.Approve,
  AUTHORITY_CATEGORIES.Transition,
] as const satisfies readonly AuthorityCategory[];

export const ROLE_PERMISSION_SCOPES = {
  Operations: "operations",
  FinancialAdmin: "financial_admin",
  Client: "client",
  Contractor: "contractor",
  OwnerOverride: "owner_override",
} as const;

export type RolePermissionScope =
  (typeof ROLE_PERMISSION_SCOPES)[keyof typeof ROLE_PERMISSION_SCOPES];

export interface RoleAuthorityGrant {
  authority: AuthorityCategory;
  scope: RolePermissionScope;
}

export interface PlatformRoleDefinition {
  code: UserRole;
  name: string;
  category: RoleCategory;
  description: string;
  precedence: number;
  authorities: readonly RoleAuthorityGrant[];
}

export const INTERNAL_USER_ROLES = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly InternalUserRole[];

export const EXTERNAL_USER_ROLES = [
  USER_ROLES.ClientUser,
  USER_ROLES.ContractorUser,
] as const satisfies readonly ExternalUserRole[];

const noRoles = [] as const satisfies readonly UserRole[];
const operationsRoles = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];
const clientQuoteControlRoles = [
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];
const operationsApprovalRoles = [
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];
const financialRoles = [
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];
const internalVisibilityRoles = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];
const clientLocationManagementRoles = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

export type PermissionMatrix = Record<
  PermissionEntity,
  Record<AuthorityCategory, readonly UserRole[]>
>;

export const ROLE_PERMISSION_MATRIX = {
  [PERMISSION_ENTITIES.WorkOrders]: {
    [AUTHORITY_CATEGORIES.View]: [
      ...internalVisibilityRoles,
      USER_ROLES.ClientUser,
      USER_ROLES.ContractorUser,
    ],
    [AUTHORITY_CATEGORIES.Create]: [
      ...operationsRoles,
      USER_ROLES.ClientUser,
    ],
    [AUTHORITY_CATEGORIES.Edit]: operationsRoles,
    [AUTHORITY_CATEGORIES.Approve]: operationsApprovalRoles,
    [AUTHORITY_CATEGORIES.Transition]: operationsRoles,
  },
  [PERMISSION_ENTITIES.ClientOrganizations]: {
    [AUTHORITY_CATEGORIES.View]: [
      ...internalVisibilityRoles,
      USER_ROLES.ClientUser,
    ],
    [AUTHORITY_CATEGORIES.Create]: clientLocationManagementRoles,
    [AUTHORITY_CATEGORIES.Edit]: clientLocationManagementRoles,
    [AUTHORITY_CATEGORIES.Approve]: operationsApprovalRoles,
    [AUTHORITY_CATEGORIES.Transition]: operationsApprovalRoles,
  },
  [PERMISSION_ENTITIES.Locations]: {
    [AUTHORITY_CATEGORIES.View]: [
      ...internalVisibilityRoles,
      USER_ROLES.ClientUser,
    ],
    [AUTHORITY_CATEGORIES.Create]: [
      ...clientLocationManagementRoles,
      USER_ROLES.ClientUser,
    ],
    [AUTHORITY_CATEGORIES.Edit]: [
      ...clientLocationManagementRoles,
      USER_ROLES.ClientUser,
    ],
    [AUTHORITY_CATEGORIES.Approve]: operationsApprovalRoles,
    [AUTHORITY_CATEGORIES.Transition]: operationsApprovalRoles,
  },
  [PERMISSION_ENTITIES.Contractors]: {
    [AUTHORITY_CATEGORIES.View]: [
      ...internalVisibilityRoles,
      USER_ROLES.ContractorUser,
    ],
    [AUTHORITY_CATEGORIES.Create]: operationsRoles,
    [AUTHORITY_CATEGORIES.Edit]: operationsRoles,
    [AUTHORITY_CATEGORIES.Approve]: operationsApprovalRoles,
    [AUTHORITY_CATEGORIES.Transition]: operationsRoles,
  },
  [PERMISSION_ENTITIES.Assignments]: {
    [AUTHORITY_CATEGORIES.View]: [
      USER_ROLES.Coordinator,
      USER_ROLES.Manager,
      USER_ROLES.Owner,
      USER_ROLES.ContractorUser,
    ],
    [AUTHORITY_CATEGORIES.Create]: operationsRoles,
    [AUTHORITY_CATEGORIES.Edit]: operationsRoles,
    [AUTHORITY_CATEGORIES.Approve]: operationsApprovalRoles,
    [AUTHORITY_CATEGORIES.Transition]: [
      ...operationsRoles,
      USER_ROLES.ContractorUser,
    ],
  },
  [PERMISSION_ENTITIES.ContractorQuotes]: {
    [AUTHORITY_CATEGORIES.View]: [
      ...internalVisibilityRoles,
      USER_ROLES.ContractorUser,
    ],
    [AUTHORITY_CATEGORIES.Create]: [
      ...operationsRoles,
      USER_ROLES.ContractorUser,
    ],
    [AUTHORITY_CATEGORIES.Edit]: [
      ...operationsRoles,
      USER_ROLES.ContractorUser,
    ],
    [AUTHORITY_CATEGORIES.Approve]: operationsApprovalRoles,
    [AUTHORITY_CATEGORIES.Transition]: [
      ...operationsRoles,
      USER_ROLES.ContractorUser,
    ],
  },
  [PERMISSION_ENTITIES.ClientFacingQuotes]: {
    [AUTHORITY_CATEGORIES.View]: [
      ...internalVisibilityRoles,
      USER_ROLES.ClientUser,
    ],
    [AUTHORITY_CATEGORIES.Create]: clientQuoteControlRoles,
    [AUTHORITY_CATEGORIES.Edit]: clientQuoteControlRoles,
    [AUTHORITY_CATEGORIES.Approve]: [
      ...operationsApprovalRoles,
      USER_ROLES.ClientUser,
    ],
    [AUTHORITY_CATEGORIES.Transition]: [
      ...clientQuoteControlRoles,
      USER_ROLES.ClientUser,
    ],
  },
  [PERMISSION_ENTITIES.Invoices]: {
    [AUTHORITY_CATEGORIES.View]: [
      USER_ROLES.Coordinator,
      USER_ROLES.Manager,
      USER_ROLES.FinanceAdmin,
      USER_ROLES.Owner,
    ],
    [AUTHORITY_CATEGORIES.Create]: financialRoles,
    [AUTHORITY_CATEGORIES.Edit]: financialRoles,
    [AUTHORITY_CATEGORIES.Approve]: financialRoles,
    [AUTHORITY_CATEGORIES.Transition]: financialRoles,
  },
  [PERMISSION_ENTITIES.ActivityLogs]: {
    [AUTHORITY_CATEGORIES.View]: internalVisibilityRoles,
    [AUTHORITY_CATEGORIES.Create]: noRoles,
    [AUTHORITY_CATEGORIES.Edit]: noRoles,
    [AUTHORITY_CATEGORIES.Approve]: noRoles,
    [AUTHORITY_CATEGORIES.Transition]: noRoles,
  },
  [PERMISSION_ENTITIES.DashboardAccess]: {
    [AUTHORITY_CATEGORIES.View]: internalVisibilityRoles,
    [AUTHORITY_CATEGORIES.Create]: noRoles,
    [AUTHORITY_CATEGORIES.Edit]: noRoles,
    [AUTHORITY_CATEGORIES.Approve]: noRoles,
    [AUTHORITY_CATEGORIES.Transition]: noRoles,
  },
  [PERMISSION_ENTITIES.InternalNotes]: {
    [AUTHORITY_CATEGORIES.View]: internalVisibilityRoles,
    [AUTHORITY_CATEGORIES.Create]: internalVisibilityRoles,
    [AUTHORITY_CATEGORIES.Edit]: internalVisibilityRoles,
    [AUTHORITY_CATEGORIES.Approve]: noRoles,
    [AUTHORITY_CATEGORIES.Transition]: noRoles,
  },
  [PERMISSION_ENTITIES.PaymentStatus]: {
    [AUTHORITY_CATEGORIES.View]: [
      USER_ROLES.FinanceAdmin,
      USER_ROLES.Owner,
      USER_ROLES.ClientUser,
    ],
    [AUTHORITY_CATEGORIES.Create]: financialRoles,
    [AUTHORITY_CATEGORIES.Edit]: financialRoles,
    [AUTHORITY_CATEGORIES.Approve]: financialRoles,
    [AUTHORITY_CATEGORIES.Transition]: financialRoles,
  },
  [PERMISSION_ENTITIES.BillingData]: {
    [AUTHORITY_CATEGORIES.View]: financialRoles,
    [AUTHORITY_CATEGORIES.Create]: financialRoles,
    [AUTHORITY_CATEGORIES.Edit]: financialRoles,
    [AUTHORITY_CATEGORIES.Approve]: financialRoles,
    [AUTHORITY_CATEGORIES.Transition]: financialRoles,
  },
} as const satisfies PermissionMatrix;

const operationsViewGrant = {
  authority: AUTHORITY_CATEGORIES.View,
  scope: ROLE_PERMISSION_SCOPES.Operations,
} as const satisfies RoleAuthorityGrant;

const operationsCreateGrant = {
  authority: AUTHORITY_CATEGORIES.Create,
  scope: ROLE_PERMISSION_SCOPES.Operations,
} as const satisfies RoleAuthorityGrant;

const operationsEditGrant = {
  authority: AUTHORITY_CATEGORIES.Edit,
  scope: ROLE_PERMISSION_SCOPES.Operations,
} as const satisfies RoleAuthorityGrant;

const operationsApproveGrant = {
  authority: AUTHORITY_CATEGORIES.Approve,
  scope: ROLE_PERMISSION_SCOPES.Operations,
} as const satisfies RoleAuthorityGrant;

const operationsTransitionGrant = {
  authority: AUTHORITY_CATEGORIES.Transition,
  scope: ROLE_PERMISSION_SCOPES.Operations,
} as const satisfies RoleAuthorityGrant;

const financialAdminViewGrant = {
  authority: AUTHORITY_CATEGORIES.View,
  scope: ROLE_PERMISSION_SCOPES.FinancialAdmin,
} as const satisfies RoleAuthorityGrant;

const financialAdminCreateGrant = {
  authority: AUTHORITY_CATEGORIES.Create,
  scope: ROLE_PERMISSION_SCOPES.FinancialAdmin,
} as const satisfies RoleAuthorityGrant;

const financialAdminEditGrant = {
  authority: AUTHORITY_CATEGORIES.Edit,
  scope: ROLE_PERMISSION_SCOPES.FinancialAdmin,
} as const satisfies RoleAuthorityGrant;

const financialAdminApproveGrant = {
  authority: AUTHORITY_CATEGORIES.Approve,
  scope: ROLE_PERMISSION_SCOPES.FinancialAdmin,
} as const satisfies RoleAuthorityGrant;

const financialAdminTransitionGrant = {
  authority: AUTHORITY_CATEGORIES.Transition,
  scope: ROLE_PERMISSION_SCOPES.FinancialAdmin,
} as const satisfies RoleAuthorityGrant;

const clientViewGrant = {
  authority: AUTHORITY_CATEGORIES.View,
  scope: ROLE_PERMISSION_SCOPES.Client,
} as const satisfies RoleAuthorityGrant;

const clientCreateGrant = {
  authority: AUTHORITY_CATEGORIES.Create,
  scope: ROLE_PERMISSION_SCOPES.Client,
} as const satisfies RoleAuthorityGrant;

const clientEditGrant = {
  authority: AUTHORITY_CATEGORIES.Edit,
  scope: ROLE_PERMISSION_SCOPES.Client,
} as const satisfies RoleAuthorityGrant;

const clientApproveGrant = {
  authority: AUTHORITY_CATEGORIES.Approve,
  scope: ROLE_PERMISSION_SCOPES.Client,
} as const satisfies RoleAuthorityGrant;

const clientTransitionGrant = {
  authority: AUTHORITY_CATEGORIES.Transition,
  scope: ROLE_PERMISSION_SCOPES.Client,
} as const satisfies RoleAuthorityGrant;

const contractorViewGrant = {
  authority: AUTHORITY_CATEGORIES.View,
  scope: ROLE_PERMISSION_SCOPES.Contractor,
} as const satisfies RoleAuthorityGrant;

const contractorCreateGrant = {
  authority: AUTHORITY_CATEGORIES.Create,
  scope: ROLE_PERMISSION_SCOPES.Contractor,
} as const satisfies RoleAuthorityGrant;

const contractorEditGrant = {
  authority: AUTHORITY_CATEGORIES.Edit,
  scope: ROLE_PERMISSION_SCOPES.Contractor,
} as const satisfies RoleAuthorityGrant;

const contractorTransitionGrant = {
  authority: AUTHORITY_CATEGORIES.Transition,
  scope: ROLE_PERMISSION_SCOPES.Contractor,
} as const satisfies RoleAuthorityGrant;

const ownerOverrideGrants = [
  AUTHORITY_CATEGORIES.View,
  AUTHORITY_CATEGORIES.Create,
  AUTHORITY_CATEGORIES.Edit,
  AUTHORITY_CATEGORIES.Approve,
  AUTHORITY_CATEGORIES.Transition,
].map((authority) => ({
  authority,
  scope: ROLE_PERMISSION_SCOPES.OwnerOverride,
})) satisfies readonly RoleAuthorityGrant[];

export const PLATFORM_ROLE_DEFINITIONS = {
  [USER_ROLES.Coordinator]: {
    code: USER_ROLES.Coordinator,
    name: "Coordinator",
    category: ROLE_CATEGORIES.Internal,
    description: "Day-to-day operational execution for work orders.",
    precedence: 10,
    authorities: [
      operationsViewGrant,
      operationsCreateGrant,
      operationsEditGrant,
      operationsTransitionGrant,
    ],
  },
  [USER_ROLES.Manager]: {
    code: USER_ROLES.Manager,
    name: "Manager",
    category: ROLE_CATEGORIES.Internal,
    description: "Operational governance and approval authority.",
    precedence: 20,
    authorities: [
      operationsViewGrant,
      operationsCreateGrant,
      operationsEditGrant,
      operationsApproveGrant,
      operationsTransitionGrant,
    ],
  },
  [USER_ROLES.FinanceAdmin]: {
    code: USER_ROLES.FinanceAdmin,
    name: "Finance/Admin",
    category: ROLE_CATEGORIES.Internal,
    description: "Financial and administrative authority.",
    precedence: 20,
    authorities: [
      financialAdminViewGrant,
      financialAdminCreateGrant,
      financialAdminEditGrant,
      financialAdminApproveGrant,
      financialAdminTransitionGrant,
    ],
  },
  [USER_ROLES.Owner]: {
    code: USER_ROLES.Owner,
    name: "Owner",
    category: ROLE_CATEGORIES.Internal,
    description: "Ultimate platform override and full business authority.",
    precedence: 30,
    authorities: [
      operationsViewGrant,
      operationsCreateGrant,
      operationsEditGrant,
      operationsApproveGrant,
      operationsTransitionGrant,
      financialAdminViewGrant,
      financialAdminCreateGrant,
      financialAdminEditGrant,
      financialAdminApproveGrant,
      financialAdminTransitionGrant,
      ...ownerOverrideGrants,
    ],
  },
  [USER_ROLES.ClientUser]: {
    code: USER_ROLES.ClientUser,
    name: "Client User",
    category: ROLE_CATEGORIES.External,
    description: "Client-scoped request, visibility, and approval authority.",
    precedence: 0,
    authorities: [
      clientViewGrant,
      clientCreateGrant,
      clientEditGrant,
      clientApproveGrant,
      clientTransitionGrant,
    ],
  },
  [USER_ROLES.ContractorUser]: {
    code: USER_ROLES.ContractorUser,
    name: "Contractor User",
    category: ROLE_CATEGORIES.External,
    description: "Assignment-scoped contractor execution authority.",
    precedence: 0,
    authorities: [
      contractorViewGrant,
      contractorCreateGrant,
      contractorEditGrant,
      contractorTransitionGrant,
    ],
  },
} as const satisfies Record<UserRole, PlatformRoleDefinition>;

export function getRoleDefinition(role: UserRole): PlatformRoleDefinition {
  return PLATFORM_ROLE_DEFINITIONS[role];
}

export function isInternalRole(role: UserRole): role is InternalUserRole {
  return (INTERNAL_USER_ROLES as readonly UserRole[]).includes(role);
}

export function isExternalRole(role: UserRole): role is ExternalUserRole {
  return (EXTERNAL_USER_ROLES as readonly UserRole[]).includes(role);
}

export function roleHasAuthority(
  role: UserRole,
  authority: AuthorityCategory,
  scope: RolePermissionScope,
): boolean {
  return PLATFORM_ROLE_DEFINITIONS[role].authorities.some(
    (grant) => grant.authority === authority && grant.scope === scope,
  );
}

export function roleHasAnyAuthority(
  role: UserRole,
  authority: AuthorityCategory,
  scopes: readonly RolePermissionScope[],
): boolean {
  return scopes.some((scope) => roleHasAuthority(role, authority, scope));
}

export function roleCanAccessEntity(
  role: UserRole,
  entity: PermissionEntity,
  authority: AuthorityCategory,
): boolean {
  return (ROLE_PERMISSION_MATRIX[entity][authority] as readonly UserRole[]).includes(
    role,
  );
}

export function getRolesForEntityAction(
  entity: PermissionEntity,
  authority: AuthorityCategory,
): readonly UserRole[] {
  return ROLE_PERMISSION_MATRIX[entity][authority];
}
