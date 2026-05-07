import "server-only";

import type {
  EventSubscriberDefinition,
  RegisteredEventSubscriber,
} from "@/modules/runtime";
import type { DomainEventType } from "@/server/events/types";

export interface EventSubscriberRegistry {
  list(): readonly RegisteredEventSubscriber[];
  getSubscribersForEventType(
    eventType: DomainEventType,
  ): readonly EventSubscriberDefinition[];
}

export function createEventSubscriberRegistry(
  definitions: readonly EventSubscriberDefinition[] = DEFAULT_EVENT_SUBSCRIBERS,
): EventSubscriberRegistry {
  const byEventType = definitions.reduce<Map<DomainEventType, EventSubscriberDefinition[]>>(
    (accumulator, definition) => {
      for (const eventType of definition.eventTypes) {
        const existing = accumulator.get(eventType) ?? [];
        existing.push(definition);
        accumulator.set(eventType, existing);
      }
      return accumulator;
    },
    new Map(),
  );

  return {
    list() {
      return definitions.map((definition) => ({
        key: definition.key,
        name: definition.name,
        description: definition.description,
        eventTypes: definition.eventTypes,
        jobType: definition.jobType,
      }));
    },
    getSubscribersForEventType(eventType) {
      return byEventType.get(eventType) ?? [];
    },
  };
}

const DEFAULT_EVENT_SUBSCRIBERS: readonly EventSubscriberDefinition[] = [
  {
    key: "lifecycle-sla-timer",
    name: "Lifecycle SLA Timer",
    description:
      "Schedules canonical first-response SLA timer evaluations from durable work-order and communication events.",
    eventTypes: [
      "work_order_created",
      "lifecycle_transitioned",
      "communication_message_created",
    ],
    jobType: "sla.timer.evaluate",
    buildJobs(context) {
      if (!context.event.workOrderId) {
        return [];
      }
      if (context.event.type === "communication_message_created" && context.event.visibility !== "internal") {
        return [];
      }
      if (context.event.type === "lifecycle_transitioned" && context.event.visibility !== "internal") {
        return [];
      }

      return [
        {
          type: "sla.timer.evaluate",
          payloadVersion: "v1",
          idempotencyKey: [
            "sla.timer.evaluate",
            context.event.workOrderId ?? "no-work-order",
            context.event.type,
            context.sourceEventId,
          ].join(":"),
          payload: {
            timerType: "work_order.first_response_due",
            trigger:
              context.event.type === "work_order_created"
                ? "created"
                : context.event.type === "communication_message_created"
                  ? "internal_communication"
                  : "internal_lifecycle_transition",
          },
        },
      ];
    },
  },
  {
    key: "sla-breach-escalation",
    name: "SLA Breach Escalation",
    description:
      "Queues canonical escalation orchestration work from durable SLA breach and resolution events.",
    eventTypes: ["sla_timer_breached", "sla_timer_satisfied"],
    jobType: "escalation.progress",
    buildJobs(context) {
      const payload = context.event.payload as {
        timerId: string;
        timerType: string;
        targetEntityId: string;
      };
      if (
        payload.timerType !== "work_order.first_response_due" ||
        !payload.targetEntityId
      ) {
        return [];
      }

      if (context.event.type === "sla_timer_satisfied") {
        return [
          {
            type: "escalation.progress",
            payloadVersion: "v1",
            idempotencyKey: ["escalation.progress", context.sourceEventId, "cancel"].join(":"),
            payload: {
              payloadVersion: "v1",
              action: "cancel_if_resolved",
              escalationType: "work_order.first_response_breach",
              sourceSlaTimerId: payload.timerId,
              targetEntityType: "work_order",
              targetEntityId: payload.targetEntityId,
              sourceEventId: context.sourceEventId,
              reason: "sla_timer_satisfied",
            },
          },
        ];
      }

      return [
        {
          type: "escalation.progress",
          payloadVersion: "v1",
          idempotencyKey: ["escalation.progress", context.sourceEventId, "stage", "1"].join(":"),
          payload: {
            payloadVersion: "v1",
            action: "progress",
            escalationType: "work_order.first_response_breach",
            sourceSlaTimerId: payload.timerId,
            targetEntityType: "work_order",
            targetEntityId: payload.targetEntityId,
            sourceEventId: context.sourceEventId,
            requestedStageNumber: 1,
            reason: "sla_timer_breached",
          },
        },
      ];
    },
  },
  {
    key: "escalation-delivery-planning",
    name: "Escalation Delivery Planning",
    description:
      "Queues canonical delivery planning work from durable escalation events without sending provider traffic inline.",
    eventTypes: ["escalation_created", "escalation_progressed", "escalation_cancelled"],
    jobType: "delivery.plan.process",
    buildJobs(context) {
      const payload = context.event.payload as {
        orchestrationId: string;
        escalationType: string;
        stageNumber?: number;
      };
      if (
        payload.escalationType !== "work_order.first_response_breach" ||
        !payload.orchestrationId
      ) {
        return [];
      }

      if (context.event.type === "escalation_cancelled") {
        return [
          {
            type: "delivery.plan.process",
            payloadVersion: "v1",
            idempotencyKey: ["delivery.plan.process", context.sourceEventId, "cancel"].join(":"),
            payload: {
              payloadVersion: "v1",
              action: "cancel_for_escalation",
              deliveryType: "escalation.first_response_breach_notification",
              sourceEscalationId: payload.orchestrationId,
              sourceEventId: context.sourceEventId,
              reason: "escalation_cancelled",
            },
          },
        ];
      }

      return [
        {
          type: "delivery.plan.process",
          payloadVersion: "v1",
          idempotencyKey: ["delivery.plan.process", context.sourceEventId, "plan"].join(":"),
          payload: {
            payloadVersion: "v1",
            action: "plan_from_escalation_event",
            deliveryType: "escalation.first_response_breach_notification",
            sourceEscalationId: payload.orchestrationId,
            sourceEscalationStageNumber: payload.stageNumber ?? null,
            sourceEventId: context.sourceEventId,
            reason:
              context.event.type === "escalation_created"
                ? "escalation_created"
                : "escalation_progressed",
          },
        },
      ];
    },
  },
  {
    key: "delivery-transport-execution",
    name: "Delivery Transport Execution",
    description:
      "Queues canonical transport execution work from durable delivery scheduling events without invoking provider logic inline.",
    eventTypes: ["delivery_planned", "delivery_scheduled"],
    jobType: "transport.execute",
    buildJobs(context) {
      const payload = context.event.payload as {
        deliveryPlanId: string;
        deliveryType: string;
      };
      if (
        payload.deliveryType !== "escalation.first_response_breach_notification" ||
        !payload.deliveryPlanId
      ) {
        return [];
      }

      return [
        {
          type: "transport.execute",
          payloadVersion: "v1",
          idempotencyKey: ["transport.execute", payload.deliveryPlanId, "attempt", "0"].join(":"),
          payload: {
            payloadVersion: "v1",
            deliveryPlanId: payload.deliveryPlanId,
            deliveryType: payload.deliveryType,
            attemptNumber: 0,
            reason: context.event.type,
            triggerEventType: context.event.type,
          },
          maxAttempts: 1,
        },
      ];
    },
  },
  {
    key: "provider-receipt-reconciliation",
    name: "Provider Receipt Reconciliation",
    description:
      "Queues canonical provider receipt reconciliation work from persisted provider receipt events.",
    eventTypes: ["provider_receipt_recorded"],
    jobType: "provider.receipt.process",
    buildJobs(context) {
      const payload = context.event.payload as {
        receiptId?: string;
      };
      if (!payload.receiptId) {
        return [];
      }

      return [
        {
          type: "provider.receipt.process",
          payloadVersion: "v1",
          idempotencyKey: ["provider.receipt.process", payload.receiptId].join(":"),
          payload: {
            payloadVersion: "v1",
            receiptId: payload.receiptId,
            reason: "provider_receipt_recorded",
          },
          maxAttempts: 3,
        },
      ];
    },
  },
  {
    key: "provider-failure-replay",
    name: "Provider Failure Replay",
    description:
      "Queues provider recovery jobs from durable provider failure events without calling provider APIs inline.",
    eventTypes: [
      "provider_ingestion_failed",
      "provider_sync_failed",
      "provider_attachment_hydration_failed",
    ],
    jobType: "provider.replay",
    buildJobs(context) {
      return [
        {
          type: "provider.replay",
          payloadVersion: "v1",
          idempotencyKey: ["provider.replay", context.sourceEventId].join(":"),
          payload: {
            sourceEventId: context.sourceEventId,
            sourceEventType: context.event.type,
            workOrderId: context.event.workOrderId,
          },
          maxAttempts: 3,
        },
      ];
    },
  },
  {
    key: "intake-review-followup",
    name: "Intake Review Follow-Up",
    description:
      "Queues durable intake follow-up jobs from canonical intake events without executing AI review or conversion inline.",
    eventTypes: [
      "intake_event_created",
      "intake_review_started",
      "intake_review_decision_recorded",
    ],
    jobType: "intake.followup",
    buildJobs(context) {
      return [
        {
          type: "intake.followup",
          payloadVersion: "v1",
          idempotencyKey: ["intake.followup", context.sourceEventId].join(":"),
          payload: {
            sourceEventId: context.sourceEventId,
            sourceEventType: context.event.type,
            workOrderId: context.event.workOrderId,
          },
        },
      ];
    },
  },
];
