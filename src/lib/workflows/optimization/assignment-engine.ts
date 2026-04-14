import { INVOICE_STATUS, WORK_ORDER_STATUS } from "../lifecycle/index.ts";
import { PLATFORM_ROLES } from "../rbac-transition/index.ts";
import { signal } from "./priority-scoring.ts";
import type {
  AssignmentRecommendation,
  OptimizationAgent,
  WorkflowOptimizationContext,
} from "./types.ts";

export function recommendAssignment(
  entityContext: WorkflowOptimizationContext,
  availableAgents: readonly OptimizationAgent[] = [],
): AssignmentRecommendation {
  const recommendedRole = recommendRole(entityContext);
  const roleSignal = signal({
    code: "assignment.role-match",
    label: "Role recommendation",
    weight: 0,
    severity: "LOW",
    message: `Recommended role is ${recommendedRole}.`,
    source: "assignment",
    details: { recommendedRole },
  });
  const matchingAgents = availableAgents.filter((agent) =>
    agent.roles.includes(recommendedRole),
  );
  const recommendedAgent = matchingAgents
    .slice()
    .sort(compareAgentsForAssignment)[0];

  if (!recommendedAgent) {
    return {
      recommendedRole,
      reason: `No reliable agent pool was supplied; routing to ${recommendedRole} by lifecycle/status rule.`,
      contributingSignals: [roleSignal],
    };
  }

  return {
    recommendedRole,
    recommendedAgentId: recommendedAgent.agentId,
    reason: `${recommendedAgent.agentId} matches ${recommendedRole} and has the lightest available workload signal.`,
    contributingSignals: [
      roleSignal,
      signal({
        code: "assignment.least-loaded-agent",
        label: "Least loaded matching agent",
        weight: 0,
        severity: "LOW",
        message: "Agent recommendation used role match, active load, and last-assigned ordering.",
        source: "assignment",
        details: {
          agentId: recommendedAgent.agentId,
          activeWorkCount: recommendedAgent.activeWorkCount ?? 0,
          lastAssignedAt: recommendedAgent.lastAssignedAt ?? null,
        },
      }),
    ],
  };
}

function recommendRole(entityContext: WorkflowOptimizationContext): AssignmentRecommendation["recommendedRole"] {
  const status = entityContext.status ?? entityContext.entity?.status ?? null;
  const hasCriticalRisk = (entityContext.slaTimers ?? []).some(
    (timer) =>
      timer.entityId === entityContext.entityId &&
      timer.status === "BREACHED" &&
      (timer.breachSeverity === "HIGH" || timer.breachSeverity === "CRITICAL"),
  );

  if (hasCriticalRisk || status === WORK_ORDER_STATUS.Escalated) {
    return PLATFORM_ROLES.Manager;
  }

  if (
    entityContext.lifecycle === "invoice" ||
    status === WORK_ORDER_STATUS.ReadyForInvoicing ||
    status === INVOICE_STATUS.Overdue ||
    status === "overdue"
  ) {
    return PLATFORM_ROLES.FinanceAdmin;
  }

  if (
    status === WORK_ORDER_STATUS.AwaitingClientApproval ||
    status === WORK_ORDER_STATUS.QuoteReview
  ) {
    return PLATFORM_ROLES.Manager;
  }

  return PLATFORM_ROLES.Coordinator;
}

function compareAgentsForAssignment(
  left: OptimizationAgent,
  right: OptimizationAgent,
): number {
  const loadDelta = (left.activeWorkCount ?? 0) - (right.activeWorkCount ?? 0);
  if (loadDelta !== 0) {
    return loadDelta;
  }

  const leftAssignedAt = left.lastAssignedAt
    ? new Date(left.lastAssignedAt).getTime()
    : 0;
  const rightAssignedAt = right.lastAssignedAt
    ? new Date(right.lastAssignedAt).getTime()
    : 0;

  return leftAssignedAt - rightAssignedAt;
}
