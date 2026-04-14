import type {
  InvoiceLifecycleStatus,
  QuoteLifecycleStatus,
  WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";

export type TransitionLifecycle = "work-order" | "quote" | "invoice";

export type TransitionStatusByLifecycle = {
  "work-order": WorkOrderLifecycleStatus;
  quote: QuoteLifecycleStatus;
  invoice: InvoiceLifecycleStatus;
};

export type TransitionFailureCode =
  | "INVALID_LIFECYCLE"
  | "UNKNOWN_STATUS"
  | "TERMINAL_STATE"
  | "INVALID_TRANSITION"
  | "DEPENDENCY_FAILED"
  | "STATUS_MODEL_MISMATCH";

export type TransitionValidationDetails = Readonly<Record<string, unknown>>;

export interface WorkOrderTransitionContext {
  readonly quoteRequired?: boolean;
  readonly quoteStatus?: QuoteLifecycleStatus | string | null;
}

export type QuoteTransitionContext = Readonly<Record<string, never>>;

export interface InvoiceTransitionContext {
  readonly workOrderStatus?: WorkOrderLifecycleStatus | string | null;
}

export type TransitionContextByLifecycle = {
  "work-order": WorkOrderTransitionContext;
  quote: QuoteTransitionContext;
  invoice: InvoiceTransitionContext;
};

export interface TransitionValidationInput<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
> {
  readonly lifecycle: TLifecycle | string;
  readonly from: string | null | undefined;
  readonly to: string | null | undefined;
  readonly context?: TLifecycle extends TransitionLifecycle
    ? TransitionContextByLifecycle[TLifecycle]
    : never;
}

interface TransitionValidationBase<
  TLifecycle extends TransitionLifecycle,
  TStatus extends string,
> {
  readonly lifecycle: TLifecycle;
  readonly from: string | null | undefined;
  readonly to: string | null | undefined;
  readonly normalizedFrom?: TStatus;
  readonly normalizedTo?: TStatus;
  readonly currentStatusTerminal: boolean;
  readonly message: string;
  readonly details?: TransitionValidationDetails;
}

export interface TransitionValidationSuccess<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
  TStatus extends string = TransitionStatusByLifecycle[TLifecycle],
> extends TransitionValidationBase<TLifecycle, TStatus> {
  readonly ok: true;
  readonly failureCode?: never;
}

export interface TransitionValidationFailure<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
  TStatus extends string = TransitionStatusByLifecycle[TLifecycle],
> extends TransitionValidationBase<TLifecycle, TStatus> {
  readonly ok: false;
  readonly failureCode: TransitionFailureCode;
}

export type TransitionValidationResult<
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
  TStatus extends string = TransitionStatusByLifecycle[TLifecycle],
> =
  | TransitionValidationSuccess<TLifecycle, TStatus>
  | TransitionValidationFailure<TLifecycle, TStatus>;

export interface InvalidLifecycleTransitionValidationFailure {
  readonly ok: false;
  readonly lifecycle: string;
  readonly from: string | null | undefined;
  readonly to: string | null | undefined;
  readonly currentStatusTerminal: false;
  readonly failureCode: "INVALID_LIFECYCLE";
  readonly message: string;
  readonly details?: TransitionValidationDetails;
}

export type AnyTransitionValidationResult =
  | TransitionValidationResult
  | InvalidLifecycleTransitionValidationFailure;
