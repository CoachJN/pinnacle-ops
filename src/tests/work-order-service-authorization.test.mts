import assert from "node:assert/strict";
import test from "node:test";

import {
  createPhaseTwoServiceHarness,
  makeClientActor,
  makeClientOrganization,
  makeContractorActor,
  makeLocation,
  makeOwnerActor,
  makeWorkOrder,
  makeWorkOrderMutationContext,
} from "./support/phase-two-fixtures.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { WorkOrderMutationContext } from "../server/services/work-order-mutation-context.ts";

function makeInternalActor(
  role:
    | typeof USER_ROLES.Coordinator
    | typeof USER_ROLES.Manager
    | typeof USER_ROLES.FinanceAdmin
    | typeof USER_ROLES.Owner,
  userId: string,
) {
  return makeOwnerActor({ role, userId });
}

function createHarness(workOrder = makeWorkOrder()) {
  return createPhaseTwoServiceHarness({
    clients: [makeClientOrganization()],
    locations: [makeLocation()],
    workOrders: [workOrder],
  });
}

test("missing actor context cannot mutate a work order", async () => {
  const harness = createHarness();

  const result = await harness.workOrders.transition({
    ...makeWorkOrderMutationContext(makeInternalActor(USER_ROLES.Manager, "manager-1")),
    actor: undefined as never,
    workOrderId: "wo-1",
    toStatus: "triage",
  } as never);

  assert.equal(result.ok, false);
  assert.match(result.error.message, /actor context is required/i);
});

test("invalid organization context cannot mutate a work order", async () => {
  const harness = createHarness();

  const result = await harness.workOrders.update({
    ...makeWorkOrderMutationContext(makeInternalActor(USER_ROLES.Manager, "manager-1"), {
      organizationId: "org-2",
    }),
    workOrderId: "wo-1",
    title: "Unauthorized change",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "not_found");
});

test("external client cannot perform internal-only direct transitions", async () => {
  const harness = createHarness();

  const result = await harness.workOrders.transition({
    ...makeWorkOrderMutationContext(makeClientActor()),
    workOrderId: "wo-1",
    toStatus: "triage",
  });

  assert.equal(result.ok, false);
  assert.match(result.error.message, /do not have permission/i);
});

test("contractor cannot drive client approval quote workflow transitions", async () => {
  const harness = createHarness(
    makeWorkOrder({
      lifecycleStatus: "client_approval_requested",
      status: "client_approval_requested",
      assignedContractorOrgId: "contractor-1",
    }),
  );

  const result = await harness.workOrders.applyQuoteWorkflowTransition({
    ...makeWorkOrderMutationContext(makeContractorActor(), {
      source: "quote_workflow",
    }),
    workOrderId: "wo-1",
    toStatus: "client_approved",
  });

  assert.equal(result.ok, false);
  assert.match(result.error.message, /may not drive quote workflow transition/i);
});

test("coordinator cannot perform finance-only invoice workflow transitions", async () => {
  const harness = createHarness(
    makeWorkOrder({
      lifecycleStatus: "invoiced",
      status: "invoiced",
    }),
  );

  const result = await harness.workOrders.applyInvoiceWorkflowTransition({
    ...makeWorkOrderMutationContext(
      makeInternalActor(USER_ROLES.Coordinator, "coordinator-1"),
      { source: "invoice_workflow" },
    ),
    workOrderId: "wo-1",
    toStatus: "paid",
  });

  assert.equal(result.ok, false);
  assert.match(result.error.message, /may not drive invoice workflow transition/i);
});

test("system actor must be explicit and trusted", async () => {
  const harness = createHarness(
    makeWorkOrder({
      lifecycleStatus: "invoiced",
      status: "invoiced",
    }),
  );

  const result = await harness.workOrders.applyInvoiceWorkflowTransition({
    organizationId: "org-1",
    actor: {
      actorType: "system",
      userId: "system",
      role: "system",
      scope: {
        kind: "system",
        organizationId: "org-1",
        trusted: false,
      },
    } as unknown as WorkOrderMutationContext["actor"],
    source: "invoice_workflow",
    workOrderId: "wo-1",
    toStatus: "paid",
  });

  assert.equal(result.ok, false);
  assert.match(result.error.message, /trusted system actor/i);
});

test("approved external workflow actors can use their canonical transition path", async () => {
  const harness = createHarness(
    makeWorkOrder({
      lifecycleStatus: "client_approval_requested",
      status: "client_approval_requested",
    }),
  );

  const result = await harness.workOrders.applyQuoteWorkflowTransition({
    ...makeWorkOrderMutationContext(makeClientActor(), {
      source: "quote_workflow",
    }),
    workOrderId: "wo-1",
    toStatus: "client_approved",
  });

  assert.equal(result.ok, true, result.ok ? "" : result.error.message);
  assert.equal(result.value.lifecycleStatus, "client_approved");
});
