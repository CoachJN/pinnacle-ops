export const APP_ROLES = {
  Coordinator: "coordinator",
  Manager: "manager",
  FinanceAdmin: "finance_admin",
  Owner: "owner",
  ClientUser: "client_user",
  ContractorUser: "contractor_user",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export const APP_ROLE_VALUES = Object.values(APP_ROLES) as readonly AppRole[];

export const INTERNAL_APP_ROLES = [
  APP_ROLES.Coordinator,
  APP_ROLES.Manager,
  APP_ROLES.FinanceAdmin,
  APP_ROLES.Owner,
] as const satisfies readonly AppRole[];

export const EXTERNAL_APP_ROLES = [
  APP_ROLES.ClientUser,
  APP_ROLES.ContractorUser,
] as const satisfies readonly AppRole[];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  [APP_ROLES.Coordinator]: "Coordinator",
  [APP_ROLES.Manager]: "Manager",
  [APP_ROLES.FinanceAdmin]: "Finance Admin",
  [APP_ROLES.Owner]: "Owner",
  [APP_ROLES.ClientUser]: "Client User",
  [APP_ROLES.ContractorUser]: "Contractor User",
};
