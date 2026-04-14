import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
} from "../lib/workflows/lifecycle/index.ts";
import {
  normalizeInvoiceStatus,
  normalizeInvoiceStatusResult,
  normalizeQuoteStatus,
  normalizeWorkOrderStatus,
  validateInvoiceTransition,
  validateLifecycleTransition,
  validateWorkOrderTransition,
} from "../lib/workflows/transition-engine/index.ts";

describe("work order transition validator", () => {
  test("allows a valid forward transition", () => {
    const result = validateWorkOrderTransition(
      WORK_ORDER_STATUS.New,
      WORK_ORDER_STATUS.Triage,
    );

    assert.equal(result.ok, true);
    assert.equal(result.lifecycle, "work-order");
    assert.equal(result.normalizedFrom, WORK_ORDER_STATUS.New);
    assert.equal(result.normalizedTo, WORK_ORDER_STATUS.Triage);
  });

  test("rejects an invalid shortcut", () => {
    const result = validateWorkOrderTransition(
      WORK_ORDER_STATUS.New,
      WORK_ORDER_STATUS.Scheduled,
    );

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "INVALID_TRANSITION");
  });

  test("blocks terminal-state transitions", () => {
    const result = validateWorkOrderTransition(
      WORK_ORDER_STATUS.Completed,
      WORK_ORDER_STATUS.Cancelled,
    );

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "TERMINAL_STATE");
    assert.equal(result.currentStatusTerminal, true);
  });

  test("blocks quote-gated transitions without client approval", () => {
    const result = validateWorkOrderTransition(
      WORK_ORDER_STATUS.Triage,
      WORK_ORDER_STATUS.ApprovedToProceed,
      {
        quoteRequired: true,
        quoteStatus: QUOTE_STATUS.SentToClient,
      },
    );

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "DEPENDENCY_FAILED");
    assert.equal(result.details?.dependency, "quote");
  });

  test("allows quote-gated transitions with client approval", () => {
    const result = validateWorkOrderTransition(
      WORK_ORDER_STATUS.Triage,
      WORK_ORDER_STATUS.ApprovedToProceed,
      {
        quoteRequired: true,
        quoteStatus: QUOTE_STATUS.ClientApproved,
      },
    );

    assert.equal(result.ok, true);
  });
});

describe("invoice transition validator", () => {
  test("blocks NOT_READY -> READY without a ready work order", () => {
    const result = validateInvoiceTransition(
      INVOICE_STATUS.NotReady,
      INVOICE_STATUS.Ready,
      {
        workOrderStatus: WORK_ORDER_STATUS.QaReview,
      },
    );

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "DEPENDENCY_FAILED");
    assert.equal(result.details?.dependency, "work-order");
  });

  test("allows NOT_READY -> READY with a ready-for-invoicing work order", () => {
    const result = validateInvoiceTransition(
      INVOICE_STATUS.NotReady,
      INVOICE_STATUS.Ready,
      {
        workOrderStatus: WORK_ORDER_STATUS.ReadyForInvoicing,
      },
    );

    assert.equal(result.ok, true);
  });

  test("blocks terminal-state invoice transitions", () => {
    const result = validateInvoiceTransition(
      INVOICE_STATUS.Paid,
      INVOICE_STATUS.Voided,
    );

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "TERMINAL_STATE");
    assert.equal(result.currentStatusTerminal, true);
  });
});

describe("transition dispatcher", () => {
  test("routes to the requested lifecycle validator", () => {
    const result = validateLifecycleTransition({
      lifecycle: "quote",
      from: QUOTE_STATUS.Requested,
      to: QUOTE_STATUS.Submitted,
    });

    assert.equal(result.ok, true);
    assert.equal(result.lifecycle, "quote");
  });

  test("returns invalid lifecycle failure for unsupported lifecycles", () => {
    const result = validateLifecycleTransition({
      lifecycle: "assignment",
      from: "pending",
      to: "accepted",
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "INVALID_LIFECYCLE");
    assert.equal(result.lifecycle, "assignment");
  });
});

describe("status adapters", () => {
  test("normalizes matching lifecycle values", () => {
    assert.equal(
      normalizeWorkOrderStatus(WORK_ORDER_STATUS.ReadyForInvoicing),
      WORK_ORDER_STATUS.ReadyForInvoicing,
    );
    assert.equal(
      normalizeQuoteStatus(QUOTE_STATUS.ClientApproved),
      QUOTE_STATUS.ClientApproved,
    );
    assert.equal(normalizeInvoiceStatus(INVOICE_STATUS.NotReady), "NOT_READY");
  });

  test("maps explicit legacy values", () => {
    const result = normalizeInvoiceStatusResult("void");

    assert.equal(result.ok, true);
    assert.equal(result.status, INVOICE_STATUS.Voided);
    assert.equal(result.ok ? result.source : undefined, "legacy");
  });

  test("fails safely for mismatched values", () => {
    const result = normalizeInvoiceStatusResult("refunded");

    assert.equal(result.ok, false);
    assert.equal(result.status, null);
    assert.equal(result.failureCode, "STATUS_MODEL_MISMATCH");
  });
});
