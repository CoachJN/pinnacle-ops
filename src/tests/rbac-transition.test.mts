import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
} from "../lib/workflows/lifecycle/index.ts";
import {
  authorizeLifecycleTransition,
  PLATFORM_ROLES,
} from "../lib/workflows/rbac-transition/index.ts";

describe("work order transition authorization", () => {
  test("allows coordinator NEW -> TRIAGE", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.New,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
    });

    assert.equal(result.ok, true);
  });

  test("denies coordinator QA_REVIEW -> READY_FOR_INVOICING", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.QaReview,
      to: WORK_ORDER_STATUS.ReadyForInvoicing,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "ROLE_NOT_PERMITTED");
  });

  test("allows manager QA_REVIEW -> READY_FOR_INVOICING", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.QaReview,
      to: WORK_ORDER_STATUS.ReadyForInvoicing,
      actorType: "USER",
      role: PLATFORM_ROLES.Manager,
    });

    assert.equal(result.ok, true);
  });

  test("allows finance READY_FOR_INVOICING -> COMPLETED", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.ReadyForInvoicing,
      to: WORK_ORDER_STATUS.Completed,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
    });

    assert.equal(result.ok, true);
  });

  test("allows contractor SCHEDULED -> IN_PROGRESS", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.Scheduled,
      to: WORK_ORDER_STATUS.InProgress,
      actorType: "USER",
      role: PLATFORM_ROLES.ContractorUser,
    });

    assert.equal(result.ok, true);
  });

  test("denies client work-order transitions", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.New,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.ClientUser,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "ROLE_NOT_PERMITTED");
  });

  test("allows owner valid work-order lifecycle transitions", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.QuoteReceived,
      to: WORK_ORDER_STATUS.QuoteReview,
      actorType: "USER",
      role: PLATFORM_ROLES.Owner,
    });

    assert.equal(result.ok, true);
  });

  test("denies owner invalid work-order lifecycle transitions", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.New,
      to: WORK_ORDER_STATUS.Scheduled,
      actorType: "USER",
      role: PLATFORM_ROLES.Owner,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "LIFECYCLE_VALIDATION_FAILED");
  });

  test("denies system user-only work-order transitions", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.New,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "SYSTEM",
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "ROLE_NOT_PERMITTED");
  });
});

describe("quote transition authorization", () => {
  test("allows contractor REQUESTED -> SUBMITTED", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "quote",
      from: QUOTE_STATUS.Requested,
      to: QUOTE_STATUS.Submitted,
      actorType: "USER",
      role: PLATFORM_ROLES.ContractorUser,
    });

    assert.equal(result.ok, true);
  });

  test("allows coordinator SUBMITTED -> UNDER_REVIEW", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "quote",
      from: QUOTE_STATUS.Submitted,
      to: QUOTE_STATUS.UnderReview,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
    });

    assert.equal(result.ok, true);
  });

  test("allows manager APPROVED_INTERNAL -> SENT_TO_CLIENT", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "quote",
      from: QUOTE_STATUS.ApprovedInternal,
      to: QUOTE_STATUS.SentToClient,
      actorType: "USER",
      role: PLATFORM_ROLES.Manager,
    });

    assert.equal(result.ok, true);
  });

  test("allows client SENT_TO_CLIENT -> CLIENT_APPROVED", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "quote",
      from: QUOTE_STATUS.SentToClient,
      to: QUOTE_STATUS.ClientApproved,
      actorType: "USER",
      role: PLATFORM_ROLES.ClientUser,
    });

    assert.equal(result.ok, true);
  });

  test("denies finance quote transitions", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "quote",
      from: QUOTE_STATUS.Submitted,
      to: QUOTE_STATUS.UnderReview,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "ROLE_NOT_PERMITTED");
  });

  test("denies system ordinary quote transitions", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "quote",
      from: QUOTE_STATUS.Requested,
      to: QUOTE_STATUS.Submitted,
      actorType: "SYSTEM",
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "ROLE_NOT_PERMITTED");
  });
});

describe("invoice transition authorization", () => {
  test("allows finance DRAFT -> SENT", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "invoice",
      from: INVOICE_STATUS.Draft,
      to: INVOICE_STATUS.Sent,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
    });

    assert.equal(result.ok, true);
  });

  test("denies finance SENT -> VIEWED because it is system-only", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "invoice",
      from: INVOICE_STATUS.Sent,
      to: INVOICE_STATUS.Viewed,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "SYSTEM_ONLY_TRANSITION");
  });

  test("allows system SENT -> VIEWED", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "invoice",
      from: INVOICE_STATUS.Sent,
      to: INVOICE_STATUS.Viewed,
      actorType: "SYSTEM",
    });

    assert.equal(result.ok, true);
  });

  test("denies owner system-only invoice transitions when actorType is USER", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "invoice",
      from: INVOICE_STATUS.Sent,
      to: INVOICE_STATUS.Viewed,
      actorType: "USER",
      role: PLATFORM_ROLES.Owner,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "SYSTEM_ONLY_TRANSITION");
  });

  test("denies client invoice transitions", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "invoice",
      from: INVOICE_STATUS.Draft,
      to: INVOICE_STATUS.Sent,
      actorType: "USER",
      role: PLATFORM_ROLES.ClientUser,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "ROLE_NOT_PERMITTED");
  });
});

describe("transition authorization composition", () => {
  test("fails with lifecycle dependency details before role authorization", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.Triage,
      to: WORK_ORDER_STATUS.ApprovedToProceed,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
      context: {
        quoteRequired: true,
        quoteStatus: QUOTE_STATUS.SentToClient,
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "LIFECYCLE_VALIDATION_FAILED");
    assert.equal(
      (result.details?.lifecycleDetails as { dependency?: string } | undefined)
        ?.dependency,
      "quote",
    );
  });

  test("fails safely for unknown roles", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "work-order",
      from: WORK_ORDER_STATUS.New,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: "admin",
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "INVALID_ROLE");
  });

  test("fails safely for unknown actor types", () => {
    const result = authorizeLifecycleTransition({
      lifecycle: "invoice",
      from: INVOICE_STATUS.Sent,
      to: INVOICE_STATUS.Viewed,
      actorType: "ROBOT",
      role: PLATFORM_ROLES.Owner,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "INVALID_ACTOR_TYPE");
  });
});
