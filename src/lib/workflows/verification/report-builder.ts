import type {
  WorkflowVerificationReport,
  WorkflowVerificationResult,
} from "./types.ts";

export function buildWorkflowVerificationReportText(
  report: WorkflowVerificationReport,
  input: { readonly verbose?: boolean } = {},
): string {
  const lines = [
    `Workflow verification ${report.ok ? "PASSED" : "FAILED"}`,
    `Scenarios: ${report.passedScenarioCount}/${report.scenarioCount} passed`,
    `Assertions: ${report.assertionsPassed} passed, ${report.assertionsFailed} failed`,
  ];

  for (const result of report.results) {
    lines.push(formatScenario(result, input.verbose ?? false));
  }

  if (report.failures.length > 0) {
    lines.push("Failures:");
    for (const failure of report.failures) {
      lines.push(
        `- ${failure.stepKey ? `${failure.stepKey}: ` : ""}${failure.code}: ${failure.message}`,
      );
      if (input.verbose && failure.diagnostics) {
        lines.push(`  ${JSON.stringify(failure.diagnostics)}`);
      }
    }
  }

  return lines.join("\n");
}

function formatScenario(
  result: WorkflowVerificationResult,
  verbose: boolean,
): string {
  const lines = [
    `- ${result.ok ? "PASS" : "FAIL"} ${result.scenarioName}`,
    `  Artifacts: audits=${result.artifacts.auditCount}, events=${result.artifacts.eventCount}, reactions=${result.artifacts.reactionIntentCount}, orchestration=${result.artifacts.orchestrationActionCount}, scheduled=${result.artifacts.scheduledActionCount}, slaTimers=${result.artifacts.slaTimerCount}, slaBreaches=${result.artifacts.slaBreachCount}`,
  ];

  if (verbose) {
    for (const step of result.steps) {
      lines.push(
        `  - ${step.ok ? "PASS" : "FAIL"} ${step.stepKey}: ${step.description}`,
      );
      for (const failure of step.failures) {
        lines.push(`    ${failure.code}: ${failure.message}`);
      }
    }
  }

  return lines.join("\n");
}
