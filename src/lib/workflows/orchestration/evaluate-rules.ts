import type { TransitionEventRecord } from "../audit/index.ts";
import { INVOICE_ORCHESTRATION_RULES } from "./rules/invoice-rules.ts";
import { QUOTE_ORCHESTRATION_RULES } from "./rules/quote-rules.ts";
import { WORK_ORDER_ORCHESTRATION_RULES } from "./rules/work-order-rules.ts";
import type { WorkflowOrchestrationRule } from "./rule-types.ts";
import { buildWorkflowOrchestrationActions } from "./build-orchestration-actions.ts";
import type {
  WorkflowOrchestrationAction,
  WorkflowOrchestrationInput,
  WorkflowOrchestrationWarning,
} from "./types.ts";

export interface WorkflowOrchestrationEvaluationResult {
  readonly matchedRules: readonly WorkflowOrchestrationRule[];
  readonly actions: readonly WorkflowOrchestrationAction[];
  readonly warnings: readonly WorkflowOrchestrationWarning[];
}

export function evaluateWorkOrderOrchestrationRules(
  event: TransitionEventRecord,
  now?: string,
): WorkflowOrchestrationEvaluationResult {
  return evaluateEventRules(event, WORK_ORDER_ORCHESTRATION_RULES, now);
}

export function evaluateInvoiceOrchestrationRules(
  event: TransitionEventRecord,
  now?: string,
): WorkflowOrchestrationEvaluationResult {
  return evaluateEventRules(event, INVOICE_ORCHESTRATION_RULES, now);
}

export function evaluateQuoteOrchestrationRules(
  event: TransitionEventRecord,
): WorkflowOrchestrationEvaluationResult {
  const matchedDeferredRules = QUOTE_ORCHESTRATION_RULES.filter((rule) =>
    matchesTransitionEventRule(event, rule, { includeRuntimeDeferred: true }),
  );

  return {
    matchedRules: matchedDeferredRules,
    actions: [],
    warnings: matchedDeferredRules.length
      ? [
          {
            code: "WORKFLOW_ORCHESTRATION_QUOTE_RUNTIME_DEFERRED",
            message:
              "Quote orchestration rules are defined, but runtime quote orchestration execution remains deferred.",
            details: {
              entityId: event.entityId,
              newStatus: event.newStatus,
              matchedRuleKeys: matchedDeferredRules.map((rule) => rule.ruleKey),
            },
          },
        ]
      : [],
  };
}

export function evaluateWorkflowOrchestrationRules(
  input: WorkflowOrchestrationInput,
): WorkflowOrchestrationEvaluationResult {
  if (input.triggerType === "CONDITION_CHECK") {
    return { matchedRules: [], actions: [], warnings: [] };
  }

  if (!input.event) {
    return {
      matchedRules: [],
      actions: [],
      warnings: [
        {
          code: "WORKFLOW_ORCHESTRATION_EVENT_UNAVAILABLE",
          message:
            "Workflow orchestration skipped because no reliable transition event record is available.",
        },
      ],
    };
  }

  switch (input.event.lifecycle) {
    case "work-order":
      return evaluateWorkOrderOrchestrationRules(input.event, input.now);
    case "invoice":
      return evaluateInvoiceOrchestrationRules(input.event, input.now);
    case "quote":
      return evaluateQuoteOrchestrationRules(input.event);
    default:
      return { matchedRules: [], actions: [], warnings: [] };
  }
}

function evaluateEventRules(
  event: TransitionEventRecord,
  rules: readonly WorkflowOrchestrationRule[],
  now?: string,
): WorkflowOrchestrationEvaluationResult {
  const matchedRules = rules.filter((rule) => matchesTransitionEventRule(event, rule));
  return {
    matchedRules,
    actions: buildWorkflowOrchestrationActions({ event, rules: matchedRules, now }),
    warnings: [],
  };
}

function matchesTransitionEventRule(
  event: TransitionEventRecord,
  rule: WorkflowOrchestrationRule,
  options: { readonly includeRuntimeDeferred?: boolean } = {},
): boolean {
  return Boolean(
    (rule.enabled || options.includeRuntimeDeferred) &&
      (!rule.runtimeDeferred || options.includeRuntimeDeferred) &&
      rule.trigger.type === "TRANSITION_EVENT" &&
      rule.lifecycle === event.lifecycle &&
      rule.entityType === event.entityType &&
      (!rule.trigger.eventType || rule.trigger.eventType === event.eventType) &&
      matchesStatusCondition(event.previousStatus, rule.conditions.previousStatus) &&
      matchesStatusCondition(event.newStatus, rule.conditions.newStatus) &&
      matchesMetadata(event.metadata, rule.conditions.metadataEquals),
  );
}

function matchesStatusCondition(
  value: string,
  condition: string | readonly string[] | undefined,
): boolean {
  if (!condition) {
    return true;
  }

  return Array.isArray(condition) ? condition.includes(value) : condition === value;
}

function matchesMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
  expected: Readonly<Record<string, unknown>> | undefined,
): boolean {
  if (!expected) {
    return true;
  }

  return Object.entries(expected).every(([key, expectedValue]) =>
    Object.is(metadata?.[key], expectedValue),
  );
}
