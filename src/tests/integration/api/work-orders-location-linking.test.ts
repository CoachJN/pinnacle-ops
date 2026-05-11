import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createPhaseTwoServiceHarness,
  makeClientOrganization,
  makeLocation,
  makeOwnerActor,
  makeWorkOrderMutationContext,
} from "../../support/phase-two-fixtures.ts";

describe("work order location linkage integration", () => {
  test("rejects work order with missing location", async () => {
    const harness = createPhaseTwoServiceHarness({
      clients: [makeClientOrganization()],
      locations: [makeLocation()],
    });

    const result = await harness.workOrders.create({
      ...makeWorkOrderMutationContext(makeOwnerActor()),
      title: "Generator repair",
      description: "Investigate generator alarm.",
      priority: "medium",
      clientOrganizationId: "client-1",
      locationId: " ",
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }

    assert.match(result.error.message, /locationId is required/i);
  });

  test("rejects work order with inactive location", async () => {
    const harness = createPhaseTwoServiceHarness({
      clients: [makeClientOrganization()],
      locations: [
        makeLocation({
          status: "inactive",
        }),
      ],
    });

    const result = await harness.workOrders.create({
      ...makeWorkOrderMutationContext(makeOwnerActor()),
      title: "Generator repair",
      description: "Investigate generator alarm.",
      priority: "medium",
      clientOrganizationId: "client-1",
      locationId: "loc-1",
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }

    assert.match(result.error.message, /inactive locations cannot be used/i);
  });

  test("rejects work order with mismatched clientOrganizationId and locationId", async () => {
    const harness = createPhaseTwoServiceHarness({
      clients: [
        makeClientOrganization({ id: "client-1", displayName: "Northstar" }),
        makeClientOrganization({
          id: "client-2",
          name: "Beacon Holdings",
          displayName: "Beacon",
        }),
      ],
      locations: [
        makeLocation({
          id: "loc-2",
          clientOrganizationId: "client-2",
        }),
      ],
    });

    const result = await harness.workOrders.create({
      ...makeWorkOrderMutationContext(makeOwnerActor()),
      title: "Generator repair",
      description: "Investigate generator alarm.",
      priority: "medium",
      clientOrganizationId: "client-1",
      locationId: "loc-2",
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }

    assert.match(
      result.error.message,
      /does not belong to the specified client organization/i,
    );
  });

  test("allows work order with valid organization and location pairing", async () => {
    const harness = createPhaseTwoServiceHarness({
      clients: [makeClientOrganization()],
      locations: [makeLocation()],
    });

    const result = await harness.workOrders.create({
      ...makeWorkOrderMutationContext(makeOwnerActor()),
      title: "Generator repair",
      description: "Investigate generator alarm.",
      priority: "medium",
      clientOrganizationId: "client-1",
      locationId: "loc-1",
      requestedByName: "Smoke Test Requester",
      requestedByEmail: "requester@example.com",
      requestedByPhone: "555-0100",
      requiresQuote: true,
      quoteRequiredThresholdCents: 25000,
      dueDate: "2026-05-09T00:00:00.000Z",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.clientOrganizationId, "client-1");
    assert.equal(result.value.locationId, "loc-1");
    assert.equal(result.value.clientSnapshot.id, "client-1");
    assert.equal(result.value.locationSnapshot.id, "loc-1");
    assert.equal(result.value.requestedByName, "Smoke Test Requester");
    assert.equal(result.value.requestedByEmail, "requester@example.com");
    assert.equal(result.value.requestedByPhone, "555-0100");
    assert.equal(result.value.requiresQuote, true);
    assert.equal(result.value.quoteRequiredThresholdCents, 25000);
    assert.equal(result.value.quoteSummaryStatus, "required");
    assert.equal(result.value.dueDate, "2026-05-09T00:00:00.000Z");
  });
});
