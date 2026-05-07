import "server-only";

import type { DeliveryPlan } from "@/modules/delivery";
import type { ProviderCorrelation } from "@/modules/provider-runtime/domain/provider-correlation";
import {
  PROVIDER_RECEIPT_NORMALIZED_STATUSES,
  type ProviderReceipt,
} from "@/modules/provider-runtime/domain/provider-receipt";
import type { ProviderReconciliationResult } from "@/modules/provider-runtime/domain/provider-reconciliation-result";
import type { ProviderReceiptRepository } from "@/modules/provider-runtime/server/provider-receipt-repository";
import type { DeliveryAttempt, TransportAttemptRepository } from "@/modules/transport";
import type { DomainEventService } from "@/server/services";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export interface ProviderReconciliationService {
  reconcileReceipt(input: {
    organizationId: EntityId;
    receiptId: EntityId;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<ProviderReconciliationResult>>;
}

export function createProviderReconciliationService(
  dependencies: {
    receipts: ProviderReceiptRepository;
    attempts: TransportAttemptRepository;
    getDeliveryPlanById: (id: EntityId) => Promise<DeliveryPlan | null>;
    saveDeliveryPlan: (plan: DeliveryPlan) => Promise<void>;
    domainEvents: DomainEventService;
  },
): ProviderReconciliationService {
  return {
    async reconcileReceipt(input) {
      const receipt = await dependencies.receipts.getById(input.receiptId);
      if (!receipt || receipt.organizationId !== input.organizationId) {
        return serviceOk({
          receiptId: input.receiptId,
          deliveryAttemptId: null,
          deliveryPlanId: null,
          status: "ignored_missing_attempt",
          previousAttemptStatus: null,
          nextAttemptStatus: null,
          retrySuppressed: false,
          processedAt: input.now,
          reason: "receipt_not_found",
        });
      }

      const correlation = await correlateReceipt(dependencies.attempts, receipt);
      if (!correlation.deliveryAttemptId || !correlation.deliveryPlanId) {
        await dependencies.receipts.save({
          ...receipt,
          deliveryAttemptId: null,
          deliveryPlanId: null,
          processedAt: input.now,
          reconciliationStatus: "ignored",
          reconciliationReason: "delivery_attempt_not_found",
          updatedAt: input.now,
        });
        return serviceOk({
          receiptId: receipt.id,
          deliveryAttemptId: null,
          deliveryPlanId: null,
          status: "ignored_missing_attempt",
          previousAttemptStatus: null,
          nextAttemptStatus: null,
          retrySuppressed: false,
          processedAt: input.now,
          reason: "delivery_attempt_not_found",
        });
      }

      const attempt = await dependencies.attempts.getById(correlation.deliveryAttemptId);
      if (!attempt || attempt.organizationId !== input.organizationId) {
        await dependencies.receipts.save({
          ...receipt,
          processedAt: input.now,
          reconciliationStatus: "ignored",
          reconciliationReason: "delivery_attempt_not_found",
          updatedAt: input.now,
        });
        return serviceOk({
          receiptId: receipt.id,
          deliveryAttemptId: correlation.deliveryAttemptId,
          deliveryPlanId: correlation.deliveryPlanId,
          status: "ignored_missing_attempt",
          previousAttemptStatus: null,
          nextAttemptStatus: null,
          retrySuppressed: false,
          processedAt: input.now,
          reason: "delivery_attempt_not_found",
        });
      }

      const plan = await dependencies.getDeliveryPlanById(correlation.deliveryPlanId);
      const previousStatus = attempt.status;
      const terminalOrder = rankReceiptStatus(receipt.normalizedStatus);
      const historicalReceipts = await dependencies.receipts.listByDeliveryAttemptId({
        organizationId: input.organizationId,
        deliveryAttemptId: attempt.id,
        limit: 50,
      });
      const mostAdvancedExisting = historicalReceipts
        .filter((item) => item.id !== receipt.id)
        .reduce<number>((highest, item) => Math.max(highest, rankReceiptStatus(item.normalizedStatus)), 0);

      if (terminalOrder < mostAdvancedExisting) {
        await dependencies.receipts.save({
          ...receipt,
          deliveryAttemptId: attempt.id,
          deliveryPlanId: attempt.deliveryPlanId,
          processedAt: input.now,
          reconciliationStatus: "ignored",
          reconciliationReason: "out_of_order_receipt",
          updatedAt: input.now,
        });
        await recordProviderReconciledEvent(dependencies.domainEvents, {
          receipt,
          attempt,
          now: input.now,
          outcome: "ignored_out_of_order",
          previousStatus,
          nextStatus: attempt.status,
          retrySuppressed: false,
          reason: "out_of_order_receipt",
        });
        return serviceOk({
          receiptId: receipt.id,
          deliveryAttemptId: attempt.id,
          deliveryPlanId: attempt.deliveryPlanId,
          status: "ignored_out_of_order",
          previousAttemptStatus: previousStatus,
          nextAttemptStatus: attempt.status,
          retrySuppressed: false,
          processedAt: input.now,
          reason: "out_of_order_receipt",
        });
      }

      const transition = applyReceiptToAttempt(attempt, receipt, input.now);
      const updatedAttempt = transition.attempt;
      await dependencies.attempts.save(updatedAttempt);

      if (plan) {
        const nextPlan = applyReceiptToPlan(plan, updatedAttempt, input.now);
        await dependencies.saveDeliveryPlan(nextPlan);
        if (nextPlan.status === "completed" && plan.status !== "completed") {
          await recordDeliveryCompleted(dependencies.domainEvents, nextPlan, input.now, receipt.normalizedStatus);
        }
      }

      await dependencies.receipts.save({
        ...receipt,
        deliveryAttemptId: updatedAttempt.id,
        deliveryPlanId: updatedAttempt.deliveryPlanId,
        processedAt: input.now,
        reconciliationStatus: transition.duplicate ? "duplicate" : "processed",
        reconciliationReason: transition.reason,
        updatedAt: input.now,
      });

      await recordTransportEventForReceipt(dependencies.domainEvents, {
        receipt,
        attempt: updatedAttempt,
        previousStatus,
        now: input.now,
        reason: transition.reason,
      });
      await recordProviderReconciledEvent(dependencies.domainEvents, {
        receipt,
        attempt: updatedAttempt,
        now: input.now,
        outcome: transition.duplicate ? "duplicate_noop" : "processed",
        previousStatus,
        nextStatus: updatedAttempt.status,
        retrySuppressed: transition.retrySuppressed,
        reason: transition.reason,
      });

      return serviceOk({
        receiptId: receipt.id,
        deliveryAttemptId: updatedAttempt.id,
        deliveryPlanId: updatedAttempt.deliveryPlanId,
        status: transition.duplicate ? "duplicate_noop" : "processed",
        previousAttemptStatus: previousStatus,
        nextAttemptStatus: updatedAttempt.status,
        retrySuppressed: transition.retrySuppressed,
        processedAt: input.now,
        reason: transition.reason,
      });
    },
  };
}

async function correlateReceipt(
  attempts: TransportAttemptRepository,
  receipt: ProviderReceipt,
): Promise<ProviderCorrelation> {
  if (receipt.deliveryAttemptId && receipt.deliveryPlanId) {
    return {
      deliveryAttemptId: receipt.deliveryAttemptId,
      deliveryPlanId: receipt.deliveryPlanId,
      correlatedBy: "delivery_attempt_id",
    };
  }

  const candidates = await attempts.listByOrganizationId(receipt.organizationId, { limit: 100 });
  const match = candidates.find((attempt) =>
    (receipt.providerReceiptId && attempt.providerReceiptId === receipt.providerReceiptId) ||
    (receipt.providerMessageId && attempt.providerMessageId === receipt.providerMessageId) ||
    (receipt.providerCorrelationId && attempt.providerCorrelationId === receipt.providerCorrelationId)
  );
  if (!match) {
    return {
      deliveryAttemptId: null,
      deliveryPlanId: null,
      correlatedBy: "unresolved",
    };
  }
  return {
    deliveryAttemptId: match.id,
    deliveryPlanId: match.deliveryPlanId,
    correlatedBy:
      receipt.providerReceiptId && match.providerReceiptId === receipt.providerReceiptId
        ? "provider_receipt_id"
        : receipt.providerMessageId && match.providerMessageId === receipt.providerMessageId
          ? "provider_message_id"
          : "provider_correlation_id",
  };
}

function applyReceiptToAttempt(
  attempt: DeliveryAttempt,
  receipt: ProviderReceipt,
  now: IsoDateTimeString,
): {
  attempt: DeliveryAttempt;
  duplicate: boolean;
  retrySuppressed: boolean;
  reason: string | null;
} {
  switch (receipt.normalizedStatus) {
    case PROVIDER_RECEIPT_NORMALIZED_STATUSES.Accepted:
    case PROVIDER_RECEIPT_NORMALIZED_STATUSES.Queued:
      if (attempt.status === "succeeded" || attempt.status === "failed") {
        return { attempt, duplicate: true, retrySuppressed: false, reason: "terminal_attempt_already_reached" };
      }
      return {
        attempt: {
          ...attempt,
          providerMessageId: receipt.providerMessageId ?? attempt.providerMessageId,
          providerCorrelationId: receipt.providerCorrelationId ?? attempt.providerCorrelationId,
          providerReceiptId: receipt.providerReceiptId ?? attempt.providerReceiptId,
          updatedAt: now,
        },
        duplicate: false,
        retrySuppressed: false,
        reason: "provider_pending",
      };
    case PROVIDER_RECEIPT_NORMALIZED_STATUSES.Delivered:
      if (attempt.status === "succeeded") {
        return { attempt, duplicate: true, retrySuppressed: false, reason: "already_succeeded" };
      }
      return {
        attempt: {
          ...attempt,
          status: "succeeded",
          providerMessageId: receipt.providerMessageId ?? attempt.providerMessageId,
          providerCorrelationId: receipt.providerCorrelationId ?? attempt.providerCorrelationId,
          providerReceiptId: receipt.providerReceiptId ?? attempt.providerReceiptId,
          nextRetryAt: null,
          executionCompletedAt: now,
          failureCode: null,
          failureReason: null,
          updatedAt: now,
        },
        duplicate: false,
        retrySuppressed: attempt.status === "retry_scheduled",
        reason: attempt.status === "retry_scheduled" ? "late_success_retry_suppressed" : "provider_delivered",
      };
    case PROVIDER_RECEIPT_NORMALIZED_STATUSES.Failed:
    case PROVIDER_RECEIPT_NORMALIZED_STATUSES.Bounced:
    case PROVIDER_RECEIPT_NORMALIZED_STATUSES.Rejected:
      if (attempt.status === "succeeded") {
        return { attempt, duplicate: true, retrySuppressed: false, reason: "already_succeeded" };
      }
      if (attempt.status === "failed") {
        return { attempt, duplicate: true, retrySuppressed: false, reason: "already_failed" };
      }
      return {
        attempt: {
          ...attempt,
          status: "failed",
          providerMessageId: receipt.providerMessageId ?? attempt.providerMessageId,
          providerCorrelationId: receipt.providerCorrelationId ?? attempt.providerCorrelationId,
          providerReceiptId: receipt.providerReceiptId ?? attempt.providerReceiptId,
          nextRetryAt: null,
          executionCompletedAt: now,
          failureCode: `provider_${receipt.normalizedStatus}`,
          failureReason: receipt.rawStatus ?? receipt.normalizedStatus,
          updatedAt: now,
        },
        duplicate: false,
        retrySuppressed: false,
        reason: `provider_${receipt.normalizedStatus}`,
      };
    case PROVIDER_RECEIPT_NORMALIZED_STATUSES.Unknown:
    default:
      return {
        attempt: {
          ...attempt,
          providerMessageId: receipt.providerMessageId ?? attempt.providerMessageId,
          providerCorrelationId: receipt.providerCorrelationId ?? attempt.providerCorrelationId,
          providerReceiptId: receipt.providerReceiptId ?? attempt.providerReceiptId,
          updatedAt: now,
        },
        duplicate: false,
        retrySuppressed: false,
        reason: "provider_unknown_status",
      };
  }
}

function applyReceiptToPlan(
  plan: DeliveryPlan,
  attempt: DeliveryAttempt,
  now: IsoDateTimeString,
): DeliveryPlan {
  switch (attempt.status) {
    case "succeeded":
      return {
        ...plan,
        status: "completed",
        activeRuntimeJobId: null,
        nextAttemptAt: null,
        retryCount: attempt.retryCount,
        updatedAt: now,
      };
    case "failed":
      return {
        ...plan,
        status: "failed",
        activeRuntimeJobId: null,
        nextAttemptAt: null,
        retryCount: attempt.retryCount,
        updatedAt: now,
      };
    default:
      return {
        ...plan,
        updatedAt: now,
      };
  }
}

function rankReceiptStatus(status: ProviderReceipt["normalizedStatus"]): number {
  switch (status) {
    case "accepted":
      return 1;
    case "queued":
      return 2;
    case "unknown":
      return 3;
    case "failed":
    case "bounced":
    case "rejected":
      return 4;
    case "delivered":
      return 5;
    default:
      return 0;
  }
}

async function recordProviderReconciledEvent(
  domainEvents: DomainEventService,
  input: {
    receipt: ProviderReceipt;
    attempt: DeliveryAttempt;
    now: IsoDateTimeString;
    outcome: ProviderReconciliationResult["status"];
    previousStatus: DeliveryAttempt["status"];
    nextStatus: DeliveryAttempt["status"];
    retrySuppressed: boolean;
    reason: string | null;
  },
) {
  await domainEvents.record({
    organizationId: input.receipt.organizationId,
    actor: { userId: "system", role: "system" },
    requestId: input.receipt.id,
    now: input.now,
    workOrderId: null,
    type: "provider_receipt_reconciled",
    visibility: "internal",
    lifecycleStatus: null,
    entity: {
      entityType: "provider_receipt",
      entityId: input.receipt.id,
      label: input.receipt.providerType,
    },
    summary: `Provider receipt ${input.receipt.id} reconciled for attempt ${input.attempt.id}.`,
    correlationId: input.receipt.correlationId,
    reason: input.reason,
    payload: {
      receiptId: input.receipt.id,
      deliveryAttemptId: input.attempt.id,
      deliveryPlanId: input.attempt.deliveryPlanId,
      providerType: input.receipt.providerType,
      normalizedStatus: input.receipt.normalizedStatus,
      outcome: input.outcome,
      previousAttemptStatus: input.previousStatus,
      nextAttemptStatus: input.nextStatus,
      retrySuppressed: input.retrySuppressed,
    } as never,
  });
}

async function recordTransportEventForReceipt(
  domainEvents: DomainEventService,
  input: {
    receipt: ProviderReceipt;
    attempt: DeliveryAttempt;
    previousStatus: DeliveryAttempt["status"];
    now: IsoDateTimeString;
    reason: string | null;
  },
) {
  if (input.attempt.status === input.previousStatus) {
    return;
  }

  const eventType =
    input.attempt.status === "succeeded"
      ? "transport_attempt_succeeded"
      : input.attempt.status === "failed"
        ? "transport_attempt_failed"
        : "transport_attempt_noop";

  await domainEvents.record({
    organizationId: input.receipt.organizationId,
    actor: { userId: "system", role: "system" },
    requestId: input.attempt.id,
    now: input.now,
    workOrderId: null,
    type: eventType,
    visibility: "internal",
    lifecycleStatus: null,
    entity: {
      entityType: "delivery_attempt",
      entityId: input.attempt.id,
      label: input.attempt.adapterType,
    },
    summary: `Provider reconciliation moved attempt ${input.attempt.id} to ${input.attempt.status}.`,
    correlationId: input.receipt.correlationId,
    reason: input.reason,
    payload: {
      deliveryAttemptId: input.attempt.id,
      deliveryPlanId: input.attempt.deliveryPlanId,
      previousStatus: input.previousStatus,
      status: input.attempt.status,
      providerReceiptRecordId: input.receipt.id,
      providerNormalizedStatus: input.receipt.normalizedStatus,
    } as never,
  });
}

async function recordDeliveryCompleted(
  domainEvents: DomainEventService,
  plan: DeliveryPlan,
  now: IsoDateTimeString,
  reason: string,
) {
  await domainEvents.record({
    organizationId: plan.organizationId,
    actor: { userId: "system", role: "system" },
    requestId: plan.id,
    now,
    workOrderId: plan.targetEntityId,
    type: "delivery_completed",
    visibility: "internal",
    lifecycleStatus: null,
    entity: {
      entityType: "delivery_plan",
      entityId: plan.id,
      label: plan.deliveryType,
    },
    summary: `Delivery plan ${plan.id} completed through provider reconciliation.`,
    correlationId: plan.correlationId,
    reason,
    payload: {
      deliveryPlanId: plan.id,
      deliveryType: plan.deliveryType,
      targetEntityType: plan.targetEntityType,
      targetEntityId: plan.targetEntityId,
      recipientType: plan.recipientType,
      recipientId: plan.recipientId,
      channel: plan.channel,
      status: "completed",
      retryCount: plan.retryCount,
    } as never,
  });
}
