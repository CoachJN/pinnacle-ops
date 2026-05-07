import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getAllowedNextWorkOrderLifecycleStatuses,
  isTerminalWorkOrderLifecycleStatus,
  validateWorkOrderLifecycleTransition,
} from "../modules/work-orders/domain/lifecycle.ts";
import {
  canInvoiceTransition,
  canQuoteTransition,
  canWorkOrderTransition,
} from "../server/services/status-rules.ts";

describe("canonical work order lifecycle", () => {
  test("allows canonical quote and invoice path transitions", () => {
    assert.equal(canWorkOrderTransition("new", "triage"), true);
    assert.equal(canWorkOrderTransition("quote_required", "contractor_quote_received"), true);
    assert.equal(
      canWorkOrderTransition("client_approval_requested", "client_approved"),
      true,
    );
    assert.equal(canWorkOrderTransition("ready_for_invoicing", "invoiced"), true);
    assert.equal(canWorkOrderTransition("invoiced", "paid"), true);
  });

  test("enforces terminal states and canonical transition map", () => {
    assert.equal(isTerminalWorkOrderLifecycleStatus("closed"), true);
    assert.equal(isTerminalWorkOrderLifecycleStatus("cancelled"), true);
    assert.equal(isTerminalWorkOrderLifecycleStatus("in_progress"), false);
    assert.deepEqual(getAllowedNextWorkOrderLifecycleStatuses("closed"), []);
    assert.equal(canWorkOrderTransition("new", "contractor_scheduled"), false);
  });

  test("requires hold and escalation metadata", () => {
    assert.match(
      validateWorkOrderLifecycleTransition("triage", "on_hold", {}) ?? "",
      /holdReason/i,
    );
    assert.equal(
      validateWorkOrderLifecycleTransition("triage", "on_hold", {
        holdReason: "Awaiting site access",
        previousLifecycleStatus: "triage",
      }),
      null,
    );
    assert.match(
      validateWorkOrderLifecycleTransition("assigned", "escalated", {
        previousLifecycleStatus: "assigned",
      }) ?? "",
      /escalationReason/i,
    );
  });

  test("locks invoice reopen behind explicit context", () => {
    assert.equal(
      validateWorkOrderLifecycleTransition("invoiced", "ready_for_invoicing", {}) !== null,
      true,
    );
    assert.equal(
      validateWorkOrderLifecycleTransition("invoiced", "ready_for_invoicing", {
        allowInvoiceReopen: true,
      }),
      null,
    );
  });
});

describe("quote and invoice lifecycle summaries", () => {
  test("keeps quote transitions canonical", () => {
    assert.equal(canQuoteTransition("draft", "submitted"), true);
    assert.equal(canQuoteTransition("ready_for_client", "client_approved"), true);
    assert.equal(canQuoteTransition("draft", "client_approved"), false);
  });

  test("keeps invoice transitions canonical", () => {
    assert.equal(canInvoiceTransition("draft", "sent"), true);
    assert.equal(canInvoiceTransition("sent", "paid"), true);
    assert.equal(canInvoiceTransition("draft", "paid"), false);
  });
});
