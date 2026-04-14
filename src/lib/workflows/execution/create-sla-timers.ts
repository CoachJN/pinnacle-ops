import type { TransitionEventRecord } from "../audit/index.ts";
import { INVOICE_STATUS, QUOTE_STATUS, WORK_ORDER_STATUS } from "../lifecycle/index.ts";
import type { WorkflowExecutionAdapters } from "./repositories.ts";
import type {
  WorkflowSlaCreationResult,
  WorkflowSlaDefinition,
  WorkflowSlaTimer,
  WorkflowSlaWarning,
} from "./sla-types.ts";

export const WORKFLOW_SLA_DEFINITIONS = [
  {
    slaKey: "work-order.awaiting-quote",
    lifecycle: "work-order",
    entityType: "work-order",
    startStatus: WORK_ORDER_STATUS.AwaitingQuote,
    defaultDurationHours: 48,
    breachSeverity: "MEDIUM",
    purpose: "Detect quote delays and follow-up requirement.",
    runtimePosture: "active",
  },
  {
    slaKey: "work-order.awaiting-client-approval",
    lifecycle: "work-order",
    entityType: "work-order",
    startStatus: WORK_ORDER_STATUS.AwaitingClientApproval,
    defaultDurationHours: 72,
    breachSeverity: "HIGH",
    purpose: "Detect stalled client decision.",
    runtimePosture: "active",
  },
  {
    slaKey: "work-order.scheduling",
    lifecycle: "work-order",
    entityType: "work-order",
    startStatus: WORK_ORDER_STATUS.ApprovedToProceed,
    defaultDurationHours: 24,
    breachSeverity: "HIGH",
    purpose: "Detect scheduling delay.",
    runtimePosture: "active",
  },
  {
    slaKey: "work-order.invoicing",
    lifecycle: "work-order",
    entityType: "work-order",
    startStatus: WORK_ORDER_STATUS.ReadyForInvoicing,
    defaultDurationHours: 24,
    breachSeverity: "HIGH",
    purpose: "Detect finance delay.",
    runtimePosture: "active",
  },
  {
    slaKey: "invoice.payment-follow-up",
    lifecycle: "invoice",
    entityType: "invoice",
    startStatus: INVOICE_STATUS.Sent,
    defaultDurationHours: 168,
    breachSeverity: "MEDIUM",
    purpose: "Track invoice aging and follow-up need.",
    runtimePosture: "active",
  },
  {
    slaKey: "invoice.overdue-collection",
    lifecycle: "invoice",
    entityType: "invoice",
    startStatus: INVOICE_STATUS.Overdue,
    defaultDurationHours: 24,
    breachSeverity: "CRITICAL",
    purpose: "Track collection review urgency.",
    runtimePosture: "active",
  },
  {
    slaKey: "quote.client-decision",
    lifecycle: "quote",
    entityType: "quote",
    startStatus: QUOTE_STATUS.SentToClient,
    defaultDurationHours: 72,
    breachSeverity: "MEDIUM",
    purpose: "Future quote client decision follow-up once quote runtime events exist.",
    runtimePosture: "deferred",
  },
] as const satisfies readonly WorkflowSlaDefinition[];

export async function createWorkflowSlaTimersFromEvent(
  event: TransitionEventRecord,
  adapters: WorkflowExecutionAdapters = {},
): Promise<WorkflowSlaCreationResult> {
  const definitions = getWorkflowSlaDefinitionsForEvent(event);
  const activeDefinitions = definitions.filter(
    (definition) => definition.runtimePosture === "active",
  );
  const deferredDefinitions = definitions.filter(
    (definition) => definition.runtimePosture === "deferred",
  );
  const warnings: WorkflowSlaWarning[] = deferredDefinitions.map((definition) => ({
    code: "WORKFLOW_SLA_QUOTE_RUNTIME_DEFERRED",
    message:
      "Quote SLA definition is typed but quote transition runtime persistence remains deferred.",
    details: { slaKey: definition.slaKey },
  }));

  if (activeDefinitions.length === 0) {
    return { createdTimers: [], deferredDefinitions, warnings };
  }

  const timers = activeDefinitions.map((definition) =>
    buildWorkflowSlaTimer({ definition, event }),
  );

  if (adapters.recordWorkflowSlaTimers) {
    try {
      const created = await adapters.recordWorkflowSlaTimers(timers);
      return {
        createdTimers: created ?? timers,
        deferredDefinitions,
        warnings,
      };
    } catch (error) {
      return {
        createdTimers: [],
        deferredDefinitions,
        warnings: [
          ...warnings,
          {
            code: "WORKFLOW_SLA_TIMER_PERSISTENCE_FAILED",
            message: "Failed to persist workflow SLA timers.",
            details: {
              error: error instanceof Error ? error.message : String(error),
            },
          },
        ],
      };
    }
  }

  if (!adapters.recordWorkflowSlaTimer) {
    return {
      createdTimers: [],
      deferredDefinitions,
      warnings: [
        ...warnings,
        {
          code: "WORKFLOW_SLA_REPOSITORY_UNAVAILABLE",
          message:
            "Workflow SLA timers were evaluated but no durable SLA repository is configured.",
          details: { timerCount: timers.length },
        },
      ],
    };
  }

  const createdTimers: WorkflowSlaTimer[] = [];
  for (const timer of timers) {
    try {
      const created = await adapters.recordWorkflowSlaTimer(timer);
      createdTimers.push(created ?? timer);
    } catch (error) {
      warnings.push({
        code: "WORKFLOW_SLA_TIMER_PERSISTENCE_FAILED",
        message: "Failed to persist workflow SLA timer.",
        details: {
          timerId: timer.timerId,
          slaKey: timer.slaKey,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return { createdTimers, deferredDefinitions, warnings };
}

export function getWorkflowSlaDefinitionsForEvent(
  event: TransitionEventRecord,
): readonly WorkflowSlaDefinition[] {
  return WORKFLOW_SLA_DEFINITIONS.filter(
    (definition) =>
      definition.lifecycle === event.lifecycle &&
      definition.entityType === event.entityType &&
      definition.startStatus === event.newStatus,
  );
}

function buildWorkflowSlaTimer(input: {
  readonly definition: WorkflowSlaDefinition;
  readonly event: TransitionEventRecord;
}): WorkflowSlaTimer {
  const dueAt = getDueAt(input.event, input.definition);

  return {
    timerId: buildTimerId(input.event, input.definition),
    lifecycle: input.definition.lifecycle,
    entityType: input.definition.entityType,
    entityId: input.event.entityId,
    slaKey: input.definition.slaKey,
    startedAt: input.event.timestamp,
    dueAt,
    satisfiedAt: null,
    status: "ACTIVE",
    breachSeverity: input.definition.breachSeverity,
    sourceStatus: input.event.newStatus,
    sourceEvent: input.event.eventId ?? null,
    metadata: {
      purpose: input.definition.purpose,
      sourcePreviousStatus: input.event.previousStatus,
      sourceEventTimestamp: input.event.timestamp,
    },
    createdAt: input.event.timestamp,
    updatedAt: input.event.timestamp,
  };
}

function getDueAt(
  event: TransitionEventRecord,
  definition: WorkflowSlaDefinition,
): string {
  const dueAtOverride = event.metadata?.[`${definition.slaKey}.dueAt`];
  if (typeof dueAtOverride === "string") {
    return dueAtOverride;
  }

  const durationOverride = event.metadata?.[`${definition.slaKey}.durationHours`];
  const durationHours =
    typeof durationOverride === "number"
      ? durationOverride
      : definition.defaultDurationHours;
  const startedAt = new Date(event.timestamp);

  return new Date(startedAt.getTime() + durationHours * 60 * 60 * 1000).toISOString();
}

function buildTimerId(
  event: TransitionEventRecord,
  definition: WorkflowSlaDefinition,
): string {
  return [
    "workflow-sla",
    definition.slaKey,
    event.entityId,
    event.eventId ?? event.timestamp,
  ]
    .join(":")
    .replaceAll(/\s+/g, "-");
}
