import type { EntityId } from "@/types/entity";
import type {
  TransitionContextByLifecycle,
  TransitionLifecycle,
  TransitionStatusByLifecycle,
  TransitionValidationResult,
} from "../transition-engine/index.ts";
import type {
  PlatformRole,
  TransitionActorType,
  TransitionAuthorizationResult,
} from "../rbac-transition/index.ts";
import type { TransitionSideEffectWarning } from "../audit/index.ts";
import type { LifecycleTransitionRepositories } from "./repositories.ts";

export type LifecycleEntityType = "work-order" | "invoice" | "quote";

export type TransitionApplyFailureCode =
  | "ENTITY_NOT_FOUND"
  | "INVALID_ENTITY_TYPE"
  | "VALIDATION_FAILED"
  | "AUTHORIZATION_FAILED"
  | "PERSISTENCE_FAILED"
  | "STATUS_MODEL_MISMATCH"
  | "UNSUPPORTED_RUNTIME_PATH";

export interface ApplyLifecycleTransitionInput<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
> {
  readonly lifecycle: TLifecycle;
  readonly entityType: LifecycleEntityType;
  readonly entityId: EntityId;
  readonly to: TransitionStatusByLifecycle[TLifecycle] | string;
  readonly actorType: TransitionActorType | string;
  readonly role?: PlatformRole | string | null;
  readonly actorUserId?: EntityId;
  readonly contextOverrides?: Partial<TransitionContextByLifecycle[TLifecycle]>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly repositories?: LifecycleTransitionRepositories;
}

interface TransitionApplyBase<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
> {
  readonly ok: boolean;
  readonly lifecycle: TLifecycle;
  readonly entityType: LifecycleEntityType;
  readonly entityId: EntityId;
  readonly from: string | null | undefined;
  readonly to: string | null | undefined;
  readonly persistedStatus?: string;
  readonly message: string;
  readonly validationResult?: TransitionValidationResult<TLifecycle>;
  readonly authorizationResult?: TransitionAuthorizationResult;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly sideEffectWarnings?: readonly TransitionSideEffectWarning[];
}

export interface TransitionApplySuccess<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
> extends TransitionApplyBase<TLifecycle> {
  readonly ok: true;
  readonly from: TransitionStatusByLifecycle[TLifecycle];
  readonly to: TransitionStatusByLifecycle[TLifecycle];
  readonly persistedStatus: TransitionStatusByLifecycle[TLifecycle];
  readonly failureCode?: never;
}

export interface TransitionApplyFailure<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
> extends TransitionApplyBase<TLifecycle> {
  readonly ok: false;
  readonly failureCode: TransitionApplyFailureCode;
}

export type TransitionApplyResult<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
> = TransitionApplySuccess<TLifecycle> | TransitionApplyFailure<TLifecycle>;

export interface TransitionUpdateMetadata {
  readonly actorType: TransitionActorType | string;
  readonly actorUserId?: EntityId;
  readonly role?: PlatformRole | string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
