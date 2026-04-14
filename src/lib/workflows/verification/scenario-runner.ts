import {
  INVOICE_STATUS,
  INVOICE_STATUSES,
  WORK_ORDER_STATUS,
  WORK_ORDER_STATUSES,
} from "../lifecycle/index.ts";
import { PLATFORM_ROLES } from "../rbac-transition/index.ts";
import {
  applyInvoiceTransition,
  applyWorkOrderTransition,
} from "../transition-service/index.ts";
import { createWorkflowVerificationEnvironment } from "./fixtures.ts";
import type {
  WorkflowVerificationFailure,
  WorkflowVerificationMatrixCase,
  WorkflowVerificationMatrixResult,
  WorkflowVerificationReport,
  WorkflowVerificationResult,
  WorkflowVerificationRunOptions,
  WorkflowVerificationScenario,
  WorkflowVerificationStepResult,
} from "./types.ts";
import { allWorkflowVerificationScenarios } from "./scenarios/index.ts";

export async function runWorkflowVerificationScenario(
  scenario: WorkflowVerificationScenario,
  options: WorkflowVerificationRunOptions = {},
): Promise<WorkflowVerificationResult> {
  const env = options.env ?? createWorkflowVerificationEnvironment();
  const startedAt = env.clock.now();
  const stepResults: WorkflowVerificationStepResult[] = [];
  const warnings: string[] = [];

  await scenario.seed?.(env);

  for (const step of scenario.steps) {
    let actualOutcome;
    let executionFailure: WorkflowVerificationFailure | null = null;
    try {
      actualOutcome = await step.run(env);
    } catch (error) {
      actualOutcome = {
        ok: false,
        kind: "exception",
        message: error instanceof Error ? error.message : String(error),
      };
      executionFailure = {
        code: "STEP_EXCEPTION",
        message: actualOutcome.message ?? "Step threw an exception.",
        stepKey: step.stepKey,
      };
    }

    const artifactSnapshot = env.snapshot();
    const assertions = step.assertions ?? [];
    const assertionFailures = assertions
      .map((assertion) =>
        assertion.evaluate({
          env,
          step: {
            stepKey: step.stepKey,
            description: step.description,
            attemptedAction: step.attemptedAction,
            expectedOutcome: step.expectedOutcome,
            actualOutcome,
            ok: actualOutcome.ok,
            assertionsPassed: 0,
            assertionsFailed: 0,
            failures: [],
            diagnostics: {},
            artifacts: artifactSnapshot,
          },
          artifacts: artifactSnapshot,
        }),
      )
      .filter((failure): failure is WorkflowVerificationFailure => Boolean(failure))
      .map((failure) => ({
        ...failure,
        stepKey: failure.stepKey ?? step.stepKey,
      }));
    const failures = [
      ...(executionFailure ? [executionFailure] : []),
      ...assertionFailures,
    ];

    warnings.push(...(actualOutcome.warnings ?? []));
    stepResults.push({
      stepKey: step.stepKey,
      description: step.description,
      attemptedAction: step.attemptedAction,
      expectedOutcome: step.expectedOutcome,
      actualOutcome,
      ok: actualOutcome.ok && failures.length === 0,
      assertionsPassed: assertions.length - assertionFailures.length,
      assertionsFailed: assertionFailures.length,
      failures,
      diagnostics: {
        transition: actualOutcome.transitionResult
          ? {
              ok: actualOutcome.transitionResult.ok,
              from: actualOutcome.transitionResult.from,
              to: actualOutcome.transitionResult.to,
              failureCode: actualOutcome.transitionResult.ok
                ? undefined
                : actualOutcome.transitionResult.failureCode,
            }
          : undefined,
      },
      artifacts: artifactSnapshot,
    });
  }

  const finalArtifacts = env.snapshot();
  const scenarioAssertionFailures = (scenario.assertions ?? [])
    .map((assertion) =>
      assertion.evaluate({
        env,
        step: stepResults[stepResults.length - 1],
        artifacts: finalArtifacts,
      }),
    )
    .filter((failure): failure is WorkflowVerificationFailure => Boolean(failure));
  const failures = [
    ...stepResults.flatMap((step) => step.failures),
    ...scenarioAssertionFailures,
  ];
  const assertionsPassed =
    stepResults.reduce((sum, step) => sum + step.assertionsPassed, 0) +
    (scenario.assertions?.length ?? 0) -
    scenarioAssertionFailures.length;
  const assertionsFailed =
    stepResults.reduce((sum, step) => sum + step.assertionsFailed, 0) +
    scenarioAssertionFailures.length;

  return {
    scenarioKey: scenario.scenarioKey,
    scenarioName: scenario.scenarioName,
    ok: failures.length === 0 && stepResults.every((step) => step.ok),
    startedAt,
    completedAt: env.clock.now(),
    steps: stepResults,
    assertionsPassed,
    assertionsFailed,
    failures,
    artifacts: finalArtifacts,
    summary: `${scenario.scenarioName}: ${failures.length === 0 ? "passed" : "failed"} (${assertionsPassed} passed, ${assertionsFailed} failed assertions)`,
    warnings,
  };
}

export async function runAllWorkflowVerificationScenarios(
  options: WorkflowVerificationRunOptions = {},
): Promise<WorkflowVerificationReport> {
  const startedAt = new Date().toISOString();
  const results = [];
  for (const scenario of allWorkflowVerificationScenarios) {
    results.push(await runWorkflowVerificationScenario(scenario, options));
  }
  const failures = results.flatMap((result) => result.failures);

  return {
    ok: failures.length === 0 && results.every((result) => result.ok),
    startedAt,
    completedAt: new Date().toISOString(),
    scenarioCount: results.length,
    passedScenarioCount: results.filter((result) => result.ok).length,
    failedScenarioCount: results.filter((result) => !result.ok).length,
    assertionsPassed: results.reduce((sum, result) => sum + result.assertionsPassed, 0),
    assertionsFailed: results.reduce((sum, result) => sum + result.assertionsFailed, 0),
    failures,
    results,
  };
}

export async function runTransitionMatrixVerification(): Promise<WorkflowVerificationMatrixResult> {
  const cases = buildMatrixCases();
  const results = [];

  for (const testCase of cases) {
    const env = createWorkflowVerificationEnvironment();
    let actualOk = false;
    let failureCode: string | undefined;

    if (testCase.lifecycle === "work-order") {
      env.seedWorkOrder({
        id: testCase.matrixKey,
        status: testCase.from as never,
        quoteRequired: testCase.dependency !== "quote-not-required",
        quoteStatus:
          testCase.dependency === "quote-approved" ? "CLIENT_APPROVED" : null,
      });
      const result = await applyWorkOrderTransition({
        lifecycle: "work-order",
        entityType: "work-order",
        entityId: testCase.matrixKey,
        to: testCase.to,
        actorType: testCase.actorType ?? "USER",
        role: testCase.role ?? PLATFORM_ROLES.Owner,
        repositories: env,
      });
      actualOk = result.ok;
      failureCode = result.ok ? undefined : result.failureCode;
    } else {
      env.seedWorkOrder({
        id: `wo-${testCase.matrixKey}`,
        status: WORK_ORDER_STATUS.ReadyForInvoicing as never,
      });
      env.seedInvoice({
        id: testCase.matrixKey,
        workOrderId: `wo-${testCase.matrixKey}`,
        status: testCase.from as never,
      });
      const result = await applyInvoiceTransition({
        lifecycle: "invoice",
        entityType: "invoice",
        entityId: testCase.matrixKey,
        to: testCase.to,
        actorType: testCase.actorType ?? "USER",
        role: testCase.role ?? PLATFORM_ROLES.Owner,
        repositories: env,
      });
      actualOk = result.ok;
      failureCode = result.ok ? undefined : result.failureCode;
    }

    results.push({
      matrixKey: testCase.matrixKey,
      ok: actualOk === testCase.expectedOk,
      expectedOk: testCase.expectedOk,
      actualOk,
      failureCode,
      diagnostics: {
        lifecycle: testCase.lifecycle,
        from: testCase.from,
        to: testCase.to,
        role: testCase.role,
        actorType: testCase.actorType,
        dependency: testCase.dependency,
      },
    });
  }

  const failures = results
    .filter((result) => !result.ok)
    .map((result) => ({
      code: "MATRIX_CASE_FAILED",
      message: `Matrix case ${result.matrixKey} did not match expected outcome.`,
      diagnostics: result,
    }));

  return { ok: failures.length === 0, cases: results, failures };
}

function buildMatrixCases(): readonly WorkflowVerificationMatrixCase[] {
  const cases: WorkflowVerificationMatrixCase[] = [
    {
      matrixKey: "wo-valid-new-triage",
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.New,
      to: WORK_ORDER_STATUS.Triage,
      role: PLATFORM_ROLES.Coordinator,
      expectedOk: true,
      dependency: "quote-not-required",
    },
    {
      matrixKey: "wo-invalid-shortcut",
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.New,
      to: WORK_ORDER_STATUS.Completed,
      role: PLATFORM_ROLES.Owner,
      expectedOk: false,
      dependency: "quote-not-required",
    },
    {
      matrixKey: "wo-terminal-leak",
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.Completed,
      to: WORK_ORDER_STATUS.Triage,
      role: PLATFORM_ROLES.Owner,
      expectedOk: false,
      dependency: "quote-not-required",
    },
    {
      matrixKey: "wo-dependency-block",
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.AwaitingClientApproval,
      to: WORK_ORDER_STATUS.ApprovedToProceed,
      role: PLATFORM_ROLES.Manager,
      expectedOk: false,
      dependency: "quote-missing",
    },
    {
      matrixKey: "wo-dependency-pass",
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.AwaitingClientApproval,
      to: WORK_ORDER_STATUS.ApprovedToProceed,
      role: PLATFORM_ROLES.Manager,
      expectedOk: true,
      dependency: "quote-approved",
    },
    {
      matrixKey: "invoice-valid-ready-draft",
      lifecycle: "invoice",
      from: INVOICE_STATUS.Ready,
      to: INVOICE_STATUS.Draft,
      role: PLATFORM_ROLES.FinanceAdmin,
      expectedOk: true,
    },
    {
      matrixKey: "invoice-invalid-shortcut",
      lifecycle: "invoice",
      from: INVOICE_STATUS.NotReady,
      to: INVOICE_STATUS.Paid,
      role: PLATFORM_ROLES.Owner,
      expectedOk: false,
    },
    {
      matrixKey: "invoice-system-only-user-blocked",
      lifecycle: "invoice",
      from: INVOICE_STATUS.Sent,
      to: INVOICE_STATUS.Viewed,
      role: PLATFORM_ROLES.Owner,
      actorType: "USER",
      expectedOk: false,
    },
    {
      matrixKey: "invoice-system-only-system-pass",
      lifecycle: "invoice",
      from: INVOICE_STATUS.Sent,
      to: INVOICE_STATUS.Viewed,
      actorType: "SYSTEM",
      expectedOk: true,
    },
  ];

  for (const from of WORK_ORDER_STATUSES) {
    cases.push({
      matrixKey: `wo-terminal-sweep-${from}-completed-to-triage`,
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.Completed,
      to: from,
      role: PLATFORM_ROLES.Owner,
      expectedOk: false,
      dependency: "quote-not-required",
    });
  }

  for (const to of INVOICE_STATUSES) {
    cases.push({
      matrixKey: `invoice-terminal-sweep-paid-to-${to}`,
      lifecycle: "invoice",
      from: INVOICE_STATUS.Paid,
      to,
      role: PLATFORM_ROLES.Owner,
      expectedOk: false,
    });
  }

  return cases;
}
