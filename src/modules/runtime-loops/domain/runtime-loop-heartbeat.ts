import type { RuntimeLoopType } from "./runtime-loop";

export const RUNTIME_LOOP_HEARTBEAT_HEALTH = {
  Healthy: "healthy",
  Expired: "expired",
  Missing: "missing",
} as const;

export type RuntimeLoopHeartbeatHealth =
  (typeof RUNTIME_LOOP_HEARTBEAT_HEALTH)[keyof typeof RUNTIME_LOOP_HEARTBEAT_HEALTH];

export interface RuntimeLoopHeartbeat {
  loopType: RuntimeLoopType;
  leaseOwner: string | null;
  heartbeatAt: string | null;
  leaseExpiresAt: string | null;
  health: RuntimeLoopHeartbeatHealth;
}

export const RUNTIME_LOOP_EVENT_KINDS = {
  Failover: "failover",
  DrainRequested: "drain_requested",
  DrainReleased: "drain_released",
  PauseRequested: "pause_requested",
  PauseReleased: "pause_released",
} as const;

export type RuntimeLoopEventKind =
  (typeof RUNTIME_LOOP_EVENT_KINDS)[keyof typeof RUNTIME_LOOP_EVENT_KINDS];

export interface RuntimeLoopEvent {
  id: string;
  organizationId: string;
  loopType: RuntimeLoopType | "runtime.control";
  eventKind: RuntimeLoopEventKind;
  leaseOwner: string | null;
  previousLeaseOwner: string | null;
  detectedAt: string;
  correlationId: string;
  details: Record<string, unknown>;
}
