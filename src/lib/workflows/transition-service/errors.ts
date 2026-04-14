import type {
  LifecycleEntityType,
  TransitionApplyFailure,
  TransitionApplyFailureCode,
} from "./types.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";

export function transitionApplyFailure<TLifecycle extends TransitionLifecycle>(
  failureCode: TransitionApplyFailureCode,
  input: {
    readonly lifecycle: TLifecycle;
    readonly entityType: LifecycleEntityType;
    readonly entityId: string;
    readonly from?: string | null;
    readonly to?: string | null;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  },
): TransitionApplyFailure<TLifecycle> {
  return {
    ok: false,
    failureCode,
    lifecycle: input.lifecycle,
    entityType: input.entityType,
    entityId: input.entityId,
    from: input.from,
    to: input.to,
    message: input.message,
    details: input.details,
  };
}
