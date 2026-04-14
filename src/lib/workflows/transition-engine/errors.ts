import type {
  TransitionFailureCode,
  TransitionLifecycle,
  TransitionValidationDetails,
  TransitionValidationFailure,
  TransitionValidationSuccess,
} from "./types.ts";

interface TransitionResultInput<
  TLifecycle extends TransitionLifecycle,
  TStatus extends string,
> {
  readonly lifecycle: TLifecycle;
  readonly from: string | null | undefined;
  readonly to: string | null | undefined;
  readonly normalizedFrom?: TStatus;
  readonly normalizedTo?: TStatus;
  readonly currentStatusTerminal?: boolean;
  readonly message: string;
  readonly details?: TransitionValidationDetails;
}

export function transitionSuccess<
  TLifecycle extends TransitionLifecycle,
  TStatus extends string,
>(
  input: TransitionResultInput<TLifecycle, TStatus>,
): TransitionValidationSuccess<TLifecycle, TStatus> {
  return {
    ok: true,
    currentStatusTerminal: input.currentStatusTerminal ?? false,
    ...input,
  };
}

export function transitionFailure<
  TLifecycle extends TransitionLifecycle,
  TStatus extends string,
>(
  failureCode: TransitionFailureCode,
  input: TransitionResultInput<TLifecycle, TStatus>,
): TransitionValidationFailure<TLifecycle, TStatus> {
  return {
    ok: false,
    failureCode,
    currentStatusTerminal: input.currentStatusTerminal ?? false,
    ...input,
  };
}
