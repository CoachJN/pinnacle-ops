import type { TransitionEventRecord } from "../audit/index.ts";
import type {
  WorkflowOrchestrationActionDefinition,
  WorkflowOrchestrationDelay,
  WorkflowOrchestrationRule,
} from "./rule-types.ts";
import type { WorkflowOrchestrationAction } from "./types.ts";

export function buildWorkflowOrchestrationActions(input: {
  readonly event: TransitionEventRecord;
  readonly rules: readonly WorkflowOrchestrationRule[];
  readonly now?: string;
}): readonly WorkflowOrchestrationAction[] {
  const createdAt = input.now ?? input.event.timestamp;

  return input.rules.flatMap((rule) =>
    rule.actions.map((actionDefinition, index) =>
      buildActionFromDefinition({
        event: input.event,
        rule,
        actionDefinition,
        actionIndex: index,
        createdAt,
      }),
    ),
  );
}

function buildActionFromDefinition(input: {
  readonly event: TransitionEventRecord;
  readonly rule: WorkflowOrchestrationRule;
  readonly actionDefinition: WorkflowOrchestrationActionDefinition;
  readonly actionIndex: number;
  readonly createdAt: string;
}): WorkflowOrchestrationAction {
  const scheduledFor = input.actionDefinition.delay
    ? addDelay(input.createdAt, input.actionDefinition.delay)
    : null;
  const targetRole =
    input.actionDefinition.assignedAudience?.type === "role"
      ? input.actionDefinition.assignedAudience.roles[0]
      : undefined;

  return {
    actionId: buildActionId(input),
    ruleKey: input.rule.ruleKey,
    triggerType: input.rule.trigger.type,
    lifecycle: input.rule.lifecycle,
    entityType: input.rule.entityType,
    entityId: input.event.entityId,
    sourceEventType: input.event.eventType,
    sourcePreviousStatus: input.event.previousStatus,
    sourceNewStatus: input.event.newStatus,
    actionType: input.actionDefinition.actionType,
    status: scheduledFor ? "SCHEDULED" : "PENDING",
    priority: input.rule.priority,
    severity: input.rule.severity,
    scheduledFor,
    assignedAudience: input.actionDefinition.assignedAudience,
    targetRole,
    targetQueue: input.actionDefinition.targetQueue,
    message: input.actionDefinition.message,
    metadata: {
      ...(input.actionDefinition.metadata ?? {}),
      sourceEventId: input.event.eventId ?? null,
      sourceEventTimestamp: input.event.timestamp,
      schedulerRuntime: scheduledFor ? "persistence-only" : undefined,
    },
    createdAt: input.createdAt,
  };
}

function buildActionId(input: {
  readonly event: TransitionEventRecord;
  readonly rule: WorkflowOrchestrationRule;
  readonly actionDefinition: WorkflowOrchestrationActionDefinition;
  readonly actionIndex: number;
}): string {
  const eventKey = input.event.eventId ?? `${input.event.entityId}-${input.event.timestamp}`;
  return [
    "orchestration",
    input.rule.ruleKey,
    input.actionDefinition.actionType,
    input.actionIndex,
    eventKey,
  ]
    .join(":")
    .replaceAll(/\s+/g, "-");
}

function addDelay(fromIso: string, delay: WorkflowOrchestrationDelay): string {
  const from = new Date(fromIso);
  const millisByUnit: Record<WorkflowOrchestrationDelay["unit"], number> = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  };

  return new Date(from.getTime() + delay.amount * millisByUnit[delay.unit]).toISOString();
}
