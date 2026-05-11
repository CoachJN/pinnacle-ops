export const RUNTIME_BACKPRESSURE_STATES = {
  Normal: "normal",
  Throttled: "throttled",
  Degraded: "degraded",
  Emergency: "emergency",
} as const;

export type RuntimeBackpressureState =
  (typeof RUNTIME_BACKPRESSURE_STATES)[keyof typeof RUNTIME_BACKPRESSURE_STATES];

export interface RuntimeBackpressureDirective {
  claimBatchLimitFactor: number;
  schedulerTaskLimitFactor: number;
  replayAllowed: boolean;
  repairAllowed: boolean;
  retrySuppressed: boolean;
  queuePause: boolean;
}

export interface RuntimeBackpressureEvaluation {
  state: RuntimeBackpressureState;
  reasons: readonly string[];
  directive: RuntimeBackpressureDirective;
}
