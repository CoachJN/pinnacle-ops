import { recommendAssignment } from "./assignment-engine.ts";
import { computeWorkflowPriorityScore } from "./priority-scoring.ts";
import { recommendNextWorkflowActions } from "./recommendations.ts";
import { detectWorkflowRiskSignals } from "./risk-detection.ts";
import type {
  BuildOptimizedWorkQueueInput,
  OptimizedWorkQueue,
  OptimizedWorkQueueItem,
  OptimizationPriorityTier,
  WorkflowOptimizationContext,
} from "./types.ts";

const priorityOrder: Readonly<Record<OptimizationPriorityTier, number>> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function buildOptimizedWorkQueue(
  input: BuildOptimizedWorkQueueInput,
): OptimizedWorkQueue {
  const generatedAt = input.now ?? new Date().toISOString();
  const items = input.entities
    .map((entity) =>
      buildOptimizedWorkQueueItem(
        { ...entity, now: entity.now ?? generatedAt },
        input.availableAgents ?? [],
      ),
    )
    .sort(compareQueueItems);

  return {
    items,
    groupedByPriority: groupByPriority(items),
    generatedAt,
  };
}

function buildOptimizedWorkQueueItem(
  context: WorkflowOptimizationContext,
  availableAgents: BuildOptimizedWorkQueueInput["availableAgents"],
): OptimizedWorkQueueItem {
  const priority = computeWorkflowPriorityScore(context);
  const riskSignals = detectWorkflowRiskSignals(context);
  const assignmentRecommendation = recommendAssignment(
    context,
    availableAgents ?? [],
  );
  const nextActions = recommendNextWorkflowActions(context);

  return {
    lifecycle: context.lifecycle,
    entityType: context.entityType,
    entityId: context.entityId,
    status: context.status ?? context.entity?.status ?? null,
    entity: context.entity,
    priority,
    riskSignals,
    assignmentRecommendation,
    nextActions,
    rankingReasons: [
      ...priority.reasons,
      assignmentRecommendation.reason,
      ...nextActions.map((action) => action.reason),
    ],
    quoteRuntimePosture:
      context.lifecycle === "quote"
        ? context.quoteRuntimePosture ?? "deferred"
        : context.quoteRuntimePosture,
  };
}

function compareQueueItems(
  left: OptimizedWorkQueueItem,
  right: OptimizedWorkQueueItem,
): number {
  const scoreDelta = right.priority.score - left.priority.score;
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const tierDelta =
    priorityOrder[right.priority.tier] - priorityOrder[left.priority.tier];
  if (tierDelta !== 0) {
    return tierDelta;
  }

  return left.entityId.localeCompare(right.entityId);
}

function groupByPriority(
  items: readonly OptimizedWorkQueueItem[],
): OptimizedWorkQueue["groupedByPriority"] {
  return {
    CRITICAL: items.filter((item) => item.priority.tier === "CRITICAL"),
    HIGH: items.filter((item) => item.priority.tier === "HIGH"),
    MEDIUM: items.filter((item) => item.priority.tier === "MEDIUM"),
    LOW: items.filter((item) => item.priority.tier === "LOW"),
  };
}
