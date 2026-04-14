import type { TransitionEventRecord } from "../audit/index.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";
import type { WorkflowExecutionAdapters } from "./repositories.ts";
import type { WorkflowSlaBreachSeverity } from "./sla-types.ts";

export interface WorkflowMonitoringSummary {
  readonly pendingScheduledActionCount: number;
  readonly dueScheduledActionCount: number;
  readonly failedScheduledActionCount: number;
  readonly retryScheduledActionCount: number;
  readonly activeSlaCount: number;
  readonly breachedSlaCount: number;
  readonly breachedBySeverity: Readonly<Record<WorkflowSlaBreachSeverity, number>>;
  readonly byLifecycle: Readonly<
    Partial<
      Record<
        TransitionLifecycle,
        {
          readonly scheduledActionCount: number;
          readonly activeSlaCount: number;
          readonly breachedSlaCount: number;
        }
      >
    >
  >;
}

export async function buildWorkflowMonitoringSummary(input: {
  readonly now?: string;
  readonly lifecycle?: TransitionLifecycle;
  readonly entityType?: TransitionEventRecord["entityType"];
  readonly adapters?: WorkflowExecutionAdapters;
}): Promise<WorkflowMonitoringSummary> {
  const now = input.now ?? new Date().toISOString();
  const actions =
    (await input.adapters?.listWorkflowExecutionsForMonitoring?.(input)) ?? [];
  const timers =
    (await input.adapters?.listWorkflowSlaTimersForMonitoring?.(input)) ?? [];
  const breaches =
    (await input.adapters?.listWorkflowSlaBreachesForMonitoring?.(input)) ?? [];
  const dueAt = new Date(now).getTime();
  const breachedBySeverity: Record<WorkflowSlaBreachSeverity, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  for (const breach of breaches) {
    breachedBySeverity[breach.severity] += 1;
  }

  return {
    pendingScheduledActionCount: actions.filter(
      (action) => action.status === "PENDING",
    ).length,
    dueScheduledActionCount: actions.filter(
      (action) =>
        (action.status === "PENDING" || action.status === "RETRY_SCHEDULED") &&
        (!action.scheduledFor ||
          new Date(action.scheduledFor).getTime() <= dueAt ||
          (action.nextRetryAt && new Date(action.nextRetryAt).getTime() <= dueAt)),
    ).length,
    failedScheduledActionCount: actions.filter((action) => action.status === "FAILED")
      .length,
    retryScheduledActionCount: actions.filter(
      (action) => action.status === "RETRY_SCHEDULED",
    ).length,
    activeSlaCount: timers.filter((timer) => timer.status === "ACTIVE").length,
    breachedSlaCount:
      timers.filter((timer) => timer.status === "BREACHED").length + breaches.length,
    breachedBySeverity,
    byLifecycle: buildLifecycleBreakdown(actions, timers, breaches),
  };
}

function buildLifecycleBreakdown(
  actions: readonly { readonly lifecycle: TransitionLifecycle }[],
  timers: readonly {
    readonly lifecycle: TransitionLifecycle;
    readonly status: string;
  }[],
  breaches: readonly { readonly lifecycle: TransitionLifecycle }[],
): WorkflowMonitoringSummary["byLifecycle"] {
  const lifecycles: readonly TransitionLifecycle[] = [
    "work-order",
    "invoice",
    "quote",
  ];

  return Object.fromEntries(
    lifecycles.map((lifecycle) => [
      lifecycle,
      {
        scheduledActionCount: actions.filter((action) => action.lifecycle === lifecycle)
          .length,
        activeSlaCount: timers.filter(
          (timer) => timer.lifecycle === lifecycle && timer.status === "ACTIVE",
        ).length,
        breachedSlaCount:
          timers.filter(
            (timer) => timer.lifecycle === lifecycle && timer.status === "BREACHED",
          ).length +
          breaches.filter((breach) => breach.lifecycle === lifecycle).length,
      },
    ]),
  );
}
