import type { WorkerJob } from "@/modules/runtime";
import type { RuntimeClaimDecision } from "./runtime-claim-decision";

export const RUNTIME_CLAIM_WINDOW_STATUSES = {
  Planned: "planned",
  Materialized: "materialized",
  Noop: "noop",
  Recovered: "recovered",
} as const;

export type RuntimeClaimWindowStatus =
  (typeof RUNTIME_CLAIM_WINDOW_STATUSES)[keyof typeof RUNTIME_CLAIM_WINDOW_STATUSES];

export interface RuntimeClaimWindow {
  id: string;
  windowKey: string;
  allocatorId: string;
  allocatorWindowId: string;
  shardId: string;
  workerPoolId: string;
  workerId: string;
  tenantId: string;
  organizationId: string;
  status: RuntimeClaimWindowStatus;
  decision: RuntimeClaimDecision;
  plannedClaims: number;
  claimedCount: number;
  noopCount: number;
  skippedCount: number;
  claimedJobIds: readonly string[];
  claimedJobs: readonly Pick<WorkerJob, "id" | "type" | "status" | "runAfter" | "attemptCount">[];
  createdAt: string;
  updatedAt: string;
}
