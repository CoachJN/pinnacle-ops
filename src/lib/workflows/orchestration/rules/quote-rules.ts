import { QUOTE_STATUS } from "../../lifecycle/index.ts";
import { PLATFORM_ROLES } from "../../rbac-transition/index.ts";
import type { WorkflowOrchestrationRule } from "../rule-types.ts";

export const QUOTE_ORCHESTRATION_RULES = [
  {
    ruleKey: "quote.sent-to-client.deferred-client-follow-up",
    lifecycle: "quote",
    entityType: "quote",
    trigger: {
      type: "TRANSITION_EVENT",
      eventType: "QUOTE_STATUS_CHANGED",
    },
    conditions: { newStatus: QUOTE_STATUS.SentToClient },
    enabled: false,
    runtimeDeferred: true,
    priority: 50,
    severity: "normal",
    description:
      "Future quote client decision follow-up. Runtime quote transition persistence remains deferred.",
    actions: [
      {
        actionType: "REQUEST_CLIENT_APPROVAL_FOLLOW_UP",
        message: "Follow up on client quote approval once quote runtime events are active.",
        assignedAudience: { type: "role", roles: [PLATFORM_ROLES.Coordinator] },
        delay: { amount: 2, unit: "days" },
        metadata: { runtimePosture: "quote-orchestration-deferred" },
      },
    ],
  },
  {
    ruleKey: "quote.requested.deferred-quote-follow-up",
    lifecycle: "quote",
    entityType: "quote",
    trigger: {
      type: "TRANSITION_EVENT",
      eventType: "QUOTE_STATUS_CHANGED",
    },
    conditions: { newStatus: QUOTE_STATUS.Requested },
    enabled: false,
    runtimeDeferred: true,
    priority: 40,
    severity: "normal",
    description:
      "Future quote request follow-up. Defined for typed readiness, not live execution.",
    actions: [
      {
        actionType: "REQUEST_QUOTE_FOLLOW_UP",
        message: "Follow up on requested quote once quote runtime events are active.",
        assignedAudience: { type: "role", roles: [PLATFORM_ROLES.Coordinator] },
        metadata: { runtimePosture: "quote-orchestration-deferred" },
      },
    ],
  },
] as const satisfies readonly WorkflowOrchestrationRule[];
