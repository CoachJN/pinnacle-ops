import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { UserRole } from "@/types/permissions";
import type { RuntimeRepairActionType } from "@/modules/operations";

export const OPERATOR_GUARDRAIL_RISK_LEVELS = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type OperatorGuardrailRiskLevel =
  (typeof OPERATOR_GUARDRAIL_RISK_LEVELS)[keyof typeof OPERATOR_GUARDRAIL_RISK_LEVELS];

export interface OperatorGuardrailPolicy {
  actionType: RuntimeRepairActionType;
  riskLevel: OperatorGuardrailRiskLevel;
  maxBatchSize: number;
  confirmationRequired: boolean;
  reasonRequired: boolean;
  dryRunSupported: boolean;
}

export const REPAIR_CONFIRMATION_STATUSES = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
  Executed: "executed",
  Expired: "expired",
} as const;

export type RepairConfirmationStatus =
  (typeof REPAIR_CONFIRMATION_STATUSES)[keyof typeof REPAIR_CONFIRMATION_STATUSES];

export interface RepairConfirmation {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  repairActionId: EntityId;
  actionType: RuntimeRepairActionType;
  targetIds: readonly EntityId[];
  riskLevel: OperatorGuardrailRiskLevel;
  status: RepairConfirmationStatus;
  confirmationRequired: boolean;
  reasonRequired: boolean;
  dryRun: boolean;
  requestedByUserId: EntityId;
  requestedByRole: UserRole | "system";
  approvedByUserId: EntityId | null;
  approvedByRole: UserRole | "system" | null;
  reason: string | null;
  createdAt: IsoDateTimeString;
  approvedAt: IsoDateTimeString | null;
  executedAt: IsoDateTimeString | null;
  expiresAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
