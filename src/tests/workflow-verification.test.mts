import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildWorkflowVerificationReportText,
  createWorkflowVerificationEnvironment,
  runAllWorkflowVerificationScenarios,
  runTransitionMatrixVerification,
  runWorkflowVerificationScenario,
  workOrderStandardScenario,
} from "../lib/workflows/verification/index.ts";

describe("workflow verification harness", () => {
  test("scenario runner executes a full artifact-producing scenario", async () => {
    const result = await runWorkflowVerificationScenario(workOrderStandardScenario, {
      env: createWorkflowVerificationEnvironment(),
    });

    assert.equal(result.ok, true);
    assert.equal(result.scenarioKey, "work-order-standard");
    assert.ok(result.steps.length >= 10);
    assert.ok(result.artifacts.auditCount > 0);
    assert.ok(result.artifacts.eventCount > 0);
    assert.ok(result.artifacts.reactionIntentCount > 0);
    assert.ok(result.artifacts.orchestrationActionCount > 0);
    assert.ok(result.artifacts.slaTimerCount > 0);
    assert.ok(result.artifacts.optimizationQueue);
  });

  test("required scenarios execute", async () => {
    const report = await runAllWorkflowVerificationScenarios();

    assert.equal(report.ok, true);
    assert.equal(report.scenarioCount, 8);
    assert.equal(report.failedScenarioCount, 0);
  });

  test("report builder includes readable totals and artifacts", async () => {
    const report = await runAllWorkflowVerificationScenarios();
    const text = buildWorkflowVerificationReportText(report, { verbose: true });

    assert.match(text, /Workflow verification PASSED/);
    assert.match(text, /Scenarios: 8\/8 passed/);
    assert.match(text, /Artifacts: audits=/);
  });

  test("matrix verification catches invalid transitions", async () => {
    const matrix = await runTransitionMatrixVerification();

    assert.equal(matrix.ok, true);
    assert.ok(
      matrix.cases.some(
        (testCase) =>
          testCase.matrixKey === "wo-invalid-shortcut" &&
          testCase.expectedOk === false &&
          testCase.actualOk === false,
      ),
    );
  });
});
