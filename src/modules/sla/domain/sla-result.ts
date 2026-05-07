import type { EntityId } from "@/types/entity";
import type { DomainEvent } from "@/server/events/types";
import type { SlaTimer } from "./sla-timer";

export const SLA_EVALUATION_OUTCOMES = {
  NoopDuplicate: "noop_duplicate",
  NoopStale: "noop_stale",
  Satisfied: "satisfied",
  Breached: "breached",
  Failed: "failed",
} as const;

export type SlaEvaluationOutcome =
  (typeof SLA_EVALUATION_OUTCOMES)[keyof typeof SLA_EVALUATION_OUTCOMES];

export interface SlaEvaluationResult {
  outcome: SlaEvaluationOutcome;
  timer: SlaTimer;
  emittedEvent: DomainEvent<"sla_timer_breached" | "sla_timer_satisfied"> | null;
  message: string;
}

export interface SlaScheduleResult {
  timer: SlaTimer | null;
  runtimeJobId: EntityId | null;
  createdTimer: boolean;
  queuedJob: boolean;
}
