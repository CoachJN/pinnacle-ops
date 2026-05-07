import type { WorkerDeadLetterRecord, WorkerJob } from "./worker-job";

export const WORKER_EXECUTION_OUTCOMES = {
  Succeeded: "succeeded",
  RetryScheduled: "retry_scheduled",
  DeadLettered: "dead_lettered",
  Cancelled: "cancelled",
  NoopDuplicate: "noop_duplicate",
} as const;

export type WorkerExecutionOutcome =
  (typeof WORKER_EXECUTION_OUTCOMES)[keyof typeof WORKER_EXECUTION_OUTCOMES];

export interface WorkerExecutionResult {
  outcome: WorkerExecutionOutcome;
  job: WorkerJob;
  deadLetterRecord: WorkerDeadLetterRecord | null;
}
