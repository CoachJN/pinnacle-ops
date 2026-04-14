import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { TransitionEventRecord } from "../audit/index.ts";
import { INVOICE_STATUS, WORK_ORDER_STATUS } from "../lifecycle/index.ts";
import type { WorkflowExecutionAdapters } from "./repositories.ts";
import type {
  WorkflowSlaBreachRecord,
  WorkflowSlaEvaluationResult,
  WorkflowSlaStatus,
  WorkflowSlaTimer,
  WorkflowSlaWarning,
} from "./sla-types.ts";

export async function evaluateWorkflowSlaBreaches(input: {
  readonly now?: IsoDateTimeString;
  readonly adapters?: WorkflowExecutionAdapters;
}): Promise<WorkflowSlaEvaluationResult> {
  const now = input.now ?? new Date().toISOString();

  if (!input.adapters?.listActiveWorkflowSlaTimersDue) {
    return {
      evaluatedCount: 0,
      breachedCount: 0,
      satisfiedCount: 0,
      activeCount: 0,
      createdBreaches: [],
      warnings: [
        {
          code: "WORKFLOW_SLA_REPOSITORY_UNAVAILABLE",
          message:
            "SLA breach evaluation requires a durable repository of active timers.",
        },
      ],
    };
  }

  if (
    !input.adapters.recordWorkflowSlaBreach ||
    !input.adapters.updateWorkflowSlaTimerStatus
  ) {
    return {
      evaluatedCount: 0,
      breachedCount: 0,
      satisfiedCount: 0,
      activeCount: 0,
      createdBreaches: [],
      warnings: [
        {
          code: "WORKFLOW_SLA_REPOSITORY_UNAVAILABLE",
          message:
            "SLA breach evaluation requires durable breach recording and timer status updates.",
        },
      ],
    };
  }

  const timers = await input.adapters.listActiveWorkflowSlaTimersDue({ now });
  const warnings: WorkflowSlaWarning[] = [];
  const breaches: WorkflowSlaBreachRecord[] = [];

  for (const timer of timers) {
    if (timer.status !== "ACTIVE" || timer.satisfiedAt) {
      continue;
    }

    if (new Date(timer.dueAt).getTime() > new Date(now).getTime()) {
      continue;
    }

    const breach = buildBreach(timer, now);
    try {
      await input.adapters.recordWorkflowSlaBreach(breach);
      breaches.push(breach);
    } catch (error) {
      warnings.push({
        code: "WORKFLOW_SLA_BREACH_PERSISTENCE_FAILED",
        message: "Failed to persist workflow SLA breach record.",
        details: {
          timerId: timer.timerId,
          slaKey: timer.slaKey,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      continue;
    }

    try {
      await input.adapters.updateWorkflowSlaTimerStatus(timer.timerId, {
        status: "BREACHED",
        updatedAt: now,
      });
    } catch (error) {
      warnings.push({
        code: "WORKFLOW_SLA_TIMER_UPDATE_FAILED",
        message: "Failed to mark workflow SLA timer as breached.",
        details: {
          timerId: timer.timerId,
          slaKey: timer.slaKey,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return {
    evaluatedCount: timers.length,
    breachedCount: breaches.length,
    satisfiedCount: timers.filter((timer) => timer.status === "SATISFIED").length,
    activeCount: timers.length - breaches.length,
    createdBreaches: breaches,
    warnings,
  };
}

export async function satisfyWorkflowSlaTimersForEvent(
  event: TransitionEventRecord,
  adapters: WorkflowExecutionAdapters = {},
): Promise<WorkflowSlaEvaluationResult> {
  return settleWorkflowSlaTimersForEvent(event, adapters, "SATISFIED");
}

export async function cancelWorkflowSlaTimersForEvent(
  event: TransitionEventRecord,
  adapters: WorkflowExecutionAdapters = {},
): Promise<WorkflowSlaEvaluationResult> {
  return settleWorkflowSlaTimersForEvent(event, adapters, "CANCELLED");
}

async function settleWorkflowSlaTimersForEvent(
  event: TransitionEventRecord,
  adapters: WorkflowExecutionAdapters,
  requestedStatus: Extract<WorkflowSlaStatus, "SATISFIED" | "CANCELLED">,
): Promise<WorkflowSlaEvaluationResult> {
  if (!adapters.listActiveWorkflowSlaTimersForEntity) {
    return emptyResult();
  }

  const timers = await adapters.listActiveWorkflowSlaTimersForEntity({
    lifecycle: event.lifecycle,
    entityType: event.entityType,
    entityId: event.entityId,
  });
  const applicableKeys = new Set(getSettledSlaKeys(event, requestedStatus));
  const applicableTimers = timers.filter((timer) => applicableKeys.has(timer.slaKey));
  const warnings: WorkflowSlaWarning[] = [];

  for (const timer of applicableTimers) {
    try {
      await adapters.updateWorkflowSlaTimerStatus?.(timer.timerId, {
        status: requestedStatus,
        satisfiedAt: requestedStatus === "SATISFIED" ? event.timestamp : null,
        updatedAt: event.timestamp,
      });
    } catch (error) {
      warnings.push({
        code: "WORKFLOW_SLA_TIMER_UPDATE_FAILED",
        message: "Failed to settle workflow SLA timer from transition event.",
        details: {
          timerId: timer.timerId,
          slaKey: timer.slaKey,
          status: requestedStatus,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return {
    evaluatedCount: timers.length,
    breachedCount: 0,
    satisfiedCount: requestedStatus === "SATISFIED" ? applicableTimers.length : 0,
    activeCount: timers.length - applicableTimers.length,
    createdBreaches: [],
    warnings,
  };
}

function getSettledSlaKeys(
  event: TransitionEventRecord,
  status: Extract<WorkflowSlaStatus, "SATISFIED" | "CANCELLED">,
): readonly string[] {
  if (status === "CANCELLED") {
    if (
      event.lifecycle === "work-order" &&
      event.newStatus === WORK_ORDER_STATUS.Cancelled
    ) {
      return [
        "work-order.awaiting-quote",
        "work-order.awaiting-client-approval",
        "work-order.scheduling",
        "work-order.invoicing",
      ];
    }

    if (event.lifecycle === "invoice" && event.newStatus === INVOICE_STATUS.Voided) {
      return ["invoice.payment-follow-up", "invoice.overdue-collection"];
    }

    return [];
  }

  if (event.lifecycle === "work-order") {
    switch (event.newStatus) {
      case WORK_ORDER_STATUS.QuoteReceived:
      case WORK_ORDER_STATUS.QuoteReview:
      case WORK_ORDER_STATUS.AwaitingClientApproval:
        return ["work-order.awaiting-quote"];
      case WORK_ORDER_STATUS.ApprovedToProceed:
        return ["work-order.awaiting-client-approval"];
      case WORK_ORDER_STATUS.Scheduling:
      case WORK_ORDER_STATUS.Scheduled:
      case WORK_ORDER_STATUS.InProgress:
        return ["work-order.scheduling"];
      case WORK_ORDER_STATUS.Completed:
        return [
          "work-order.awaiting-quote",
          "work-order.awaiting-client-approval",
          "work-order.scheduling",
          "work-order.invoicing",
        ];
      default:
        return [];
    }
  }

  if (event.lifecycle === "invoice") {
    switch (event.newStatus) {
      case INVOICE_STATUS.PartiallyPaid:
      case INVOICE_STATUS.Paid:
        return ["invoice.payment-follow-up", "invoice.overdue-collection"];
      case INVOICE_STATUS.Overdue:
        return ["invoice.payment-follow-up"];
      default:
        return [];
    }
  }

  return [];
}

function buildBreach(
  timer: WorkflowSlaTimer,
  breachedAt: IsoDateTimeString,
): WorkflowSlaBreachRecord {
  return {
    breachId: buildBreachId(timer.timerId, breachedAt),
    timerId: timer.timerId,
    lifecycle: timer.lifecycle,
    entityType: timer.entityType,
    entityId: timer.entityId,
    slaKey: timer.slaKey,
    dueAt: timer.dueAt,
    breachedAt,
    severity: timer.breachSeverity,
    sourceEvent: timer.sourceEvent,
    metadata: timer.metadata,
  };
}

function buildBreachId(timerId: EntityId, breachedAt: IsoDateTimeString): EntityId {
  return ["workflow-sla-breach", timerId, breachedAt].join(":");
}

function emptyResult(): WorkflowSlaEvaluationResult {
  return {
    evaluatedCount: 0,
    breachedCount: 0,
    satisfiedCount: 0,
    activeCount: 0,
    createdBreaches: [],
    warnings: [],
  };
}
