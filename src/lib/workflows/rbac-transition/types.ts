import type {
  TransitionContextByLifecycle,
  TransitionLifecycle,
} from "../transition-engine/index.ts";
import type { PlatformRole, TransitionActorType } from "./role-types.ts";

export type AuthorizationFailureCode =
  | "INVALID_ROLE"
  | "INVALID_ACTOR_TYPE"
  | "ROLE_NOT_PERMITTED"
  | "SYSTEM_ONLY_TRANSITION"
  | "LIFECYCLE_VALIDATION_FAILED"
  | "STATUS_MODEL_MISMATCH";

export type TransitionAuthorizationDetails = Readonly<Record<string, unknown>>;

interface TransitionAuthorizationBase {
  readonly ok: boolean;
  readonly lifecycle: TransitionLifecycle | string;
  readonly from: string | null | undefined;
  readonly to: string | null | undefined;
  readonly normalizedFrom?: string;
  readonly normalizedTo?: string;
  readonly actorType: TransitionActorType | string | null | undefined;
  readonly role?: PlatformRole | string | null;
  readonly message: string;
  readonly details?: TransitionAuthorizationDetails;
}

export interface TransitionAuthorizationSuccess extends TransitionAuthorizationBase {
  readonly ok: true;
  readonly lifecycle: TransitionLifecycle;
  readonly actorType: TransitionActorType;
  readonly role?: PlatformRole;
  readonly failureCode?: never;
}

export interface TransitionAuthorizationFailure extends TransitionAuthorizationBase {
  readonly ok: false;
  readonly failureCode: AuthorizationFailureCode;
}

export type TransitionAuthorizationResult =
  | TransitionAuthorizationSuccess
  | TransitionAuthorizationFailure;

export type LifecycleTransitionAuthorizationInput<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
> = {
  readonly lifecycle: TLifecycle | string;
  readonly from: string | null | undefined;
  readonly to: string | null | undefined;
  readonly actorType: TransitionActorType | string | null | undefined;
  readonly role?: PlatformRole | string | null;
  readonly context?: TLifecycle extends TransitionLifecycle
    ? TransitionContextByLifecycle[TLifecycle]
    : never;
};

export type RoleTransitionAuthorizationInput<TStatus extends string> = {
  readonly from: TStatus;
  readonly to: TStatus;
  readonly actorType: TransitionActorType;
  readonly role?: PlatformRole;
};

export type RoleTransitionAuthorizationDecision = {
  readonly allowed: boolean;
  readonly failureCode?: Extract<
    AuthorizationFailureCode,
    "ROLE_NOT_PERMITTED" | "SYSTEM_ONLY_TRANSITION"
  >;
  readonly message: string;
  readonly details?: TransitionAuthorizationDetails;
};
