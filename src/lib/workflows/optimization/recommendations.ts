import { INVOICE_STATUS, WORK_ORDER_STATUS } from "../lifecycle/index.ts";
import type { WorkflowActionCode } from "../action-gating/index.ts";
import { computeWorkflowPriorityScore } from "./priority-scoring.ts";
import type {
  NextWorkflowActionRecommendation,
  WorkflowOptimizationContext,
} from "./types.ts";

const statusRecommendations: Readonly<
  Record<string, { readonly actionCode: WorkflowActionCode; readonly message: string; readonly reason: string }>
> = {
  [WORK_ORDER_STATUS.New]: {
    actionCode: "move_to_triage",
    message: "Move work order into triage.",
    reason: "New work orders need coordinator triage before downstream work.",
  },
  [WORK_ORDER_STATUS.Triage]: {
    actionCode: "request_quote",
    message: "Decide whether quote follow-up or scheduling is needed.",
    reason: "Triage is the intake decision point for the work order.",
  },
  [WORK_ORDER_STATUS.AwaitingQuote]: {
    actionCode: "mark_quote_received",
    message: "Follow up on quote and mark it received when reliable quote data arrives.",
    reason: "Work order is waiting on quote information.",
  },
  [WORK_ORDER_STATUS.AwaitingClientApproval]: {
    actionCode: "approve_to_proceed",
    message: "Follow up on client approval and proceed only after approval is recorded.",
    reason: "Client approval is required before proceeding.",
  },
  [WORK_ORDER_STATUS.ApprovedToProceed]: {
    actionCode: "move_to_scheduling",
    message: "Schedule work order.",
    reason: "Approved work should move into scheduling.",
  },
  [WORK_ORDER_STATUS.Scheduling]: {
    actionCode: "mark_scheduled",
    message: "Confirm schedule.",
    reason: "Work order is in scheduling and needs a scheduled date/assignment.",
  },
  [WORK_ORDER_STATUS.Scheduled]: {
    actionCode: "start_work",
    message: "Start scheduled work.",
    reason: "Scheduled work is ready for field execution when conditions allow.",
  },
  [WORK_ORDER_STATUS.InProgress]: {
    actionCode: "mark_work_completed",
    message: "Update completion when work is finished.",
    reason: "In-progress work needs completion tracking.",
  },
  [WORK_ORDER_STATUS.WorkCompleted]: {
    actionCode: "send_to_qa",
    message: "Send completed work to QA.",
    reason: "Completed work should be reviewed before invoicing.",
  },
  [WORK_ORDER_STATUS.QaReview]: {
    actionCode: "ready_for_invoicing",
    message: "Mark ready for invoicing after QA approval.",
    reason: "QA-reviewed work can move to finance when approved.",
  },
  [WORK_ORDER_STATUS.ReadyForInvoicing]: {
    actionCode: "complete_work_order",
    message: "Complete work order when invoice requirements are satisfied.",
    reason: "Work order is ready for the finance workflow; completion remains lifecycle-gated.",
  },
  [WORK_ORDER_STATUS.Escalated]: {
    actionCode: "escalate_work_order",
    message: "Escalate to manager.",
    reason: "Escalated work needs manager review before routine handling.",
  },
  [INVOICE_STATUS.Ready]: {
    actionCode: "draft_invoice",
    message: "Draft invoice.",
    reason: "Ready invoices should be drafted by finance.",
  },
  [INVOICE_STATUS.Draft]: {
    actionCode: "send_invoice",
    message: "Send invoice.",
    reason: "Draft invoice is ready for send review.",
  },
  [INVOICE_STATUS.Sent]: {
    actionCode: "mark_overdue",
    message: "Monitor invoice due date.",
    reason: "Sent invoices need payment follow-up and overdue evaluation.",
  },
  [INVOICE_STATUS.Overdue]: {
    actionCode: "mark_paid",
    message: "Review overdue invoice.",
    reason: "Overdue invoice needs collection or payment reconciliation review.",
  },
};

export function recommendNextWorkflowActions(
  entityContext: WorkflowOptimizationContext,
): readonly NextWorkflowActionRecommendation[] {
  if (entityContext.lifecycle === "quote") {
    return [
      {
        actionCode: "quote_runtime_deferred",
        message: "Quote optimization is limited until quote runtime persistence is active.",
        priority: "LOW",
        reason: "Quote action-gating is currently unsupported; no active quote action is recommended.",
        contributingSignals: [],
        runtimePosture: entityContext.quoteRuntimePosture ?? "deferred",
      },
    ];
  }

  const priority = computeWorkflowPriorityScore(entityContext);
  const status = entityContext.status ?? entityContext.entity?.status ?? null;
  const recommendations: NextWorkflowActionRecommendation[] = [];
  const primary = status ? statusRecommendations[status] : undefined;
  const allowedCodes = new Set(
    entityContext.actionAvailability?.actions
      .filter((action) => action.allowed)
      .map((action) => action.actionCode),
  );
  const hasActionAvailability = Boolean(entityContext.actionAvailability);

  if (primary && (!hasActionAvailability || allowedCodes.has(primary.actionCode))) {
    recommendations.push({
      ...primary,
      priority: priority.tier,
      contributingSignals: priority.contributingFactors,
    });
  }

  for (const action of entityContext.actionAvailability?.actions ?? []) {
    if (!action.allowed || recommendations.some((item) => item.actionCode === action.actionCode)) {
      continue;
    }

    recommendations.push({
      actionCode: action.actionCode,
      message: action.label,
      priority: priority.tier,
      reason: action.message,
      contributingSignals: priority.contributingFactors,
    });
  }

  if (
    entityContext.lifecycle === "work-order" &&
    (priority.tier === "CRITICAL" || priority.tier === "HIGH")
  ) {
    const escalateCode = "escalate_work_order";
    const escalationAvailable =
      !hasActionAvailability || allowedCodes.has(escalateCode);

    if (
      escalationAvailable &&
      !recommendations.some((item) => item.actionCode === escalateCode)
    ) {
      recommendations.push({
        actionCode: escalateCode,
        message: "Escalate to manager.",
        priority: priority.tier,
        reason: "High-priority risk signals require attention before routine queue work.",
        contributingSignals: priority.contributingFactors,
      });
    }
  }

  return recommendations;
}
