import "server-only";

import { RUNTIME_REPAIR_ACTION_TYPES, type RuntimeRepairActionType } from "@/modules/operations";
import type { RuntimeRepairAction } from "@/modules/operations";
import { serviceFail, serviceOk, type ServiceActor, type ServiceResult } from "@/server/services";
import { conflictError, notFoundError, validationError } from "@/server/services/errors";
import {
  OPERATOR_GUARDRAIL_RISK_LEVELS,
  REPAIR_CONFIRMATION_STATUSES,
  type OperatorGuardrailPolicy,
  type RepairConfirmation,
} from "../domain/operator-guardrail";
import type { SchedulerRepositories } from "./scheduler-task-repository";

const DEFAULT_CONFIRMATION_TTL_MS = 30 * 60 * 1000;

const DEFAULT_GUARDRAIL_POLICIES: readonly OperatorGuardrailPolicy[] = [
  {
    actionType: RUNTIME_REPAIR_ACTION_TYPES.DeadLetterReplay,
    riskLevel: OPERATOR_GUARDRAIL_RISK_LEVELS.High,
    maxBatchSize: 10,
    confirmationRequired: true,
    reasonRequired: true,
    dryRunSupported: true,
  },
  {
    actionType: RUNTIME_REPAIR_ACTION_TYPES.StuckRuntimeRequeue,
    riskLevel: OPERATOR_GUARDRAIL_RISK_LEVELS.Low,
    maxBatchSize: 25,
    confirmationRequired: false,
    reasonRequired: false,
    dryRunSupported: true,
  },
  {
    actionType: RUNTIME_REPAIR_ACTION_TYPES.EventReplayRetry,
    riskLevel: OPERATOR_GUARDRAIL_RISK_LEVELS.High,
    maxBatchSize: 5,
    confirmationRequired: true,
    reasonRequired: true,
    dryRunSupported: true,
  },
  {
    actionType: RUNTIME_REPAIR_ACTION_TYPES.ProviderReconciliationRetry,
    riskLevel: OPERATOR_GUARDRAIL_RISK_LEVELS.Medium,
    maxBatchSize: 20,
    confirmationRequired: false,
    reasonRequired: true,
    dryRunSupported: true,
  },
  {
    actionType: RUNTIME_REPAIR_ACTION_TYPES.DeliveryRetryReset,
    riskLevel: OPERATOR_GUARDRAIL_RISK_LEVELS.Medium,
    maxBatchSize: 10,
    confirmationRequired: false,
    reasonRequired: true,
    dryRunSupported: true,
  },
] as const;

export interface OperatorGuardrailService {
  getPolicy(actionType: RuntimeRepairActionType): OperatorGuardrailPolicy;
  validateRequest(input: {
    actionType: RuntimeRepairActionType;
    batchSize: number;
    reason?: string | null;
    dryRun?: boolean;
  }): ServiceResult<OperatorGuardrailPolicy>;
  ensureConfirmation(input: {
    action: RuntimeRepairAction;
    actor: ServiceActor;
    targetIds: readonly string[];
    reason?: string | null;
    dryRun: boolean;
    now: string;
  }): Promise<ServiceResult<RepairConfirmation>>;
  approveConfirmation(input: {
    organizationId: string;
    confirmationId: string;
    actor: ServiceActor;
    reason?: string | null;
    now: string;
  }): Promise<ServiceResult<RepairConfirmation>>;
}

export function createOperatorGuardrailService(
  repositories: Pick<SchedulerRepositories, "confirmations">,
): OperatorGuardrailService {
  return {
    getPolicy(actionType) {
      const policy = DEFAULT_GUARDRAIL_POLICIES.find((item) => item.actionType === actionType);
      if (!policy) {
        throw new Error(`Unsupported guardrail action type: ${actionType}`);
      }
      return policy;
    },
    validateRequest(input) {
      const policy = this.getPolicy(input.actionType);
      if (input.batchSize <= 0 || input.batchSize > policy.maxBatchSize) {
        return serviceFail(
          validationError(
            `Batch size exceeds guardrail max of ${policy.maxBatchSize} for ${input.actionType}.`,
          ),
        );
      }
      if (policy.reasonRequired && (!input.reason || input.reason.trim().length === 0)) {
        return serviceFail(validationError("A reason is required for this repair action."));
      }
      if (input.dryRun && !policy.dryRunSupported) {
        return serviceFail(validationError("Dry-run is not supported for this repair action."));
      }
      return serviceOk(policy);
    },
    async ensureConfirmation(input) {
      const existing = await repositories.confirmations.findPendingByRepairActionId({
        organizationId: input.action.organizationId,
        repairActionId: input.action.id,
      });
      if (existing) {
        return serviceOk(existing);
      }

      const policy = this.getPolicy(input.action.actionType);
      const confirmation: RepairConfirmation = {
        id: repositories.confirmations.newId(),
        organizationId: input.action.organizationId,
        tenantId: input.action.tenantId,
        repairActionId: input.action.id,
        actionType: input.action.actionType,
        targetIds: [...input.targetIds],
        riskLevel: policy.riskLevel,
        status: REPAIR_CONFIRMATION_STATUSES.Pending,
        confirmationRequired: true,
        reasonRequired: policy.reasonRequired,
        dryRun: input.dryRun,
        requestedByUserId: input.actor.userId,
        requestedByRole: input.actor.role,
        approvedByUserId: null,
        approvedByRole: null,
        reason: input.reason?.trim() || null,
        createdAt: input.now,
        approvedAt: null,
        executedAt: null,
        expiresAt: new Date(Date.parse(input.now) + DEFAULT_CONFIRMATION_TTL_MS).toISOString(),
        updatedAt: input.now,
      };
      await repositories.confirmations.create(confirmation);
      return serviceOk(confirmation);
    },
    async approveConfirmation(input) {
      const confirmation = await repositories.confirmations.getById(input.confirmationId);
      if (!confirmation || confirmation.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Repair confirmation not found."));
      }
      if (confirmation.status === REPAIR_CONFIRMATION_STATUSES.Executed) {
        return serviceOk(confirmation);
      }
      if (confirmation.status !== REPAIR_CONFIRMATION_STATUSES.Pending) {
        return serviceFail(conflictError("Repair confirmation is no longer pending."));
      }
      if (confirmation.expiresAt <= input.now) {
        const expired = await repositories.confirmations.save({
          ...confirmation,
          status: REPAIR_CONFIRMATION_STATUSES.Expired,
          updatedAt: input.now,
        });
        return serviceFail(conflictError("Repair confirmation expired before approval."));
      }
      if (confirmation.reasonRequired && (!input.reason || input.reason.trim().length === 0)) {
        return serviceFail(validationError("Approval reason is required for this repair action."));
      }

      const approved = await repositories.confirmations.save({
        ...confirmation,
        status: REPAIR_CONFIRMATION_STATUSES.Approved,
        approvedByUserId: input.actor.userId,
        approvedByRole: input.actor.role,
        reason: input.reason?.trim() || confirmation.reason,
        approvedAt: input.now,
        updatedAt: input.now,
      });
      return serviceOk(approved);
    },
  };
}
