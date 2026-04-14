import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canInvoiceTransition,
  canQuoteTransition,
  canWorkOrderTransition,
  INVOICE_STATUS,
  INVOICE_TRANSITION_MAP,
  isTerminalInvoiceStatus,
  isTerminalQuoteStatus,
  isTerminalWorkOrderStatus,
  QUOTE_STATUS,
  QUOTE_TRANSITION_MAP,
  WORK_ORDER_STATUS,
  WORK_ORDER_TRANSITION_MAP,
} from "../lib/workflows/lifecycle/index.ts";
import "./rbac-transition.test.mts";
import "./transition-engine.test.mts";

describe("work order lifecycle", () => {
  test("detects terminal statuses", () => {
    assert.equal(isTerminalWorkOrderStatus(WORK_ORDER_STATUS.Completed), true);
    assert.equal(isTerminalWorkOrderStatus(WORK_ORDER_STATUS.Cancelled), true);
    assert.equal(isTerminalWorkOrderStatus(WORK_ORDER_STATUS.InProgress), false);
  });

  test("allows approved transitions and global exceptions", () => {
    assert.equal(
      canWorkOrderTransition(WORK_ORDER_STATUS.New, WORK_ORDER_STATUS.Triage),
      true,
    );
    assert.equal(
      canWorkOrderTransition(
        WORK_ORDER_STATUS.InProgress,
        WORK_ORDER_STATUS.WorkCompleted,
      ),
      true,
    );
    assert.equal(
      canWorkOrderTransition(WORK_ORDER_STATUS.Scheduled, WORK_ORDER_STATUS.OnHold),
      true,
    );
    assert.equal(
      canWorkOrderTransition(
        WORK_ORDER_STATUS.AwaitingQuote,
        WORK_ORDER_STATUS.Escalated,
      ),
      true,
    );
    assert.equal(
      canWorkOrderTransition(WORK_ORDER_STATUS.Escalated, WORK_ORDER_STATUS.Cancelled),
      true,
    );
  });

  test("rejects invalid transitions and terminal forward transitions", () => {
    assert.equal(
      canWorkOrderTransition(WORK_ORDER_STATUS.New, WORK_ORDER_STATUS.Scheduled),
      false,
    );
    assert.equal(
      canWorkOrderTransition(WORK_ORDER_STATUS.OnHold, WORK_ORDER_STATUS.New),
      false,
    );
    assert.deepEqual(WORK_ORDER_TRANSITION_MAP[WORK_ORDER_STATUS.Completed], []);
    assert.deepEqual(WORK_ORDER_TRANSITION_MAP[WORK_ORDER_STATUS.Cancelled], []);
  });
});

describe("quote lifecycle", () => {
  test("detects terminal statuses", () => {
    assert.equal(isTerminalQuoteStatus(QUOTE_STATUS.ClientApproved), true);
    assert.equal(isTerminalQuoteStatus(QUOTE_STATUS.ClientRejected), true);
    assert.equal(isTerminalQuoteStatus(QUOTE_STATUS.Expired), true);
    assert.equal(isTerminalQuoteStatus(QUOTE_STATUS.UnderReview), false);
  });

  test("allows internal and client-facing approval stages", () => {
    assert.equal(
      canQuoteTransition(QUOTE_STATUS.UnderReview, QUOTE_STATUS.ApprovedInternal),
      true,
    );
    assert.equal(
      canQuoteTransition(QUOTE_STATUS.ApprovedInternal, QUOTE_STATUS.SentToClient),
      true,
    );
    assert.equal(
      canQuoteTransition(QUOTE_STATUS.SentToClient, QUOTE_STATUS.ClientApproved),
      true,
    );
    assert.equal(
      canQuoteTransition(QUOTE_STATUS.Rejected, QUOTE_STATUS.Requested),
      true,
    );
  });

  test("rejects invalid transitions and terminal forward transitions", () => {
    assert.equal(
      canQuoteTransition(QUOTE_STATUS.Requested, QUOTE_STATUS.SentToClient),
      false,
    );
    assert.equal(
      canQuoteTransition(QUOTE_STATUS.ClientApproved, QUOTE_STATUS.Cancelled),
      false,
    );
    assert.deepEqual(QUOTE_TRANSITION_MAP[QUOTE_STATUS.ClientApproved], []);
    assert.deepEqual(QUOTE_TRANSITION_MAP[QUOTE_STATUS.Cancelled], []);
  });
});

describe("invoice lifecycle", () => {
  test("detects terminal statuses", () => {
    assert.equal(isTerminalInvoiceStatus(INVOICE_STATUS.Paid), true);
    assert.equal(isTerminalInvoiceStatus(INVOICE_STATUS.Voided), true);
    assert.equal(isTerminalInvoiceStatus(INVOICE_STATUS.Sent), false);
  });

  test("allows payment transitions and voiding from non-terminal states", () => {
    assert.equal(
      canInvoiceTransition(INVOICE_STATUS.NotReady, INVOICE_STATUS.Ready),
      true,
    );
    assert.equal(
      canInvoiceTransition(INVOICE_STATUS.Sent, INVOICE_STATUS.PartiallyPaid),
      true,
    );
    assert.equal(
      canInvoiceTransition(INVOICE_STATUS.Overdue, INVOICE_STATUS.Paid),
      true,
    );
    assert.equal(
      canInvoiceTransition(INVOICE_STATUS.PartiallyPaid, INVOICE_STATUS.Voided),
      true,
    );
  });

  test("rejects invalid transitions and terminal forward transitions", () => {
    assert.equal(
      canInvoiceTransition(INVOICE_STATUS.NotReady, INVOICE_STATUS.Sent),
      false,
    );
    assert.equal(
      canInvoiceTransition(INVOICE_STATUS.Paid, INVOICE_STATUS.Voided),
      false,
    );
    assert.deepEqual(INVOICE_TRANSITION_MAP[INVOICE_STATUS.Paid], []);
    assert.deepEqual(INVOICE_TRANSITION_MAP[INVOICE_STATUS.Voided], []);
  });
});
