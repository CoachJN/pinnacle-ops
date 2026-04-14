/**
 * Verification coverage summary
 * - authentication enforcement: protected route redirect path requires local `/...` targets
 * - protected route enforcement: unauthenticated access resolves to `/sign-in` with safe next param
 * - forbidden action attempts: covered by unauthorized workflow scenarios and RBAC transition tests
 * - safe error responses: covered by observability tests plus workflow report readability checks here
 * - output-friendly report: workflow verification report text remains readable for CI/log output
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildLoginRedirectPath, LOGIN_PATH } from "../server/auth/redirect-path.ts";
import {
  buildWorkflowVerificationReportText,
  runAllWorkflowVerificationScenarios,
} from "../lib/workflows/verification/index.ts";

describe("verification hardening", () => {
  test("protected route redirect helper preserves only safe local targets", () => {
    assert.equal(buildLoginRedirectPath("/dashboard"), "/sign-in?next=%2Fdashboard");
    assert.equal(
      buildLoginRedirectPath("/work-orders/wo-1"),
      "/sign-in?next=%2Fwork-orders%2Fwo-1",
    );
    assert.equal(buildLoginRedirectPath("https://example.com/phish"), LOGIN_PATH);
    assert.equal(buildLoginRedirectPath("dashboard"), LOGIN_PATH);
    assert.equal(buildLoginRedirectPath("//example.com/phish"), LOGIN_PATH);
    assert.equal(buildLoginRedirectPath(undefined), LOGIN_PATH);
  });

  test("workflow verification report stays output-friendly and includes hardening scenarios", async () => {
    const report = await runAllWorkflowVerificationScenarios();
    const text = buildWorkflowVerificationReportText(report, { verbose: false });

    assert.match(text, /Workflow verification PASSED/);
    assert.match(text, /Unauthorized Attempts/);
    assert.match(text, /Artifacts: audits=/);
    assert.match(text, /Scenarios: 8\/8 passed/);
  });
});
