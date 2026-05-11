import type { RuntimeLoopType } from "./runtime-loop";

export const RUNTIME_LOOP_RUN_STATUSES = {
  Succeeded: "succeeded",
  Skipped: "skipped",
  Failed: "failed",
  Noop: "noop",
} as const;

export type RuntimeLoopRunStatus =
  (typeof RUNTIME_LOOP_RUN_STATUSES)[keyof typeof RUNTIME_LOOP_RUN_STATUSES];

export interface RuntimeLoopResult {
  id: string;
  organizationId: string;
  loopType: RuntimeLoopType;
  status: RuntimeLoopRunStatus;
  leaseOwner: string | null;
  runStartedAt: string;
  runCompletedAt: string;
  cadenceLagMs: number;
  processedCount: number;
  enqueuedCount: number;
  claimedCount: number;
  duplicateCount: number;
  replayNoopCount: number;
  correlationId: string;
  message: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
