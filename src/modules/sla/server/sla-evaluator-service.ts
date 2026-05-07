import "server-only";

import {
  SLA_EVALUATION_OUTCOMES,
  SLA_TIMER_STATUSES,
  type SlaEvaluationResult,
  type SlaTimer,
} from "@/modules/sla";
import type { WorkOrder } from "@/server/repositories";
import type { DomainEventService } from "@/server/services";
import { serviceFail, serviceOk, type ServiceAuditContext, type ServiceResult } from "@/server/services/types";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainEvent } from "@/server/events/types";
import type { SlaTimerService } from "./sla-timer-service";

export interface SlaEvaluatorService {
  evaluateFirstResponseTimer(input: {
    organizationId: string;
    timerId: string;
    runtimeJobId: string;
    now: string;
    audit: ServiceAuditContext;
  }): Promise<ServiceResult<SlaEvaluationResult>>;
}

export function createSlaEvaluatorService(
  repositories: Pick<FirestoreRepositories, "workOrders" | "domainEvents">,
  timerService: SlaTimerService,
  domainEvents: DomainEventService,
): SlaEvaluatorService {
  return {
    async evaluateFirstResponseTimer(input) {
      const started = await timerService.startEvaluation({
        organizationId: input.organizationId,
        timerId: input.timerId,
        runtimeJobId: input.runtimeJobId,
        now: input.now,
      });
      if (!started.ok) {
        return started;
      }
      if (started.value.stale) {
        return serviceOk({
          outcome: SLA_EVALUATION_OUTCOMES.NoopStale,
          timer: started.value.timer,
          emittedEvent: null,
          message: started.value.reason,
        });
      }

      const timer = started.value.timer;
      const previouslyBreached = timer.breachedAt !== null;

      const workOrder = await repositories.workOrders.getById(timer.targetEntityId);
      if (!workOrder || workOrder.organizationId !== input.organizationId || workOrder.isDeleted) {
        const failed = await timerService.markFailed({
          timer,
          now: input.now,
          failureReason: "Target work order not found for SLA evaluation.",
        });
        return failed.ok
          ? serviceOk({
              outcome: SLA_EVALUATION_OUTCOMES.Failed,
              timer: failed.value,
              emittedEvent: null,
              message: failed.value.failureReason ?? "Target work order not found for SLA evaluation.",
            })
          : failed;
      }

      const evidence = await repositories.domainEvents.listByWorkOrderId(timer.targetEntityId, {
        limit: 200,
      });
      const satisfied = hasInternalFirstResponse(timer, workOrder, evidence.items);
      if (satisfied) {
        const settled = await timerService.markSatisfied({
          timer,
          now: input.now,
        });
        if (!settled.ok) {
          return settled;
        }
        let satisfiedEvent: DomainEvent<"sla_timer_satisfied"> | null = null;
        if (previouslyBreached) {
          const emitted = await domainEvents.record({
            ...input.audit,
            now: input.now,
            workOrderId: settled.value.targetEntityId,
            type: "sla_timer_satisfied",
            visibility: "internal",
            lifecycleStatus: workOrder.lifecycleStatus,
            entity: {
              entityType: "sla_timer",
              entityId: settled.value.id,
              label: settled.value.type,
            },
            summary: `SLA timer ${settled.value.type} satisfied after breach for ${workOrder.workOrderNumber}.`,
            correlationId: settled.value.correlationId,
            reason: null,
            payload: {
              timerId: settled.value.id,
              timerType: settled.value.type,
              targetEntityType: settled.value.targetEntityType,
              targetEntityId: settled.value.targetEntityId,
              satisfiedAt: settled.value.satisfiedAt ?? input.now,
              policyVersion: settled.value.policyVersion,
            },
          });
          if (!emitted.ok) {
            return emitted;
          }
          satisfiedEvent = emitted.value;
        }
        return serviceOk({
          outcome: SLA_EVALUATION_OUTCOMES.Satisfied,
          timer: settled.value,
          emittedEvent: satisfiedEvent,
          message: "SLA timer condition is no longer active.",
        });
      }

      if (timer.dueAt > input.now) {
        const settled = await timerService.markSatisfied({
          timer,
          now: input.now,
        });
        if (!settled.ok) {
          return settled;
        }
        return serviceOk({
          outcome: SLA_EVALUATION_OUTCOMES.Satisfied,
          timer: settled.value,
          emittedEvent: null,
          message: "SLA timer evaluated early and remains within due window.",
        });
      }

      const breached = await timerService.markBreached({
        timer,
        now: input.now,
      });
      if (!breached.ok) {
        return breached;
      }

      const event = await domainEvents.record({
        ...input.audit,
        now: input.now,
        workOrderId: breached.value.targetEntityId,
        type: "sla_timer_breached",
        visibility: "internal",
        lifecycleStatus: workOrder.lifecycleStatus,
        entity: {
          entityType: "sla_timer",
          entityId: breached.value.id,
          label: breached.value.type,
        },
        summary: `SLA timer ${breached.value.type} breached for ${workOrder.workOrderNumber}.`,
        correlationId: breached.value.correlationId,
        reason: null,
        payload: {
          timerId: breached.value.id,
          timerType: breached.value.type,
          targetEntityType: breached.value.targetEntityType,
          targetEntityId: breached.value.targetEntityId,
          dueAt: breached.value.dueAt,
          policyVersion: breached.value.policyVersion,
        },
      });
      if (!event.ok) {
        return event;
      }

      return serviceOk({
        outcome: SLA_EVALUATION_OUTCOMES.Breached,
        timer: breached.value,
        emittedEvent: event.value,
        message: "SLA timer breached.",
      });
    },
  };
}

function hasInternalFirstResponse(
  timer: SlaTimer,
  workOrder: WorkOrder,
  events: readonly DomainEvent[],
): boolean {
  if (
    workOrder.lifecycleStatus === "cancelled" ||
    workOrder.lifecycleStatus === "closed"
  ) {
    return true;
  }

  return events.some((event) => {
    if (event.occurredAt <= timer.condition.activationOccurredAt) {
      return false;
    }
    if (event.visibility !== "internal") {
      return false;
    }
    if (event.type === "communication_message_created") {
      return true;
    }
    if (event.type === "lifecycle_transitioned") {
      return true;
    }
    return false;
  });
}
