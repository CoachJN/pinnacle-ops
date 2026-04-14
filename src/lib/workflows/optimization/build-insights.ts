import { buildOptimizedWorkQueue } from "./build-work-queue.ts";
import { signal } from "./priority-scoring.ts";
import type {
  BuildWorkflowOperationalInsightsInput,
  OptimizationPriorityTier,
  WorkflowOperationalInsights,
} from "./types.ts";

export function buildWorkflowOperationalInsights(
  input: BuildWorkflowOperationalInsightsInput,
): WorkflowOperationalInsights {
  const generatedAt = input.now ?? new Date().toISOString();
  const queue =
    input.queue ??
    buildOptimizedWorkQueue({
      entities: input.entities,
      availableAgents: input.availableAgents,
      now: generatedAt,
    });
  const distributionByPriority: Record<OptimizationPriorityTier, number> = {
    LOW: queue.groupedByPriority.LOW.length,
    MEDIUM: queue.groupedByPriority.MEDIUM.length,
    HIGH: queue.groupedByPriority.HIGH.length,
    CRITICAL: queue.groupedByPriority.CRITICAL.length,
  };
  const breachedSlaCount = queue.items.filter((item) =>
    item.riskSignals.some((risk) => risk.type === "SLA_BREACHED"),
  ).length;
  const overdueInvoiceCount = queue.items.filter((item) =>
    item.riskSignals.some((risk) => risk.type === "INVOICE_OVERDUE"),
  ).length;
  const highRiskWorkCount = queue.items.filter(
    (item) => item.priority.tier === "HIGH" || item.priority.tier === "CRITICAL",
  ).length;
  const workloadByRole = Object.fromEntries(
    Object.entries(
      queue.items.reduce<Record<string, number>>((accumulator, item) => {
        const role = item.assignmentRecommendation.recommendedRole;
        accumulator[role] = (accumulator[role] ?? 0) + 1;
        return accumulator;
      }, {}),
    ),
  );
  const quoteDeferredCount = queue.items.filter(
    (item) =>
      item.lifecycle === "quote" &&
      (item.quoteRuntimePosture === "deferred" ||
        item.quoteRuntimePosture == null),
  ).length;
  const quoteLimitedCount = queue.items.filter(
    (item) =>
      item.lifecycle === "quote" && item.quoteRuntimePosture === "limited",
  ).length;

  return {
    generatedAt,
    totalActiveWork: queue.items.length,
    breachedSlaCount,
    overdueInvoiceCount,
    highRiskWorkCount,
    workloadByRole,
    distributionByPriority,
    quoteRuntimePosture: {
      deferredCount: quoteDeferredCount,
      limitedInsightCount: quoteLimitedCount,
      message:
        "Quote optimization remains limited/deferred until quote runtime persistence is active.",
    },
    contributingSignals: [
      signal({
        code: "insight.queue-size",
        label: "Queue size",
        weight: 0,
        severity: "LOW",
        message: `${queue.items.length} work items were included in operational insights.`,
        source: "orchestration",
      }),
      signal({
        code: "insight.high-risk-count",
        label: "High risk work",
        weight: 0,
        severity: highRiskWorkCount > 0 ? "HIGH" : "LOW",
        message: `${highRiskWorkCount} work items are high or critical priority.`,
        source: "status",
      }),
    ],
    queue,
  };
}
