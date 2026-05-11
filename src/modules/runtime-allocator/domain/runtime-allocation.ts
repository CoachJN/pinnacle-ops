import type { IsoDateTimeString } from "@/types/entity";

export const RUNTIME_ALLOCATION_STATUSES = {
  Planned: "planned",
  Claimed: "claimed",
} as const;

export type RuntimeAllocationStatus =
  (typeof RUNTIME_ALLOCATION_STATUSES)[keyof typeof RUNTIME_ALLOCATION_STATUSES];

export interface RuntimeAllocationDecision {
  organizationId: string;
  tenantId: string;
  shardId: string;
  grantedClaims: number;
  fairnessShare: number;
  effectiveWeight: number;
  oldestQueueWaitMs: number;
  starvationPrevented: boolean;
  replayStormIsolated: boolean;
  providerPressureLevel: "normal" | "throttled" | "isolated";
  reason: string | null;
}

export interface RuntimeAllocationRecord {
  id: string;
  allocationKey: string;
  allocatorId: string;
  shardId: string;
  workerPoolId: string;
  workerId: string;
  status: RuntimeAllocationStatus;
  windowStartedAt: IsoDateTimeString;
  windowEndsAt: IsoDateTimeString;
  totalCapacity: number;
  grantedCapacity: number;
  claimedCapacity: number;
  decisions: readonly RuntimeAllocationDecision[];
  claimedJobIds: readonly string[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
