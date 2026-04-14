import { USER_ROLES } from "../../../types/permissions.ts";
import { type TransitionLifecycle } from "../transition-engine/index.ts";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_VALUES,
  TRANSITION_ACTOR_TYPE_VALUES,
  type PlatformRole,
  type TransitionActorType,
} from "./role-types.ts";

export type NormalizationResult<TValue extends string, TFailureCode extends string> =
  | { readonly ok: true; readonly value: TValue; readonly original: string }
  | {
      readonly ok: false;
      readonly value: null;
      readonly original: string | null | undefined;
      readonly failureCode: TFailureCode;
      readonly message: string;
    };

const legacyRoleMap = {
  [USER_ROLES.Coordinator]: PLATFORM_ROLES.Coordinator,
  [USER_ROLES.Manager]: PLATFORM_ROLES.Manager,
  [USER_ROLES.FinanceAdmin]: PLATFORM_ROLES.FinanceAdmin,
  [USER_ROLES.Owner]: PLATFORM_ROLES.Owner,
  [USER_ROLES.ClientUser]: PLATFORM_ROLES.ClientUser,
  [USER_ROLES.ContractorUser]: PLATFORM_ROLES.ContractorUser,
} as const;

const legacyRoleLookup: Readonly<Record<string, PlatformRole>> = legacyRoleMap;

const lifecycleMap = {
  "work-order": "work-order",
  work_order: "work-order",
  WORK_ORDER: "work-order",
  quote: "quote",
  QUOTE: "quote",
  invoice: "invoice",
  INVOICE: "invoice",
} as const;

const lifecycleLookup: Readonly<Record<string, TransitionLifecycle>> = lifecycleMap;

export function normalizePlatformRole(
  value: PlatformRole | string | null | undefined,
): NormalizationResult<PlatformRole, "INVALID_ROLE"> {
  if (typeof value !== "string" || value.length === 0) {
    return {
      ok: false,
      value: null,
      original: value,
      failureCode: "INVALID_ROLE",
      message: "USER actor transitions require a platform role.",
    };
  }

  if ((PLATFORM_ROLE_VALUES as readonly string[]).includes(value)) {
    return { ok: true, value: value as PlatformRole, original: value };
  }

  const legacyRole = legacyRoleLookup[value];
  if (legacyRole) {
    return { ok: true, value: legacyRole, original: value };
  }

  return {
    ok: false,
    value: null,
    original: value,
    failureCode: "INVALID_ROLE",
    message: `${value} is not a recognized platform role.`,
  };
}

export function normalizeActorType(
  value: TransitionActorType | string | null | undefined,
): NormalizationResult<TransitionActorType, "INVALID_ACTOR_TYPE"> {
  if (typeof value !== "string" || value.length === 0) {
    return {
      ok: false,
      value: null,
      original: value,
      failureCode: "INVALID_ACTOR_TYPE",
      message: "Transition actor type is required.",
    };
  }

  if ((TRANSITION_ACTOR_TYPE_VALUES as readonly string[]).includes(value)) {
    return { ok: true, value: value as TransitionActorType, original: value };
  }

  return {
    ok: false,
    value: null,
    original: value,
    failureCode: "INVALID_ACTOR_TYPE",
    message: `${value} is not a recognized transition actor type.`,
  };
}

export function normalizeTransitionLifecycle(
  value: TransitionLifecycle | string,
): NormalizationResult<TransitionLifecycle, "STATUS_MODEL_MISMATCH"> {
  const lifecycle = lifecycleLookup[value];
  if (lifecycle) {
    return { ok: true, value: lifecycle, original: value };
  }

  return {
    ok: false,
    value: null,
    original: value,
    failureCode: "STATUS_MODEL_MISMATCH",
    message: `${value} is not a supported transition lifecycle.`,
  };
}
