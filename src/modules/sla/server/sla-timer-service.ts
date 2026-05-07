import "server-only";

import {
  SLA_TIMER_STATUSES,
  SLA_TIMER_TYPES,
  type SlaTimer,
  type SlaTimerCondition,
  type SlaTimerEvaluateJobPayload,
} from "@/modules/sla";
import type { DomainEvent } from "@/server/events/types";
import { notFoundError } from "@/server/services/errors";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services/types";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { SlaTimerRepository } from "./sla-timer-repository";

export interface SlaTimerService {
  createFirstResponseTimer(input: {
    organizationId: EntityId;
    sourceEvent: DomainEvent<"work_order_created">;
    dueAt: IsoDateTimeString;
    policyVersion: string;
    payloadVersion: "v1";
    correlationId: string;
    causationId: string;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<{ timer: SlaTimer; created: boolean }>>;
  loadTimer(input: {
    organizationId: EntityId;
    timerId: EntityId;
  }): Promise<ServiceResult<SlaTimer>>;
  loadTimerByWorkOrder(
    organizationId: EntityId,
    workOrderId: EntityId | null,
  ): Promise<SlaTimer | null>;
  attachRuntimeJob(input: {
    timer: SlaTimer;
    runtimeJobId: EntityId;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<SlaTimer>>;
  startEvaluation(input: {
    organizationId: EntityId;
    timerId: EntityId;
    runtimeJobId: EntityId;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<{ timer: SlaTimer; stale: boolean; reason: string }>>;
  markSatisfied(input: {
    timer: SlaTimer;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<SlaTimer>>;
  markBreached(input: {
    timer: SlaTimer;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<SlaTimer>>;
  markFailed(input: {
    timer: SlaTimer;
    now: IsoDateTimeString;
    failureReason: string;
  }): Promise<ServiceResult<SlaTimer>>;
}

export function createSlaTimerService(repository: SlaTimerRepository): SlaTimerService {
  return {
    async createFirstResponseTimer(input) {
      const idempotencyKey = buildFirstResponseTimerIdempotencyKey(
        input.sourceEvent.workOrderId ?? "no-work-order",
      );
      const existing = await repository.findByIdempotencyKey({
        organizationId: input.organizationId,
        type: SLA_TIMER_TYPES.WorkOrderFirstResponseDue,
        idempotencyKey,
      });
      if (existing) {
        return serviceOk({ timer: existing, created: false });
      }

      const workOrderId = input.sourceEvent.workOrderId;
      if (!workOrderId) {
        return serviceFail(notFoundError("Work order id is required for SLA timer creation."));
      }

      const condition: SlaTimerCondition = {
        kind: "work_order_first_response",
        workOrderId,
        activationEventId: input.sourceEvent.id,
        activationEventType: input.sourceEvent.type,
        activationOccurredAt: input.sourceEvent.occurredAt,
        initialLifecycleStatus:
          input.sourceEvent.payload.lifecycleStatus ?? input.sourceEvent.lifecycleStatus,
      };

      const timer: SlaTimer = {
        id: repository.newId(),
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        type: SLA_TIMER_TYPES.WorkOrderFirstResponseDue,
        targetEntityType: "work_order",
        targetEntityId: workOrderId,
        status: SLA_TIMER_STATUSES.Scheduled,
        dueAt: input.dueAt,
        policyVersion: input.policyVersion,
        payloadVersion: input.payloadVersion,
        condition,
        sourceEventId: input.sourceEvent.id,
        correlationId: input.correlationId,
        causationId: input.causationId,
        idempotencyKey,
        runtimeJobId: null,
        evaluatedAt: null,
        satisfiedAt: null,
        breachedAt: null,
        cancelledAt: null,
        failureReason: null,
        createdAt: input.now,
        updatedAt: input.now,
      };
      await repository.create(timer);
      return serviceOk({ timer, created: true });
    },

    async loadTimer(input) {
      const timer = await repository.getById(input.timerId);
      if (!timer || timer.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("SLA timer not found."));
      }
      return serviceOk(timer);
    },

    async loadTimerByWorkOrder(organizationId, workOrderId) {
      if (!workOrderId) {
        return null;
      }
      return repository.findByIdempotencyKey({
        organizationId,
        type: SLA_TIMER_TYPES.WorkOrderFirstResponseDue,
        idempotencyKey: buildFirstResponseTimerIdempotencyKey(workOrderId),
      });
    },

    async attachRuntimeJob(input) {
      const updated: SlaTimer = {
        ...input.timer,
        runtimeJobId: input.runtimeJobId,
        updatedAt: input.now,
      };
      await repository.save(updated);
      return serviceOk(updated);
    },

    async startEvaluation(input) {
      const loaded = await this.loadTimer({
        organizationId: input.organizationId,
        timerId: input.timerId,
      });
      if (!loaded.ok) {
        return loaded;
      }

      const timer = loaded.value;
      if (timer.status === SLA_TIMER_STATUSES.Satisfied) {
        return serviceOk({
          timer,
          stale: true,
          reason: `SLA timer is already ${timer.status}.`,
        });
      }
      if (timer.status === SLA_TIMER_STATUSES.Cancelled || timer.status === SLA_TIMER_STATUSES.Failed) {
        return serviceOk({
          timer,
          stale: true,
          reason: `SLA timer is ${timer.status}.`,
        });
      }
      if (timer.runtimeJobId && timer.runtimeJobId !== input.runtimeJobId) {
        return serviceOk({
          timer,
          stale: true,
          reason: "SLA timer has been superseded by a newer runtime job.",
        });
      }

      if (timer.status === SLA_TIMER_STATUSES.Evaluating) {
        return serviceOk({
          timer,
          stale: false,
          reason: "SLA timer is already evaluating.",
        });
      }

      const updated: SlaTimer = {
        ...timer,
        status: SLA_TIMER_STATUSES.Evaluating,
        evaluatedAt: input.now,
        updatedAt: input.now,
        failureReason: null,
      };
      await repository.save(updated);
      return serviceOk({
        timer: updated,
        stale: false,
        reason: "SLA timer marked evaluating.",
      });
    },

    async markSatisfied(input) {
      const updated: SlaTimer = {
        ...input.timer,
        status: SLA_TIMER_STATUSES.Satisfied,
        evaluatedAt: input.now,
        satisfiedAt: input.timer.satisfiedAt ?? input.now,
        failureReason: null,
        updatedAt: input.now,
      };
      await repository.save(updated);
      return serviceOk(updated);
    },

    async markBreached(input) {
      const updated: SlaTimer = {
        ...input.timer,
        status: SLA_TIMER_STATUSES.Breached,
        evaluatedAt: input.now,
        breachedAt: input.timer.breachedAt ?? input.now,
        failureReason: null,
        updatedAt: input.now,
      };
      await repository.save(updated);
      return serviceOk(updated);
    },

    async markFailed(input) {
      const updated: SlaTimer = {
        ...input.timer,
        status: SLA_TIMER_STATUSES.Failed,
        evaluatedAt: input.now,
        failureReason: input.failureReason,
        updatedAt: input.now,
      };
      await repository.save(updated);
      return serviceOk(updated);
    },
  };
}

export function buildFirstResponseTimerIdempotencyKey(workOrderId: EntityId): string {
  return `${SLA_TIMER_TYPES.WorkOrderFirstResponseDue}:work_order:${workOrderId}`;
}

export function buildSlaTimerEvaluatePayload(timerId: EntityId): SlaTimerEvaluateJobPayload {
  return {
    timerId,
    payloadVersion: "v1",
  };
}
