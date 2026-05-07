import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  TransitionAuditRecord,
  TransitionEventRecord,
} from "../lib/workflows/audit/index.ts";
import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  type InvoiceLifecycleStatus,
  type WorkOrderLifecycleStatus,
} from "../lib/workflows/lifecycle/index.ts";
import { PLATFORM_ROLES } from "../lib/workflows/rbac-transition/index.ts";
import {
  handleTransitionEvent,
  QUOTE_AUTOMATION_MAPPINGS,
  QUOTE_NOTIFICATION_MAPPINGS,
  type AutomationIntent,
  type NotificationIntent,
} from "../lib/workflows/reactions/index.ts";
import {
  applyInvoiceTransition,
  applyWorkOrderTransition,
  type LifecycleTransitionRepositories,
} from "../lib/workflows/transition-service/index.ts";
import type { ClientInvoice as Invoice } from "../types/invoice.ts";
import type { WorkOrder } from "../types/work-order.ts";

describe("transition reaction intent mapping", () => {
  test("work-order READY_FOR_INVOICING generates finance notification and invoicing automation", async () => {
    const result = await handleTransitionEvent(
      makeEvent({
        lifecycle: "work-order",
        entityType: "work-order",
        previousStatus: WORK_ORDER_STATUS.QaReview,
        newStatus: WORK_ORDER_STATUS.ReadyForInvoicing,
      }),
    );

    assert.equal(result.generatedIntentCounts.notifications, 1);
    assert.equal(result.generatedIntentCounts.automations, 1);
    assert.equal(
      result.notificationIntents[0].type,
      "FINANCE_WORK_READY_FOR_INVOICING_ALERT",
    );
    assert.equal(
      result.automationIntents[0].type,
      "FLAG_WORK_ORDER_FOR_INVOICING",
    );
  });

  test("work-order APPROVED_TO_PROCEED generates coordinator notification and scheduling automation", async () => {
    const result = await handleTransitionEvent(
      makeEvent({
        lifecycle: "work-order",
        entityType: "work-order",
        previousStatus: WORK_ORDER_STATUS.AwaitingClientApproval,
        newStatus: WORK_ORDER_STATUS.ApprovedToProceed,
      }),
    );

    assert.equal(result.notificationIntents[0].type, "COORDINATOR_WORK_READY_ALERT");
    assert.equal(
      result.automationIntents[0].type,
      "FLAG_WORK_ORDER_FOR_SCHEDULING",
    );
  });

  test("work-order AWAITING_CLIENT_APPROVAL generates client quote decision request", async () => {
    const result = await handleTransitionEvent(
      makeEvent({
        lifecycle: "work-order",
        entityType: "work-order",
        previousStatus: WORK_ORDER_STATUS.QuoteReview,
        newStatus: WORK_ORDER_STATUS.AwaitingClientApproval,
      }),
    );

    assert.equal(
      result.notificationIntents[0].type,
      "CLIENT_QUOTE_DECISION_REQUEST",
    );
    assert.equal(result.automationIntents[0].type, "REQUEST_MANAGER_REVIEW");
  });

  test("invoice SENT generates invoice sent notification", async () => {
    const result = await handleTransitionEvent(
      makeEvent({
        lifecycle: "invoice",
        entityType: "invoice",
        previousStatus: INVOICE_STATUS.Draft,
        newStatus: INVOICE_STATUS.Sent,
      }),
    );

    assert.equal(result.generatedIntentCounts.notifications, 1);
    assert.equal(result.generatedIntentCounts.automations, 0);
    assert.equal(result.notificationIntents[0].type, "INVOICE_SENT_ALERT");
  });

  test("invoice OVERDUE generates overdue notification and collection review automation", async () => {
    const result = await handleTransitionEvent(
      makeEvent({
        lifecycle: "invoice",
        entityType: "invoice",
        previousStatus: INVOICE_STATUS.Sent,
        newStatus: INVOICE_STATUS.Overdue,
      }),
    );

    assert.equal(result.notificationIntents[0].type, "INVOICE_OVERDUE_ALERT");
    assert.equal(
      result.automationIntents[0].type,
      "FLAG_INVOICE_FOR_COLLECTION_REVIEW",
    );
  });
});

describe("transition reaction failure handling", () => {
  test("notification dispatch failure returns warnings while the reaction flow stays successful", async () => {
    const result = await handleTransitionEvent(
      makeEvent({
        lifecycle: "invoice",
        entityType: "invoice",
        previousStatus: INVOICE_STATUS.Draft,
        newStatus: INVOICE_STATUS.Sent,
      }),
      {
        sendClientNotification() {
          throw new Error("client notification failed");
        },
      },
    );

    assert.equal(result.ok, true);
    assert.equal(result.dispatchSummary.notificationFailed, 1);
    assert.equal(result.warnings[0].code, "TRANSITION_REACTION_NOTIFICATION_FAILED");
  });

  test("automation dispatch failure returns warnings while the reaction flow stays successful", async () => {
    const result = await handleTransitionEvent(
      makeEvent({
        lifecycle: "invoice",
        entityType: "invoice",
        previousStatus: INVOICE_STATUS.Sent,
        newStatus: INVOICE_STATUS.Overdue,
      }),
      {
        sendInternalNotification() {},
        enqueueAutomationIntent() {
          throw new Error("automation failed");
        },
      },
    );

    assert.equal(result.ok, true);
    assert.equal(result.dispatchSummary.automationFailed, 1);
    assert.equal(result.warnings[0].code, "TRANSITION_REACTION_AUTOMATION_FAILED");
  });

  test("no reactions are triggered when no event record is available", async () => {
    const result = await handleTransitionEvent(null, {
      sendInternalNotification() {
        throw new Error("should not be called");
      },
      enqueueAutomationIntent() {
        throw new Error("should not be called");
      },
    });

    assert.equal(result.generatedIntentCounts.notifications, 0);
    assert.equal(result.generatedIntentCounts.automations, 0);
    assert.equal(result.warnings[0].code, "TRANSITION_REACTION_EVENT_UNAVAILABLE");
  });
});

describe("transition reaction runtime integration", () => {
  test("successful canonical work-order transition path triggers reaction handling", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.QaReview,
      quoteRequired: false,
    });
    const repositories = makeRepositories({ workOrder });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.ReadyForInvoicing,
      actorType: "USER",
      role: PLATFORM_ROLES.Manager,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(repositories.sentInternalNotifications.length, 1);
    assert.equal(
      repositories.sentInternalNotifications[0].type,
      "FINANCE_WORK_READY_FOR_INVOICING_ALERT",
    );
    assert.equal(repositories.enqueuedAutomationIntents.length, 1);
    assert.equal(
      repositories.enqueuedAutomationIntents[0].type,
      "FLAG_WORK_ORDER_FOR_INVOICING",
    );
  });

  test("successful canonical invoice transition path triggers reaction handling", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const invoice = makeInvoice({
      status: INVOICE_STATUS.Draft,
      workOrderId: workOrder.id,
    });
    const repositories = makeRepositories({ workOrder, invoice });

    const result = await applyInvoiceTransition({
      lifecycle: "invoice",
      entityType: "invoice",
      entityId: invoice.id,
      to: INVOICE_STATUS.Sent,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(repositories.sentClientNotifications.length, 1);
    assert.equal(repositories.sentClientNotifications[0].type, "INVOICE_SENT_ALERT");
  });

  test("failed transition path does not trigger reactions", async () => {
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
    assert.equal(repositories.transitionEventRecords.length, 0);
    assert.equal(repositories.sentInternalNotifications.length, 0);
    assert.equal(repositories.enqueuedAutomationIntents.length, 0);
  });

  test("event logging failure does not trigger reactions", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.QaReview,
      quoteRequired: false,
    });
    const repositories = makeRepositories({ workOrder, failEventWrites: true });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.ReadyForInvoicing,
      actorType: "USER",
      role: PLATFORM_ROLES.Manager,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(result.sideEffectWarnings?.[0].code, "TRANSITION_EVENT_LOG_FAILED");
    assert.equal(repositories.sentInternalNotifications.length, 0);
    assert.equal(repositories.enqueuedAutomationIntents.length, 0);
  });

  test("missing event logging adapter does not trigger reactions", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.QaReview,
      quoteRequired: false,
    });
    const repositories = makeRepositories({
      workOrder,
      omitEventRecorder: true,
    });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.ReadyForInvoicing,
      actorType: "USER",
      role: PLATFORM_ROLES.Manager,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(
      result.sideEffectWarnings?.[0].code,
      "TRANSITION_EVENT_LOG_UNAVAILABLE",
    );
    assert.equal(repositories.sentInternalNotifications.length, 0);
    assert.equal(repositories.enqueuedAutomationIntents.length, 0);
  });
});

describe("quote reaction posture", () => {
  test("quote mappings are type-safe but runtime quote reaction execution is deferred", async () => {
    assert.ok(
      QUOTE_NOTIFICATION_MAPPINGS.some(
        (mapping) => mapping.newStatus === QUOTE_STATUS.SentToClient,
      ),
    );
    assert.ok(
      QUOTE_AUTOMATION_MAPPINGS.some(
        (mapping) => mapping.newStatus === QUOTE_STATUS.SentToClient,
      ),
    );

    const result = await handleTransitionEvent(
      makeEvent({
        lifecycle: "quote",
        entityType: "quote",
        previousStatus: QUOTE_STATUS.ApprovedInternal,
        newStatus: QUOTE_STATUS.SentToClient,
      }),
      {
        sendClientNotification() {
          throw new Error("quote runtime should not dispatch");
        },
        enqueueAutomationIntent() {
          throw new Error("quote runtime should not dispatch");
        },
      },
    );

    assert.equal(result.generatedIntentCounts.notifications, 0);
    assert.equal(result.generatedIntentCounts.automations, 0);
    assert.equal(
      result.warnings[0].code,
      "TRANSITION_REACTION_QUOTE_RUNTIME_DEFERRED",
    );
  });
});

function makeEvent(
  overrides: Partial<TransitionEventRecord>,
): TransitionEventRecord {
  const eventType =
    overrides.eventType ??
    (overrides.lifecycle === "invoice"
      ? "INVOICE_STATUS_CHANGED"
      : overrides.lifecycle === "quote"
        ? "QUOTE_STATUS_CHANGED"
        : "WORK_ORDER_STATUS_CHANGED");

  return {
    eventType,
    lifecycle: "work-order",
    entityType: "work-order",
    entityId: "entity-1",
    previousStatus: WORK_ORDER_STATUS.New,
    newStatus: WORK_ORDER_STATUS.Triage,
    actorType: "USER",
    role: PLATFORM_ROLES.Coordinator,
    actorUserId: "user-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    metadata: { correlationId: "corr-1" },
    source: "transition-service",
    version: 1,
    ...overrides,
  };
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
  readonly failEventWrites?: boolean;
  readonly omitEventRecorder?: boolean;
} = {}): LifecycleTransitionRepositories & {
  updateWorkOrderStatusCalls: number;
  updateInvoiceStatusCalls: number;
  transitionAuditRecords: TransitionAuditRecord[];
  transitionEventRecords: TransitionEventRecord[];
  sentInternalNotifications: NotificationIntent[];
  sentClientNotifications: NotificationIntent[];
  enqueuedAutomationIntents: AutomationIntent[];
} {
  const repositories = {
    updateWorkOrderStatusCalls: 0,
    updateInvoiceStatusCalls: 0,
    transitionAuditRecords: [] as TransitionAuditRecord[],
    transitionEventRecords: [] as TransitionEventRecord[],
    sentInternalNotifications: [] as NotificationIntent[],
    sentClientNotifications: [] as NotificationIntent[],
    enqueuedAutomationIntents: [] as AutomationIntent[],
    getWorkOrderById: (entityId: string) =>
      input.workOrder?.id === entityId ? input.workOrder : null,
    updateWorkOrderStatus(entityId: string, nextStatus: WorkOrderLifecycleStatus) {
      this.updateWorkOrderStatusCalls += 1;
      if (!input.workOrder || input.workOrder.id !== entityId) {
        throw new Error("work order not found");
      }
      input.workOrder.status = nextStatus as WorkOrder["status"];
      return input.workOrder;
    },
    getInvoiceById: (entityId: string) =>
      input.invoice?.id === entityId ? input.invoice : null,
    updateInvoiceStatus(entityId: string, nextStatus: InvoiceLifecycleStatus) {
      this.updateInvoiceStatusCalls += 1;
      if (!input.invoice || input.invoice.id !== entityId) {
        throw new Error("invoice not found");
      }
      input.invoice.status = nextStatus as Invoice["status"];
      return input.invoice;
    },
    recordTransitionAudit(record: TransitionAuditRecord) {
      this.transitionAuditRecords.push(record);
    },
    recordTransitionEvent(record: TransitionEventRecord) {
      if (input.failEventWrites) {
        throw new Error("event write failed");
      }
      this.transitionEventRecords.push(record);
    },
    sendInternalNotification(intent: NotificationIntent) {
      this.sentInternalNotifications.push(intent);
    },
    sendClientNotification(intent: NotificationIntent) {
      this.sentClientNotifications.push(intent);
    },
    enqueueAutomationIntent(intent: AutomationIntent) {
      this.enqueuedAutomationIntents.push(intent);
    },
    createInternalTask(intent: AutomationIntent) {
      this.enqueuedAutomationIntents.push(intent);
    },
  };

  if (input.omitEventRecorder) {
    return {
      ...repositories,
      recordTransitionEvent: undefined,
    };
  }

  return repositories;
}
