import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../lib/errors/app-error.ts";
import { ERROR_CODES } from "../lib/errors/codes.ts";
import { toSafeErrorResponse } from "../lib/errors/safe-error.ts";
import { createActivityLogService } from "../server/services/activity-log-service.ts";
import type { ActivityLogRepository } from "../server/repositories/index.ts";

test("safe error responses include request ids without leaking raw details", () => {
  const response = toSafeErrorResponse(
    new AppError({
      code: ERROR_CODES.ExternalServiceUnavailable,
      message: "Firebase token abc123 failed",
      safeMessage: "A required service is temporarily unavailable.",
    }),
    { requestId: "req-123" },
  );

  assert.deepEqual(response, {
    code: ERROR_CODES.ExternalServiceUnavailable,
    message: "A required service is temporarily unavailable.",
    statusCode: 503,
    requestId: "req-123",
  });
});

test("activity log records structured actor, resource, and request metadata", async () => {
  const created: Array<unknown> = [];
  const activityLogs: ActivityLogRepository = {
    newId() {
      return "activity-1";
    },
    async getById() {
      return null;
    },
    async create(entity) {
      created.push(entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId() {
      return { items: [], count: 0 };
    },
  };

  const service = createActivityLogService({ activityLogs });
  const result = await service.record({
    organizationId: "org-1",
    actor: {
      userId: "user-1",
      role: "manager",
    },
    requestId: "req-456",
    workOrderId: "wo-1",
    action: "work_order.status_changed",
    eventType: "work_order_status_changed",
    message: "Changed work order status from new to in_review.",
    entityType: "workOrder",
    entityId: "wo-1",
    entityLabel: "WO-1001",
    changes: [{ field: "status", from: "new", to: "in_review" }],
    metadata: { fromStatus: "new", toStatus: "in_review" },
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.action, "work_order.status_changed");
  assert.equal(result.value.requestId, "req-456");
  assert.deepEqual(result.value.actor, {
    type: "user",
    userId: "user-1",
    role: "manager",
  });
  assert.deepEqual(result.value.resource, {
    type: "workOrder",
    id: "wo-1",
    label: "WO-1001",
    workOrderId: "wo-1",
  });
  assert.deepEqual(result.value.changes, [
    { field: "status", from: "new", to: "in_review" },
  ]);
  assert.equal(created.length, 1);
});
