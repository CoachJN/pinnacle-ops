import assert from "node:assert/strict";
import test from "node:test";
import {
  canInvoiceTransition,
  canQuoteTransition,
  canWorkOrderTransition,
  isTerminalInvoiceStatus,
  isTerminalQuoteStatus,
  isTerminalWorkOrderStatus,
} from "../server/services/status-rules.ts";

test("work order persisted status rules block shortcuts and terminal exits", () => {
  assert.equal(canWorkOrderTransition("new", "completed"), false);
  assert.equal(canWorkOrderTransition("new", "in_review"), true);
  assert.equal(canWorkOrderTransition("quote_requested", "approved_to_proceed"), false);
  assert.equal(canWorkOrderTransition("pending_client_approval", "approved_to_proceed"), true);
  assert.equal(canWorkOrderTransition("closed", "in_progress"), false);
  assert.equal(isTerminalWorkOrderStatus("closed"), true);
  assert.equal(isTerminalWorkOrderStatus("cancelled"), true);
});

test("quote persisted status rules require review before client decision", () => {
  assert.equal(canQuoteTransition("draft", "client_approved"), false);
  assert.equal(canQuoteTransition("draft", "submitted"), true);
  assert.equal(canQuoteTransition("submitted", "under_review"), true);
  assert.equal(canQuoteTransition("under_review", "ready_for_client"), true);
  assert.equal(canQuoteTransition("ready_for_client", "client_approved"), true);
  assert.equal(canQuoteTransition("client_approved", "draft"), false);
  assert.equal(isTerminalQuoteStatus("client_approved"), true);
});

test("invoice persisted status rules guard paid and void terminal states", () => {
  assert.equal(canInvoiceTransition("draft", "paid"), false);
  assert.equal(canInvoiceTransition("draft", "issued"), true);
  assert.equal(canInvoiceTransition("issued", "overdue"), true);
  assert.equal(canInvoiceTransition("overdue", "paid"), true);
  assert.equal(canInvoiceTransition("paid", "void"), false);
  assert.equal(isTerminalInvoiceStatus("paid"), true);
  assert.equal(isTerminalInvoiceStatus("void"), true);
});
