import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("delivery recipient resolution is deterministic and tenant-scoped", async () => {
  const harness = createRuntimeHarness();

  const recipients = await harness.delivery.recipients.resolveRecipients({
    organizationId: "org-1",
    deliveryType: "escalation.first_response_breach_notification",
    workOrder: {
      id: "wo-recipient-1",
      coordinatorUserId: "user-coordinator",
      managerUserId: "user-manager",
    },
  });

  assert.deepEqual(
    recipients.map((recipient) => [recipient.recipientType, recipient.recipientId]),
    [
      ["assigned_coordinator", "user-coordinator"],
      ["assigned_manager", "user-manager"],
      ["internal_operations_group", "user-manager"],
      ["internal_operations_group", "user-owner"],
    ],
  );
  assert.equal(recipients.every((recipient) => recipient.recipientAddress.startsWith("internal:user:")), true);
});
