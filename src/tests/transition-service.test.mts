import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  type InvoiceLifecycleStatus,
  type WorkOrderLifecycleStatus,
} from "../lib/workflows/lifecycle/index.ts";
import { PLATFORM_ROLES } from "../lib/workflows/rbac-transition/index.ts";
import {
  applyInvoiceTransition,
  applyQuoteTransition,
  applyWorkOrderTransition,
  type LifecycleTransitionRepositories,
} from "../lib/workflows/transition-service/index.ts";
import type {
  TransitionAuditRecord,
  TransitionEventRecord,
} from "../lib/workflows/audit/index.ts";
import { applyStatusTransition } from "../lib/status-transitions.ts";
import type { Invoice } from "../types/financial.ts";
import type { WorkOrder } from "../types/work-order.ts";

describe("work order transition application", () => {
  test("apply succeeds for valid authorized transition and persists status", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.New,
      quoteRequired: false,
    });
    const repositories = makeRepositories({ workOrder });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(result.from, WORK_ORDER_STATUS.New);
    assert.equal(result.persistedStatus, WORK_ORDER_STATUS.Triage);
    assert.equal(workOrder.status, WORK_ORDER_STATUS.Triage);
    assert.equal(repositories.updateWorkOrderStatusCalls, 1);
    assert.equal(repositories.transitionAuditRecords.length, 1);
    assert.equal(repositories.transitionAuditRecords[0].finalOutcome, "SUCCEEDED");
    assert.equal(repositories.transitionEventRecords.length, 1);
    assert.equal(
      repositories.transitionEventRecords[0].eventType,
      "WORK_ORDER_STATUS_CHANGED",
    );
  });

  test("apply fails when entity is missing", async () => {
    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: "missing",
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
      repositories: makeRepositories(),
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "ENTITY_NOT_FOUND");
  });

  test("apply fails when stored status cannot be normalized", async () => {
    const workOrder = makeWorkOrder({ status: "unknown_status" as WorkOrder["status"] });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
      repositories: makeRepositories({ workOrder }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "STATUS_MODEL_MISMATCH");
  });

  test("apply fails when dependency context cannot be built", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.AwaitingClientApproval,
      quoteRequired: true,
    });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.ApprovedToProceed,
      actorType: "USER",
      role: PLATFORM_ROLES.Manager,
      repositories: makeRepositories({ workOrder }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "VALIDATION_FAILED");
    assert.equal(result.details?.dependency, "quote");
  });

  test("apply fails when authorization fails", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.New,
      quoteRequired: false,
    });
    const repositories = makeRepositories({ workOrder });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.ClientUser,
      repositories,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "AUTHORIZATION_FAILED");
    assert.equal(repositories.transitionAuditRecords.length, 1);
    assert.equal(repositories.transitionAuditRecords[0].finalOutcome, "REJECTED");
    assert.equal(
      repositories.transitionAuditRecords[0].authorizationFailureCode,
      "ROLE_NOT_PERMITTED",
    );
    assert.equal(repositories.transitionEventRecords.length, 0);
  });

  test("apply uses stored status instead of caller-provided metadata", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.New,
      quoteRequired: false,
    });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
      metadata: { from: WORK_ORDER_STATUS.QaReview },
      repositories: makeRepositories({ workOrder }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.from, WORK_ORDER_STATUS.New);
  });
});

describe("invoice transition application", () => {
  test("apply succeeds for valid finance transition", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const invoice = makeInvoice({ status: INVOICE_STATUS.NotReady, workOrderId: workOrder.id });

    const result = await applyInvoiceTransition({
      lifecycle: "invoice",
      entityType: "invoice",
      entityId: invoice.id,
      to: INVOICE_STATUS.Ready,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
      repositories: makeRepositories({ workOrder, invoice }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.persistedStatus, INVOICE_STATUS.Ready);
    assert.equal(invoice.status, INVOICE_STATUS.Ready);
  });

  test("apply fails when related work order status blocks readiness", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.QaReview });
    const invoice = makeInvoice({ status: INVOICE_STATUS.NotReady, workOrderId: workOrder.id });

    const result = await applyInvoiceTransition({
      lifecycle: "invoice",
      entityType: "invoice",
      entityId: invoice.id,
      to: INVOICE_STATUS.Ready,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
      repositories: makeRepositories({ workOrder, invoice }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "AUTHORIZATION_FAILED");
    assert.equal(
      result.authorizationResult?.details?.lifecycleFailureCode,
      "DEPENDENCY_FAILED",
    );
  });

  test("apply succeeds for system-driven VIEWED transition when allowed", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const invoice = makeInvoice({ status: INVOICE_STATUS.Sent, workOrderId: workOrder.id });
    const repositories = makeRepositories({ workOrder, invoice });

    const result = await applyInvoiceTransition({
      lifecycle: "invoice",
      entityType: "invoice",
      entityId: invoice.id,
      to: INVOICE_STATUS.Viewed,
      actorType: "SYSTEM",
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(result.persistedStatus, INVOICE_STATUS.Viewed);
    assert.equal(repositories.transitionAuditRecords.length, 1);
    assert.equal(repositories.transitionAuditRecords[0].actorType, "SYSTEM");
    assert.equal(repositories.transitionAuditRecords[0].role, null);
    assert.equal(repositories.transitionEventRecords.length, 1);
    assert.equal(
      repositories.transitionEventRecords[0].eventType,
      "INVOICE_STATUS_CHANGED",
    );
  });

  test("apply fails for user-driven system-only transition", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const invoice = makeInvoice({ status: INVOICE_STATUS.Sent, workOrderId: workOrder.id });

    const result = await applyInvoiceTransition({
      lifecycle: "invoice",
      entityType: "invoice",
      entityId: invoice.id,
      to: INVOICE_STATUS.Viewed,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
      repositories: makeRepositories({ workOrder, invoice }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "AUTHORIZATION_FAILED");
    assert.equal(result.authorizationResult?.failureCode, "SYSTEM_ONLY_TRANSITION");
  });
});

describe("quote transition application", () => {
  test("returns unsupported runtime path while quote persistence is split", async () => {
    const result = await applyQuoteTransition({
      lifecycle: "quote",
      entityType: "quote",
      entityId: "quote-1",
      to: QUOTE_STATUS.Submitted,
      actorType: "USER",
      role: PLATFORM_ROLES.ContractorUser,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "UNSUPPORTED_RUNTIME_PATH");
  });
});

describe("runtime transition integration", () => {
  test("primary status transition helper applies through canonical work-order service", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.New,
      quoteRequired: false,
    });
    const repositories = makeRepositories({ workOrder });

    const result = await applyStatusTransition({
      entity: "work_order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(result.lifecycle, "work-order");
    assert.equal(workOrder.status, WORK_ORDER_STATUS.Triage);
    assert.equal(repositories.updateWorkOrderStatusCalls, 1);
    assert.equal(repositories.transitionAuditRecords.length, 1);
    assert.equal(repositories.transitionEventRecords.length, 1);
  });

  test("primary status transition helper applies through canonical invoice service", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const invoice = makeInvoice({
      status: INVOICE_STATUS.NotReady,
      workOrderId: workOrder.id,
    });
    const repositories = makeRepositories({ workOrder, invoice });

    const result = await applyStatusTransition({
      entity: "invoice",
      entityId: invoice.id,
      to: INVOICE_STATUS.Ready,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(result.lifecycle, "invoice");
    assert.equal(invoice.status, INVOICE_STATUS.Ready);
    assert.equal(repositories.updateInvoiceStatusCalls, 1);
    assert.equal(repositories.transitionAuditRecords.length, 1);
    assert.equal(repositories.transitionEventRecords.length, 1);
  });
});

describe("transition audit logging failure handling", () => {
  test("successful business transition still succeeds when audit and event logging fail", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.New,
      quoteRequired: false,
    });
    const repositories = makeRepositories({
      workOrder,
      failAuditWrites: true,
      failEventWrites: true,
    });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(workOrder.status, WORK_ORDER_STATUS.Triage);
    assert.equal(result.sideEffectWarnings?.length, 2);
    assert.deepEqual(
      result.sideEffectWarnings?.map((warning) => warning.code),
      ["TRANSITION_AUDIT_LOG_FAILED", "TRANSITION_EVENT_LOG_FAILED"],
    );
  });

  test("business failure preserves original reason when audit logging also fails", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.New,
      quoteRequired: false,
    });
    const repositories = makeRepositories({ workOrder, failAuditWrites: true });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.ClientUser,
      repositories,
    });

    assert.equal(result.ok, false);
    assert.equal(result.failureCode, "AUTHORIZATION_FAILED");
    assert.equal(result.sideEffectWarnings?.length, 1);
    assert.equal(
      result.sideEffectWarnings?.[0].code,
      "TRANSITION_AUDIT_LOG_FAILED",
    );
    assert.equal(repositories.transitionEventRecords.length, 0);
  });
});

function makeWorkOrder(
  overrides: Omit<Partial<WorkOrder>, "status"> & {
    readonly status?: WorkOrder["status"] | WorkOrderLifecycleStatus | string;
    readonly quoteRequired?: boolean;
    readonly quoteStatus?: string | null;
  } = {},
): WorkOrder & { quoteRequired?: boolean; quoteStatus?: string | null } {
  return {
    id: "wo-1",
    organizationId: "org-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByUserId: "user-1",
    title: "Leaking pipe",
    description: "Pipe under sink is leaking",
    status: WORK_ORDER_STATUS.New as WorkOrder["status"],
    priority: "medium",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    ...overrides,
  } as WorkOrder & { quoteRequired?: boolean; quoteStatus?: string | null };
}

function makeInvoice(
  overrides: Omit<Partial<Invoice>, "status"> & {
    readonly status?: Invoice["status"] | InvoiceLifecycleStatus | string;
  } = {},
): Invoice {
  return {
    id: "invoice-1",
    organizationId: "org-1",
    workOrderId: "wo-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    status: INVOICE_STATUS.NotReady as Invoice["status"],
    currencyCode: "USD",
    subtotalAmountCents: 10000,
    totalAmountCents: 10000,
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    ...overrides,
  } as Invoice;
}

function makeRepositories(input: {
  readonly workOrder?: WorkOrder;
  readonly invoice?: Invoice;
  readonly failAuditWrites?: boolean;
  readonly failEventWrites?: boolean;
} = {}): LifecycleTransitionRepositories & {
  updateWorkOrderStatusCalls: number;
  updateInvoiceStatusCalls: number;
  transitionAuditRecords: TransitionAuditRecord[];
  transitionEventRecords: TransitionEventRecord[];
} {
  return {
    updateWorkOrderStatusCalls: 0,
    updateInvoiceStatusCalls: 0,
    transitionAuditRecords: [],
    transitionEventRecords: [],
    getWorkOrderById: (entityId) =>
      input.workOrder?.id === entityId ? input.workOrder : null,
    updateWorkOrderStatus(entityId, nextStatus) {
      this.updateWorkOrderStatusCalls += 1;
      if (!input.workOrder || input.workOrder.id !== entityId) {
        throw new Error("work order not found");
      }
      input.workOrder.status = nextStatus as WorkOrder["status"];
      return input.workOrder;
    },
    getInvoiceById: (entityId) =>
      input.invoice?.id === entityId ? input.invoice : null,
    updateInvoiceStatus(entityId, nextStatus) {
      this.updateInvoiceStatusCalls += 1;
      if (!input.invoice || input.invoice.id !== entityId) {
        throw new Error("invoice not found");
      }
      input.invoice.status = nextStatus as Invoice["status"];
      return input.invoice;
    },
    recordTransitionAudit(record) {
      if (input.failAuditWrites) {
        throw new Error("audit write failed");
      }
      this.transitionAuditRecords.push(record);
    },
    recordTransitionEvent(record) {
      if (input.failEventWrites) {
        throw new Error("event write failed");
      }
      this.transitionEventRecords.push(record);
    },
  };
}
