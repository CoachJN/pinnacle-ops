import {
  buildWorkflowVerificationReportText,
  runAllWorkflowVerificationScenarios,
  runTransitionMatrixVerification,
} from "./index.ts";

const verbose = process.argv.includes("--verbose");
const report = await runAllWorkflowVerificationScenarios({ verbose });
const matrix = await runTransitionMatrixVerification();

const combined = {
  ...report,
  ok: report.ok && matrix.ok,
  failures: [...report.failures, ...matrix.failures],
  assertionsFailed: report.assertionsFailed + matrix.failures.length,
};

console.log(buildWorkflowVerificationReportText(combined, { verbose }));
console.log(`Matrix: ${matrix.ok ? "PASSED" : "FAILED"} (${matrix.cases.length} cases)`);

if (!combined.ok) {
  process.exitCode = 1;
}
