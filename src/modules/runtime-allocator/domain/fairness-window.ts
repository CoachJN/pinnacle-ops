import type { TenantRuntimeQuota } from "@/modules/runtime-capacity";
import type { RuntimeBackpressureEvaluation } from "@/modules/runtime-capacity";
import type { IsoDateTimeString } from "@/types/entity";

export interface FairnessWindowTenantState {
  organizationId: string;
  tenantId: string;
  shardId: string;
  queuedReadyJobs: number;
  queuedJobs: number;
  activeJobs: number;
  retryableFailuresInWindow: number;
  replayQueuedJobs: number;
  providerPressureLevel: "normal" | "throttled" | "isolated";
  quota: TenantRuntimeQuota;
  backpressure: RuntimeBackpressureEvaluation;
  oldestQueuedAt: IsoDateTimeString | null;
  oldestQueueWaitMs: number;
  requestedClaims: number;
  effectiveWeight: number;
  starvationBoost: number;
  pressurePenalty: number;
  reasons: readonly string[];
}

export interface FairnessWindow {
  id: string;
  startedAt: IsoDateTimeString;
  endsAt: IsoDateTimeString;
  shardId: string;
  totalCapacity: number;
  unallocatedCapacity: number;
  starvationThresholdMs: number;
  tenants: readonly FairnessWindowTenantState[];
}
