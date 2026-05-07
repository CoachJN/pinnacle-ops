import type { IsoDateTimeString } from "@/types/entity";

export const RUNTIME_HEALTH_STATUSES = {
  Healthy: "healthy",
  Degraded: "degraded",
  Critical: "critical",
} as const;

export type RuntimeHealthStatus =
  (typeof RUNTIME_HEALTH_STATUSES)[keyof typeof RUNTIME_HEALTH_STATUSES];

export interface RuntimeHealthIndicator {
  code: string;
  severity: "warning" | "critical";
  message: string;
  metricValue: number;
  threshold: number;
}

export interface RuntimeHealth {
  status: RuntimeHealthStatus;
  evaluatedAt: IsoDateTimeString;
  indicators: readonly RuntimeHealthIndicator[];
}
