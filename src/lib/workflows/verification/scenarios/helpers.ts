import { getAvailableLifecycleActions } from "../../action-gating/index.ts";
import {
  buildWorkflowMonitoringSummary,
  evaluateWorkflowSlaBreaches,
  processScheduledWorkflowAction,
  processScheduledWorkflowActionsBatch,
  type ScheduledWorkflowExecutionRecord,
} from "../../execution/index.ts";
import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  type InvoiceLifecycleStatus,
  type WorkOrderLifecycleStatus,
} from "../../lifecycle/index.ts";
import { PLATFORM_ROLES } from "../../rbac-transition/index.ts";
import {
  applyInvoiceTransition,
  applyQuoteTransition,
  applyWorkOrderTransition,
} from "../../transition-service/index.ts";
import type { WorkflowVerificationEnvironment } from "../fixtures.ts";
import type {
  WorkflowVerificationAssertion,
  WorkflowVerificationScenario,
  WorkflowVerificationStep,
} from "../types.ts";

export { INVOICE_STATUS, PLATFORM_ROLES, QUOTE_STATUS, WORK_ORDER_STATUS };

export function workOrderTransitionStep(input: {
  readonly stepKey: string;
  readonly description: string;
  readonly workOrderId?: string;
  readonly to: WorkOrderLifecycleStatus;
  readonly role?: string | null;
  readonly actorType?: string;
  readonly expectedOutcome?: WorkflowVerificationStep["expectedOutcome"];
  readonly assertions?: readonly WorkflowVerificationAssertion[];
}): WorkflowVerificationStep {
  return {
    stepKey: input.stepKey,
    description: input.description,
    attemptedAction: `work-order -> ${input.to}`,
    expectedOutcome: input.expectedOutcome ?? "success",
    assertions: input.assertions,
    async run(env) {
      const result = await applyWorkOrderTransition({
        lifecycle: "work-order",
        entityType: "work-order",
        entityId: input.workOrderId ?? "wo-standard",
        to: input.to,
        actorType: input.actorType ?? "USER",
        role: input.role ?? PLATFORM_ROLES.Coordinator,
        actorUserId: "verification-user",
        repositories: env,
        metadata: {
          correlationId: `${input.stepKey}-correlation`,
          "work-order.awaiting-quote.durationHours": 1,
          "work-order.awaiting-client-approval.durationHours": 1,
          "work-order.scheduling.durationHours": 1,
          "work-order.invoicing.durationHours": 1,
        },
      });

      return {
        ok: result.ok === (input.expectedOutcome !== "failure"),
        kind: "work-order-transition",
        transitionResult: result,
        message: result.message,
        warnings: result.sideEffectWarnings?.map((warning) => warning.code),
      };
    },
  };
}

export function invoiceTransitionStep(input: {
  readonly stepKey: string;
  readonly description: string;
  readonly invoiceId?: string;
  readonly to: InvoiceLifecycleStatus;
  readonly role?: string | null;
  readonly actorType?: string;
  readonly expectedOutcome?: WorkflowVerificationStep["expectedOutcome"];
  readonly assertions?: readonly WorkflowVerificationAssertion[];
}): WorkflowVerificationStep {
  return {
    stepKey: input.stepKey,
    description: input.description,
    attemptedAction: `invoice -> ${input.to}`,
    expectedOutcome: input.expectedOutcome ?? "success",
    assertions: input.assertions,
    async run(env) {
      const result = await applyInvoiceTransition({
        lifecycle: "invoice",
        entityType: "invoice",
        entityId: input.invoiceId ?? "invoice-standard",
        to: input.to,
        actorType: input.actorType ?? "USER",
        role: input.role ?? PLATFORM_ROLES.FinanceAdmin,
        actorUserId: "verification-user",
        repositories: env,
        metadata: {
          correlationId: `${input.stepKey}-correlation`,
          "invoice.payment-follow-up.durationHours": 1,
          "invoice.overdue-collection.durationHours": 1,
        },
      });

      return {
        ok: result.ok === (input.expectedOutcome !== "failure"),
        kind: "invoice-transition",
        transitionResult: result,
        message: result.message,
        warnings: result.sideEffectWarnings?.map((warning) => warning.code),
      };
    },
  };
}

export function quoteDeferredStep(): WorkflowVerificationStep {
  return {
    stepKey: "quote-runtime-deferred",
    description: "Assert quote apply path is explicitly deferred.",
    attemptedAction: "quote apply Submitted",
    expectedOutcome: "deferred",
    async run() {
      const result = await applyQuoteTransition({
        lifecycle: "quote",
        entityType: "quote",
        entityId: "quote-standard",
        to: QUOTE_STATUS.Submitted,
        actorType: "USER",
        role: PLATFORM_ROLES.ContractorUser,
      });
      return {
        ok: !result.ok && result.failureCode === "UNSUPPORTED_RUNTIME_PATH",
        kind: "quote-transition-deferred",
        transitionResult: result,
        message: result.message,
      };
    },
  };
}

export function simulateQuoteStateStep(input: {
  readonly stepKey: string;
  readonly status: string | null;
  readonly workOrderId?: string;
}): WorkflowVerificationStep {
  return {
    stepKey: input.stepKey,
    description: `Simulate quote dependency boundary as ${input.status ?? "missing"}.`,
    attemptedAction: "quote dependency simulation",
    expectedOutcome: "simulation",
    run(env) {
      env.setQuoteState(input.workOrderId ?? "wo-standard", input.status);
      return {
        ok: true,
        kind: "quote-boundary-simulation",
        message: `Work-order quoteStatus set to ${input.status ?? "null"}.`,
      };
    },
  };
}

export function actionAvailabilityStep(input: {
  readonly stepKey: string;
  readonly lifecycle: "work-order" | "invoice";
  readonly entityId: string;
  readonly role: string;
  readonly actorType?: string;
  readonly assertions?: readonly WorkflowVerificationAssertion[];
}): WorkflowVerificationStep {
  return {
    stepKey: input.stepKey,
    description: `Evaluate ${input.lifecycle} action availability.`,
    attemptedAction: "action availability",
    expectedOutcome: "observation",
    assertions: input.assertions,
    async run(env) {
      const result = await getAvailableLifecycleActions({
        lifecycle: input.lifecycle,
        entityType: input.lifecycle,
        entityId: input.entityId,
        actorType: input.actorType ?? "USER",
        role: input.role,
        repositories: env,
      } as never);
      env.recordActionAvailability(result);
      return { ok: result.ok, kind: "action-availability", data: result };
    },
  };
}

export function evaluateSlaBreachesStep(input: {
  readonly stepKey?: string;
  readonly advanceHours?: number;
  readonly advanceDays?: number;
  readonly assertions?: readonly WorkflowVerificationAssertion[];
} = {}): WorkflowVerificationStep {
  return {
    stepKey: input.stepKey ?? "evaluate-sla-breaches",
    description: "Evaluate due SLA timers for breaches.",
    attemptedAction: "SLA breach evaluation",
    expectedOutcome: "observation",
    assertions: input.assertions,
    async run(env) {
      if (input.advanceHours || input.advanceDays) {
        env.clock.advance({ hours: input.advanceHours, days: input.advanceDays });
      }
      const result = await evaluateWorkflowSlaBreaches({
        now: env.clock.now(),
        adapters: env,
      });
      return { ok: result.warnings.length === 0, kind: "sla-evaluation", data: result };
    },
  };
}

export function processScheduledBatchStep(input: {
  readonly stepKey?: string;
  readonly assertions?: readonly WorkflowVerificationAssertion[];
} = {}): WorkflowVerificationStep {
  return {
    stepKey: input.stepKey ?? "process-scheduled-batch",
    description: "Claim and process due scheduled workflow actions.",
    attemptedAction: "scheduled execution batch",
    expectedOutcome: "observation",
    assertions: input.assertions,
    async run(env) {
      const result = await processScheduledWorkflowActionsBatch({
        workerId: "verification-worker",
        now: env.clock.now(),
        limit: 10,
        adapters: env,
      });
      return { ok: result.failedCount === 0, kind: "scheduled-batch", data: result };
    },
  };
}

export function processOneScheduledActionStep(input: {
  readonly stepKey: string;
  readonly action: (env: WorkflowVerificationEnvironment) => ScheduledWorkflowExecutionRecord;
  readonly failExecution?: boolean;
  readonly assertions?: readonly WorkflowVerificationAssertion[];
}): WorkflowVerificationStep {
  return {
    stepKey: input.stepKey,
    description: "Process one scheduled workflow action.",
    attemptedAction: "scheduled execution",
    expectedOutcome: "observation",
    assertions: input.assertions,
    async run(env) {
      env.failScheduledExecution = input.failExecution ?? false;
      const result = await processScheduledWorkflowAction({
        record: input.action(env),
        workerId: "verification-worker",
        now: env.clock.now(),
        adapters: env,
      });
      env.failScheduledExecution = false;
      return { ok: true, kind: "scheduled-action", data: result };
    },
  };
}

export function monitoringSummaryStep(input: {
  readonly assertions?: readonly WorkflowVerificationAssertion[];
} = {}): WorkflowVerificationStep {
  return {
    stepKey: "monitoring-summary",
    description: "Build workflow monitoring summary.",
    attemptedAction: "monitoring summary",
    expectedOutcome: "observation",
    assertions: input.assertions,
    async run(env) {
      env.monitoringSummary = await buildWorkflowMonitoringSummary({
        now: env.clock.now(),
        adapters: env,
      });
      return { ok: true, kind: "monitoring-summary", data: env.monitoringSummary };
    },
  };
}

export function optimizationStep(input: {
  readonly stepKey?: string;
  readonly contexts?: Parameters<WorkflowVerificationEnvironment["computeOptimization"]>[0];
  readonly assertions?: readonly WorkflowVerificationAssertion[];
} = {}): WorkflowVerificationStep {
  return {
    stepKey: input.stepKey ?? "optimization",
    description: "Compute workflow priority, risk, assignment, recommendations, and queue.",
    attemptedAction: "optimization",
    expectedOutcome: "observation",
    assertions: input.assertions,
    run(env) {
      const queue = env.computeOptimization(input.contexts);
      return { ok: true, kind: "optimization", data: queue };
    },
  };
}

export function makeScenario(input: WorkflowVerificationScenario): WorkflowVerificationScenario {
  return input;
}
