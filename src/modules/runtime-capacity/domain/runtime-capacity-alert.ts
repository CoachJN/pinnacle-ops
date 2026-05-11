import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const RUNTIME_CAPACITY_ALERT_SEVERITIES = {
  Info: "info",
  Warning: "warning",
  Critical: "critical",
} as const;

export type RuntimeCapacityAlertSeverity =
  (typeof RUNTIME_CAPACITY_ALERT_SEVERITIES)[keyof typeof RUNTIME_CAPACITY_ALERT_SEVERITIES];

export interface RuntimeCapacityAlert {
  id: string;
  organizationId: EntityId;
  tenantId: EntityId;
  severity: RuntimeCapacityAlertSeverity;
  category:
    | "quota"
    | "fairness"
    | "backpressure"
    | "provider_isolation"
    | "retention"
    | "observability";
  summary: string;
  observedAt: IsoDateTimeString;
  dimensions: Record<string, string | number | boolean | null>;
}
