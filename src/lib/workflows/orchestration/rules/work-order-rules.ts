import { WORK_ORDER_STATUS } from "../../lifecycle/index.ts";
import { PLATFORM_ROLES } from "../../rbac-transition/index.ts";
import type { WorkflowOrchestrationRule } from "../rule-types.ts";

export const WORK_ORDER_ORCHESTRATION_RULES = [
  {
    ruleKey: "work-order.awaiting-quote.follow-up",
    lifecycle: "work-order",
    entityType: "work-order",
    trigger: {
      type: "TRANSITION_EVENT",
      eventType: "WORK_ORDER_STATUS_CHANGED",
    },
    conditions: { newStatus: WORK_ORDER_STATUS.QuoteRequired },
    enabled: true,
    priority: 50,
    severity: "normal",
    description: "Create durable coordinator follow-up when a work order is waiting on a quote.",
    actions: [
      {
        actionType: "CREATE_FOLLOW_UP_TASK",
        message: "Follow up on the requested quote for this work order.",
        assignedAudience: {
          type: "role",
          roles: [PLATFORM_ROLES.Coordinator, PLATFORM_ROLES.Manager],
        },
        metadata: { followUpKind: "quote-request" },
      },
      {
        actionType: "REQUEST_QUOTE_FOLLOW_UP",
        message: "Track quote follow-up until quote information is received.",
        assignedAudience: { type: "queue", key: "quote-follow-up" },
        targetQueue: "quote-follow-up",
        delay: { amount: 2, unit: "days" },
        metadata: { followUpKind: "scheduled-quote-recheck" },
      },
    ],
  },
  {
    ruleKey: "work-order.awaiting-client-approval.follow-up",
    lifecycle: "work-order",
    entityType: "work-order",
    trigger: {
      type: "TRANSITION_EVENT",
      eventType: "WORK_ORDER_STATUS_CHANGED",
    },
    conditions: { newStatus: WORK_ORDER_STATUS.ClientApprovalRequested },
    enabled: true,
    priority: 60,
    severity: "high",
    description: "Create durable client approval and internal review follow-up.",
    actions: [
      {
        actionType: "CREATE_FOLLOW_UP_TASK",
        message: "Follow up on the client's quote approval decision.",
        assignedAudience: { type: "queue", key: "client-approval-follow-up" },
        targetQueue: "client-approval-follow-up",
        metadata: { followUpKind: "client-approval" },
      },
      {
        actionType: "REQUEST_CLIENT_APPROVAL_FOLLOW_UP",
        message: "Keep the client approval request visible until a decision is received.",
        assignedAudience: { type: "queue", key: "client-approval-follow-up" },
        targetQueue: "client-approval-follow-up",
        delay: { amount: 2, unit: "days" },
        metadata: { followUpKind: "scheduled-client-approval-recheck" },
      },
      {
        actionType: "REQUEST_INTERNAL_REVIEW",
        message: "Review the quote approval posture while the client decision is pending.",
        assignedAudience: { type: "role", roles: [PLATFORM_ROLES.Manager] },
        metadata: { reviewKind: "client-approval-context" },
      },
    ],
  },
  {
    ruleKey: "work-order.client-approved.scheduling",
    lifecycle: "work-order",
    entityType: "work-order",
    trigger: {
      type: "TRANSITION_EVENT",
      eventType: "WORK_ORDER_STATUS_CHANGED",
    },
    conditions: { newStatus: WORK_ORDER_STATUS.ClientApproved },
    enabled: true,
    priority: 70,
    severity: "high",
    description: "Flag client-approved work for scheduling attention.",
    actions: [
      {
        actionType: "FLAG_ENTITY",
        message: "Work order is client approved and needs scheduling attention.",
        assignedAudience: { type: "queue", key: "scheduling" },
        targetQueue: "scheduling",
        metadata: { flag: "needs-scheduling" },
      },
      {
        actionType: "CREATE_FOLLOW_UP_TASK",
        message: "Schedule the client-approved work order.",
        assignedAudience: { type: "role", roles: [PLATFORM_ROLES.Coordinator] },
        metadata: { followUpKind: "scheduling" },
      },
    ],
  },
  {
    ruleKey: "work-order.ready-for-invoicing.finance",
    lifecycle: "work-order",
    entityType: "work-order",
    trigger: {
      type: "TRANSITION_EVENT",
      eventType: "WORK_ORDER_STATUS_CHANGED",
    },
    conditions: { newStatus: WORK_ORDER_STATUS.ReadyForInvoicing },
    enabled: true,
    priority: 80,
    severity: "high",
    description: "Flag completed work for finance and invoicing follow-up.",
    actions: [
      {
        actionType: "FLAG_ENTITY",
        message: "Work order is ready for the finance queue.",
        assignedAudience: { type: "queue", key: "finance-review" },
        targetQueue: "finance-review",
        metadata: { flag: "ready-for-invoicing" },
      },
      {
        actionType: "CREATE_FOLLOW_UP_TASK",
        message: "Prepare invoice follow-up for this work order.",
        assignedAudience: { type: "role", roles: [PLATFORM_ROLES.FinanceAdmin] },
        metadata: { followUpKind: "invoicing" },
      },
    ],
  },
] as const satisfies readonly WorkflowOrchestrationRule[];
