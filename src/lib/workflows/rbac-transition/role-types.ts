export const PLATFORM_ROLES = {
  Coordinator: "COORDINATOR",
  Manager: "MANAGER",
  FinanceAdmin: "FINANCE_ADMIN",
  Owner: "OWNER",
  ClientUser: "CLIENT_USER",
  ContractorUser: "CONTRACTOR_USER",
} as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES];

export const PLATFORM_ROLE_VALUES = Object.values(
  PLATFORM_ROLES,
) as readonly PlatformRole[];

export const TRANSITION_ACTOR_TYPES = {
  User: "USER",
  System: "SYSTEM",
} as const;

export type TransitionActorType =
  (typeof TRANSITION_ACTOR_TYPES)[keyof typeof TRANSITION_ACTOR_TYPES];

export const TRANSITION_ACTOR_TYPE_VALUES = Object.values(
  TRANSITION_ACTOR_TYPES,
) as readonly TransitionActorType[];
