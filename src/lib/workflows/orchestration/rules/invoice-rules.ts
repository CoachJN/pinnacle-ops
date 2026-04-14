import { INVOICE_STATUS } from "../../lifecycle/index.ts";
import type { WorkflowOrchestrationRule } from "../rule-types.ts";

export const INVOICE_ORCHESTRATION_RULES = [
  {
    ruleKey: "invoice.sent.payment-recheck",
    lifecycle: "invoice",
    entityType: "invoice",
    trigger: {
      type: "TRANSITION_EVENT",
      eventType: "INVOICE_STATUS_CHANGED",
    },
    conditions: { newStatus: INVOICE_STATUS.Sent },
    enabled: true,
    priority: 60,
    severity: "normal",
    description: "Schedule durable payment follow-up intent after invoice send.",
    actions: [
      {
        actionType: "SCHEDULE_RECHECK",
        message: "Recheck invoice payment status for overdue evaluation.",
        assignedAudience: { type: "queue", key: "finance-review" },
        targetQueue: "finance-review",
        delay: { amount: 7, unit: "days" },
        metadata: {
          recheckKind: "invoice-payment-follow-up",
          schedulerRuntime: "deferred",
        },
      },
    ],
  },
  {
    ruleKey: "invoice.overdue.collection-review",
    lifecycle: "invoice",
    entityType: "invoice",
    trigger: {
      type: "TRANSITION_EVENT",
      eventType: "INVOICE_STATUS_CHANGED",
    },
    conditions: { newStatus: INVOICE_STATUS.Overdue },
    enabled: true,
    priority: 90,
    severity: "critical",
    description: "Create durable collection escalation intent when an invoice becomes overdue.",
    actions: [
      {
        actionType: "CREATE_ESCALATION_RECORD",
        message: "Invoice is overdue and needs collection escalation review.",
        assignedAudience: { type: "queue", key: "collections-review" },
        targetQueue: "collections-review",
        metadata: { escalationKind: "invoice-overdue" },
      },
      {
        actionType: "REQUEST_COLLECTION_REVIEW",
        message: "Review collection posture for the overdue invoice.",
        assignedAudience: { type: "queue", key: "collections-review" },
        targetQueue: "collections-review",
        metadata: { reviewKind: "invoice-collection" },
      },
    ],
  },
] as const satisfies readonly WorkflowOrchestrationRule[];
