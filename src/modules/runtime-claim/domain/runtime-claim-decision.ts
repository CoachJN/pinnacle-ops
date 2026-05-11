import type { RuntimeBackpressureState } from "@/modules/runtime-capacity";

export interface RuntimeClaimDecision {
  tenantId: string;
  organizationId: string;
  fairnessWeight: number;
  allocatorWindowId: string;
  shardId: string;
  pressureState: RuntimeBackpressureState;
  quotaHeadroom: number;
  replayPressure: number;
  providerPressure: "normal" | "throttled" | "isolated";
  claimDecisionReason: string | null;
  grantedClaims: number;
  effectiveWeight: number;
  oldestQueueWaitMs: number;
  starvationPrevented: boolean;
}
