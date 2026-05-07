import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getAvailableInvoiceActions,
  getAvailableLifecycleActions,
  getAvailableQuoteActions,
  getAvailableWorkOrderActions,
} from "../lib/workflows/action-gating/index.ts";
import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  type InvoiceLifecycleStatus,
  type WorkOrderLifecycleStatus,
} from "../lib/workflows/lifecycle/index.ts";
import { PLATFORM_ROLES } from "../lib/workflows/rbac-transition/index.ts";
import type { LifecycleTransitionRepositories } from "../lib/workflows/transition-service/index.ts";
import type { ClientInvoice as Invoice } from "../types/invoice.ts";
import type { WorkOrder } from "../types/work-order.ts";

describe("work order action gating", () => {
  test("coordinator sees NEW -> TRIAGE action as allowed", async () => {
    const result = await getAvailableWorkOrderActions({
      entity: makeWorkOrder({ status: WORK_ORDER_STATUS.New, quoteRequired: false }),
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
    });

    assert.equal(action(result.actions, "move_to_triage")?.allowed, true);
  });

  test("coordinator sees QA_REVIEW -> READY_FOR_INVOICING action blocked", async () => {
    const result = await getAvailableWorkOrderActions({
      entity: makeWorkOrder({
        status: WORK_ORDER_STATUS.QaReview,
        quoteRequired: false,
      }),
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
    });

    const gatedAction = action(result.actions, "ready_for_invoicing");
    assert.equal(gatedAction?.allowed, false);
    assert.equal(gatedAction?.blockReasonCode, "ROLE_NOT_PERMITTED");
  });

  test("manager sees READY_FOR_INVOICING action allowed when applicable", async () => {
    const result = await getAvailableWorkOrderActions({
      entity: makeWorkOrder({
        status: WORK_ORDER_STATUS.QaReview,
        quoteRequired: false,
      }),
      actorType: "USER",
      role: PLATFORM_ROLES.Manager,
    });

    assert.equal(action(result.actions, "ready_for_invoicing")?.allowed, true);
  });

  test("quote-required work order blocks approval, scheduling, and start until quote approved", async () => {
    const result = await getAvailableWorkOrderActions({
      entity: makeWorkOrder({
        status: WORK_ORDER_STATUS.AwaitingClientApproval,
        quoteRequired: true,
        quoteStatus: QUOTE_STATUS.SentToClient,
      }),
      actorType: "USER",
      role: PLATFORM_ROLES.Manager,
    });

    for (const actionCode of [
      "approve_to_proceed",
      "move_to_scheduling",
      "start_work",
    ] as const) {
      const gatedAction = action(result.actions, actionCode);
      assert.equal(gatedAction?.allowed, false);
      assert.equal(gatedAction?.blockReasonCode, "DEPENDENCY_FAILED");
    }
  });

  test("contractor sees start_work allowed only from SCHEDULED", async () => {
    const scheduled = await getAvailableWorkOrderActions({
      entity: makeWorkOrder({
        status: WORK_ORDER_STATUS.Scheduled,
        quoteRequired: false,
      }),
      actorType: "USER",
      role: PLATFORM_ROLES.ContractorUser,
    });
    const triage = await getAvailableWorkOrderActions({
      entity: makeWorkOrder({
        status: WORK_ORDER_STATUS.Triage,
        quoteRequired: false,
      }),
      actorType: "USER",
      role: PLATFORM_ROLES.ContractorUser,
    });

    assert.equal(action(scheduled.actions, "start_work")?.allowed, true);
    assert.equal(action(triage.actions, "start_work")?.allowed, false);
  });

  test("client user sees no allowed work-order transition actions", async () => {
    const result = await getAvailableWorkOrderActions({
      entity: makeWorkOrder({ status: WORK_ORDER_STATUS.New, quoteRequired: false }),
      actorType: "USER",
      role: PLATFORM_ROLES.ClientUser,
    });

    assert.equal(result.actions.some((candidate) => candidate.allowed), false);
  });

  test("owner sees valid override actions but not invalid lifecycle actions", async () => {
    const result = await getAvailableWorkOrderActions({
      entity: makeWorkOrder({
        status: WORK_ORDER_STATUS.Triage,
        quoteRequired: false,
      }),
      actorType: "USER",
      role: PLATFORM_ROLES.Owner,
    });

    assert.equal(action(result.actions, "place_on_hold")?.allowed, true);
    assert.equal(action(result.actions, "start_work")?.allowed, false);
    assert.equal(action(result.actions, "start_work")?.blockReasonCode, "INVALID_TRANSITION");
  });
});

describe("invoice action gating", () => {
  test("finance sees DRAFT -> SENT allowed", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const result = await getAvailableInvoiceActions({
      entity: makeInvoice({ status: INVOICE_STATUS.Draft, workOrderId: workOrder.id }),
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
      repositories: makeRepositories({ workOrder }),
    });

    assert.equal(action(result.actions, "send_invoice")?.allowed, true);
  });

  test("finance sees SENT -> VIEWED blocked because system-only", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const result = await getAvailableInvoiceActions({
      entity: makeInvoice({ status: INVOICE_STATUS.Sent, workOrderId: workOrder.id }),
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
      repositories: makeRepositories({ workOrder }),
    });

    const gatedAction = action(result.actions, "mark_viewed");
    assert.equal(gatedAction?.allowed, false);
    assert.equal(gatedAction?.blockReasonCode, "SYSTEM_ONLY");
  });

  test("system sees VIEWED and OVERDUE actions appropriately", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const result = await getAvailableInvoiceActions({
      entity: makeInvoice({ status: INVOICE_STATUS.Sent, workOrderId: workOrder.id }),
      actorType: "SYSTEM",
      repositories: makeRepositories({ workOrder }),
    });

    assert.equal(action(result.actions, "mark_viewed")?.allowed, true);
    assert.equal(action(result.actions, "mark_overdue")?.allowed, true);
    assert.equal(action(result.actions, "send_invoice")?.allowed, false);
  });

  test("readiness actions are blocked when related work order is not ready for invoicing", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.QaReview });
    const result = await getAvailableInvoiceActions({
      entity: makeInvoice({ status: INVOICE_STATUS.NotReady, workOrderId: workOrder.id }),
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
      repositories: makeRepositories({ workOrder }),
    });

    const gatedAction = action(result.actions, "mark_ready");
    assert.equal(gatedAction?.allowed, false);
    assert.equal(gatedAction?.blockReasonCode, "DEPENDENCY_FAILED");
  });
});

describe("central action dispatcher", () => {
  test("routes correctly by lifecycle", async () => {
    const result = await getAvailableLifecycleActions({
      lifecycle: "work-order",
      entity: makeWorkOrder({ status: WORK_ORDER_STATUS.New, quoteRequired: false }),
      actorType: "USER",
      role: PLATFORM_ROLES.Coordinator,
    });

    assert.equal(result.lifecycle, "work-order");
    assert.equal(action(result.actions, "move_to_triage")?.allowed, true);
  });

  test("fails safely for unknown lifecycle", async () => {
    const result = await getAvailableLifecycleActions({
      lifecycle: "asset",
      actorType: "USER",
      role: PLATFORM_ROLES.Owner,
    });

    assert.equal(result.ok, false);
    assert.equal(result.supported, false);
    assert.equal(result.blockReasonCode, "UNSUPPORTED_RUNTIME_PATH");
  });
});

describe("quote action gating posture", () => {
  test("returns explicit unsupported result without claiming runtime apply support", () => {
    const result = getAvailableQuoteActions({
      entity: { id: "quote-1", status: QUOTE_STATUS.Requested },
      actorType: "USER",
      role: PLATFORM_ROLES.ContractorUser,
    });

    assert.equal(result.ok, false);
    assert.equal(result.supported, false);
    assert.equal(result.blockReasonCode, "UNSUPPORTED_RUNTIME_PATH");
    assert.equal(result.actions.every((candidate) => !candidate.allowed), true);
    assert.equal(
      result.actions.every(
        (candidate) => candidate.blockReasonCode === "UNSUPPORTED_RUNTIME_PATH",
      ),
      true,
    );
  });
});

function action<
  TAction extends { readonly actionCode: string },
  TCode extends TAction["actionCode"],
>(actions: readonly TAction[], actionCode: TCode): TAction | undefined {
  return actions.find((candidate) => candidate.actionCode === actionCode);
}

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
    requestedByContactId: "contact-1",
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
} = {}): LifecycleTransitionRepositories {
  return {
    getWorkOrderById: (entityId) =>
      input.workOrder?.id === entityId ? input.workOrder : null,
    getInvoiceById: (entityId) =>
      input.invoice?.id === entityId ? input.invoice : null,
  };
}
