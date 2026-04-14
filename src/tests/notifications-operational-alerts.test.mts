import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildOperationalAlertFeed,
  INTERNAL_NOTIFICATION_EVENT_MAP,
  resolveInternalNotificationRecipients,
} from "../modules/notifications/index.ts";
import { createNotificationService } from "../server/services/notification-service.ts";

describe("notifications event map", () => {
  test("includes the phase four operational events", () => {
    assert.equal(
      INTERNAL_NOTIFICATION_EVENT_MAP.work_order_ready_for_invoicing.defaultDueHours,
      24,
    );
    assert.equal(
      INTERNAL_NOTIFICATION_EVENT_MAP.quote_awaiting_client_action.defaultDueHours,
      72,
    );
    assert.equal(
      INTERNAL_NOTIFICATION_EVENT_MAP.invoice_overdue.severity,
      "critical",
    );
    assert.ok(INTERNAL_NOTIFICATION_EVENT_MAP.sla_breach_triggered);
    assert.ok(INTERNAL_NOTIFICATION_EVENT_MAP.work_order_stalled);
  });
});

describe("recipient resolution", () => {
  test("manager review routes to the assigned manager and owner", () => {
    const recipients = resolveInternalNotificationRecipients({
      eventType: "quote_awaiting_manager_review",
      workOrder: {
        assignedCoordinatorUserId: "user-coordinator",
        assignedManagerUserId: "user-manager",
      },
      organizationUsers: [
        { id: "user-coordinator", role: "coordinator", displayName: "Coord" },
        { id: "user-manager", role: "manager", displayName: "Manager" },
        { id: "user-owner", role: "owner", displayName: "Owner" },
      ],
    });

    assert.deepEqual(
      recipients.map((recipient) => recipient.userId).sort(),
      ["user-manager", "user-owner"],
    );
  });
});

describe("notification service", () => {
  test("captures recipient-scoped operational notifications", async () => {
    const repositories = makeRepositories();
    const service = createNotificationService(repositories as any);

    const result = await service.captureOperationalEvent({
      organizationId: "org-1",
      actor: {
        userId: "user-manager",
        role: "manager",
      },
      now: "2026-04-14T12:00:00.000Z",
      eventType: "work_order_ready_for_invoicing",
      entityType: "work-order",
      entityId: "wo-1",
      workOrder: {
        id: "wo-1",
        workOrderNumber: "WO-1001",
        assignedCoordinatorUserId: "user-coordinator",
        assignedManagerUserId: "user-manager",
        clientSnapshot: { id: "client-1", name: "Acme" },
        locationSnapshot: { id: "loc-1", name: "HQ", addressText: null },
      },
      toStatus: "ready_for_invoicing",
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.length, 2);
    assert.deepEqual(
      repositories.notifications.map((notification) => notification.recipientUserId).sort(),
      ["user-finance", "user-owner"],
    );
    assert.equal(repositories.notifications[0].eventType, "work_order_ready_for_invoicing");
  });

  test("lists only alerts visible to the requested user", async () => {
    const repositories = makeRepositories();
    const service = createNotificationService(repositories as any);

    await service.captureOperationalEvent({
      organizationId: "org-1",
      actor: {
        userId: "user-manager",
        role: "manager",
      },
      now: "2026-04-14T12:00:00.000Z",
      eventType: "invoice_overdue",
      entityType: "invoice",
      entityId: "inv-1",
      workOrder: {
        id: "wo-1",
        workOrderNumber: "WO-1001",
        assignedCoordinatorUserId: "user-coordinator",
        assignedManagerUserId: "user-manager",
        clientSnapshot: { id: "client-1", name: "Acme" },
        locationSnapshot: { id: "loc-1", name: "HQ", addressText: null },
      },
      invoice: {
        id: "inv-1",
        invoiceNumber: "INV-1001",
      },
      fromStatus: "sent",
      toStatus: "overdue",
      targetPath: "/finance",
    });

    const financeAlerts = await service.listAlertsForUser({
      recipientUserId: "user-finance",
      now: "2026-04-15T13:00:00.000Z",
    });
    const coordinatorAlerts = await service.listAlertsForUser({
      recipientUserId: "user-coordinator",
      now: "2026-04-15T13:00:00.000Z",
    });

    assert.equal(financeAlerts.ok, true);
    assert.equal(financeAlerts.value.length, 1);
    assert.equal(financeAlerts.value[0].state, "sla_breached");
    assert.equal(coordinatorAlerts.ok, true);
    assert.equal(coordinatorAlerts.value.length, 1);
    assert.equal(coordinatorAlerts.value[0].targetPath, "/finance");
  });
});

describe("alert feed shaping", () => {
  test("marks due-soon and overdue alerts with operational state", () => {
    const alerts = buildOperationalAlertFeed({
      now: "2026-04-14T12:00:00.000Z",
      notifications: [
        makeNotification({
          id: "n-1",
          eventType: "quote_awaiting_client_action",
          dueAt: "2026-04-14T18:00:00.000Z",
          severity: "normal",
        }),
        makeNotification({
          id: "n-2",
          eventType: "invoice_overdue",
          dueAt: "2026-04-14T10:00:00.000Z",
          severity: "critical",
        }),
      ],
    });

    assert.equal(alerts[0].id, "n-2");
    assert.equal(alerts[0].state, "sla_breached");
    assert.equal(alerts[1].id, "n-1");
    assert.equal(alerts[1].state, "at_risk");
  });
});

function makeRepositories() {
  const notifications = [] as any[];
  const users = [
    {
      id: "user-coordinator",
      email: "coord@example.com",
      displayName: "Coord",
      role: "coordinator",
      organizationId: "org-1",
      status: "active",
    },
    {
      id: "user-manager",
      email: "manager@example.com",
      displayName: "Manager",
      role: "manager",
      organizationId: "org-1",
      status: "active",
    },
    {
      id: "user-finance",
      email: "finance@example.com",
      displayName: "Finance",
      role: "finance_admin",
      organizationId: "org-1",
      status: "active",
    },
    {
      id: "user-owner",
      email: "owner@example.com",
      displayName: "Owner",
      role: "owner",
      organizationId: "org-1",
      status: "active",
    },
  ];

  return {
    notifications,
    internalNotifications: {
      newId() {
        return crypto.randomUUID();
      },
      async getById(id: string) {
        return notifications.find((notification) => notification.id === id) ?? null;
      },
      async create(entity: any) {
        notifications.push(entity);
        return { id: entity.id, item: entity };
      },
      async save(entity: any) {
        const index = notifications.findIndex((notification) => notification.id === entity.id);
        if (index >= 0) {
          notifications[index] = entity;
        } else {
          notifications.push(entity);
        }
        return { id: entity.id, item: entity };
      },
      async createMany(entities: readonly any[]) {
        entities.forEach((entity) => notifications.push(entity));
        return entities.map((entity) => ({ id: entity.id, item: entity }));
      },
      async listByRecipientUserId(recipientUserId: string, options: { status?: string; limit?: number } = {}) {
        const filtered = notifications.filter((notification) =>
          notification.recipientUserId === recipientUserId &&
          (options.status ? notification.status === options.status : true)
        );
        return {
          items: filtered.slice(0, options.limit ?? filtered.length),
          count: filtered.length,
        };
      },
    },
    userProfiles: {
      newId() {
        return crypto.randomUUID();
      },
      async getById(id: string) {
        return users.find((user) => user.id === id) ?? null;
      },
      async create(entity: any) {
        return { id: entity.id, item: entity };
      },
      async save(entity: any) {
        return { id: entity.id, item: entity };
      },
      async getByEmail(email: string) {
        return users.find((user) => user.email === email) ?? null;
      },
      async listByOrganizationId() {
        return { items: users as any[], count: users.length };
      },
      async listByContractorOrganizationId() {
        return { items: [], count: 0 };
      },
    },
  };
}

function makeNotification(input: {
  id: string;
  eventType: any;
  dueAt: string | null;
  severity: any;
}) {
  return {
    id: input.id,
    organizationId: "org-1",
    recipientUserId: "user-1",
    recipientRole: "manager" as const,
    eventType: input.eventType,
    title: "Alert",
    message: "Message",
    severity: input.severity,
    status: "active" as const,
    actor: {
      actorType: "user" as const,
      userId: "user-2",
      role: "manager" as const,
      displayName: "Manager",
    },
    entityType: "work-order" as const,
    entityId: "wo-1",
    workOrderId: "wo-1",
    invoiceId: null,
    quoteId: null,
    assignmentId: null,
    targetPath: "/dashboard/work-orders/wo-1",
    readAt: null,
    acknowledgedAt: null,
    resolvedAt: null,
    dueAt: input.dueAt,
    createdAt: "2026-04-14T08:00:00.000Z",
    updatedAt: "2026-04-14T08:00:00.000Z",
    metadata: null,
  };
}
