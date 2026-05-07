import type { ClientInvoice as Invoice } from "@/types/invoice";
import type { WorkOrder } from "@/types/work-order";
import type {
  WorkflowActionAvailabilityResult,
  WorkflowActionCode,
} from "../action-gating/index.ts";
import type {
  TransitionAuditRecord,
  TransitionEventRecord,
} from "../audit/index.ts";
import type {
  ScheduledWorkflowExecutionRecord,
  WorkflowExecutionAttempt,
  WorkflowMonitoringSummary,
  WorkflowSlaBreachRecord,
  WorkflowSlaTimer,
} from "../execution/index.ts";
import type {
  OptimizedWorkQueue,
  WorkflowPriorityScore,
} from "../optimization/index.ts";
import type {
  WorkflowOrchestrationRecord,
} from "../orchestration/index.ts";
import type {
  AutomationIntent,
  NotificationIntent,
} from "../reactions/index.ts";
import type { TransitionApplyResult } from "../transition-service/index.ts";
import type { WorkflowVerificationEnvironment } from "./fixtures.ts";

export type WorkflowVerificationLifecycle = "work-order" | "invoice" | "quote";

export type WorkflowVerificationExpectedOutcome =
  | "success"
  | "failure"
  | "deferred"
  | "simulation"
  | "observation";

export interface WorkflowVerificationFailure {
  readonly code: string;
  readonly message: string;
  readonly stepKey?: string;
  readonly assertionKey?: string;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface WorkflowVerificationAssertion {
  readonly assertionKey: string;
  readonly description: string;
  readonly evaluate: (
    input: WorkflowVerificationAssertionInput,
  ) => WorkflowVerificationFailure | null;
}

export interface WorkflowVerificationAssertionInput {
  readonly env: WorkflowVerificationEnvironment;
  readonly step: WorkflowVerificationStepResult;
  readonly artifacts: WorkflowVerificationArtifactSnapshot;
}

export interface WorkflowVerificationStep {
  readonly stepKey: string;
  readonly description: string;
  readonly attemptedAction: string;
  readonly expectedOutcome: WorkflowVerificationExpectedOutcome;
  readonly run: (
    env: WorkflowVerificationEnvironment,
  ) => Promise<WorkflowVerificationStepActualOutcome> | WorkflowVerificationStepActualOutcome;
  readonly assertions?: readonly WorkflowVerificationAssertion[];
}

export interface WorkflowVerificationStepActualOutcome {
  readonly ok: boolean;
  readonly kind?: string;
  readonly message?: string;
  readonly transitionResult?: TransitionApplyResult;
  readonly data?: unknown;
  readonly warnings?: readonly string[];
}

export interface WorkflowVerificationStepResult {
  readonly stepKey: string;
  readonly description: string;
  readonly attemptedAction: string;
  readonly expectedOutcome: WorkflowVerificationExpectedOutcome;
  readonly actualOutcome: WorkflowVerificationStepActualOutcome;
  readonly ok: boolean;
  readonly assertionsPassed: number;
  readonly assertionsFailed: number;
  readonly failures: readonly WorkflowVerificationFailure[];
  readonly diagnostics: Readonly<Record<string, unknown>>;
  readonly artifacts: WorkflowVerificationArtifactSnapshot;
}

export interface WorkflowVerificationScenario {
  readonly scenarioKey: string;
  readonly scenarioName: string;
  readonly description?: string;
  readonly seed?: (env: WorkflowVerificationEnvironment) => void | Promise<void>;
  readonly steps: readonly WorkflowVerificationStep[];
  readonly assertions?: readonly WorkflowVerificationAssertion[];
}

export interface WorkflowVerificationArtifactSnapshot {
  readonly workOrders: readonly WorkOrder[];
  readonly invoices: readonly Invoice[];
  readonly auditCount: number;
  readonly eventCount: number;
  readonly reactionIntentCount: number;
  readonly notificationIntentCount: number;
  readonly automationIntentCount: number;
  readonly orchestrationActionCount: number;
  readonly scheduledActionCount: number;
  readonly slaTimerCount: number;
  readonly slaBreachCount: number;
  readonly transitionAudits: readonly TransitionAuditRecord[];
  readonly transitionEvents: readonly TransitionEventRecord[];
  readonly notificationIntents: readonly NotificationIntent[];
  readonly automationIntents: readonly AutomationIntent[];
  readonly orchestrationActions: readonly WorkflowOrchestrationRecord[];
  readonly scheduledActions: readonly ScheduledWorkflowExecutionRecord[];
  readonly executionAttempts: readonly WorkflowExecutionAttempt[];
  readonly slaTimers: readonly WorkflowSlaTimer[];
  readonly slaBreaches: readonly WorkflowSlaBreachRecord[];
  readonly actionAvailability: readonly WorkflowActionAvailabilityResult[];
  readonly priorityScores: Readonly<Record<string, WorkflowPriorityScore>>;
  readonly optimizationQueue?: OptimizedWorkQueue;
  readonly monitoringSummary?: WorkflowMonitoringSummary;
}

export interface WorkflowVerificationResult {
  readonly scenarioKey: string;
  readonly scenarioName: string;
  readonly ok: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly steps: readonly WorkflowVerificationStepResult[];
  readonly assertionsPassed: number;
  readonly assertionsFailed: number;
  readonly failures: readonly WorkflowVerificationFailure[];
  readonly artifacts: WorkflowVerificationArtifactSnapshot;
  readonly summary: string;
  readonly warnings: readonly string[];
}

export interface WorkflowVerificationReport {
  readonly ok: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly scenarioCount: number;
  readonly passedScenarioCount: number;
  readonly failedScenarioCount: number;
  readonly assertionsPassed: number;
  readonly assertionsFailed: number;
  readonly failures: readonly WorkflowVerificationFailure[];
  readonly results: readonly WorkflowVerificationResult[];
}

export interface WorkflowVerificationRunOptions {
  readonly verbose?: boolean;
  readonly env?: WorkflowVerificationEnvironment;
}

export interface WorkflowVerificationMatrixCase {
  readonly matrixKey: string;
  readonly lifecycle: Exclude<WorkflowVerificationLifecycle, "quote">;
  readonly from: string;
  readonly to: string;
  readonly role?: string | null;
  readonly actorType?: string;
  readonly expectedOk: boolean;
  readonly dependency?: "quote-approved" | "quote-missing" | "quote-not-required";
}

export interface WorkflowVerificationMatrixResult {
  readonly ok: boolean;
  readonly cases: readonly {
    readonly matrixKey: string;
    readonly ok: boolean;
    readonly expectedOk: boolean;
    readonly actualOk: boolean;
    readonly failureCode?: string;
    readonly diagnostics?: Readonly<Record<string, unknown>>;
  }[];
  readonly failures: readonly WorkflowVerificationFailure[];
}

export type WorkflowVerificationActionCode = WorkflowActionCode;
