import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createPhaseTwoServiceHarness,
  makeAuditContext,
  makeOwnerActor,
} from "../../support/phase-two-fixtures.ts";

describe("client organization api integration", () => {
  test("creates a client organization successfully", async () => {
    const actor = makeOwnerActor();
    const harness = createPhaseTwoServiceHarness();

    const result = await harness.clientLocations.createClient({
      ...makeAuditContext(actor),
      name: "Harbourview Offices",
      displayName: "Harbourview",
      primaryContactName: "Jordan Lee",
      primaryContactEmail: "jordan.lee@example.com",
      primaryContactPhone: "416-555-0134",
      billingEmail: "ap@harbourview.example.com",
      notes: "Created from integration test.",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.organizationId, actor.scope.organizationId);
    assert.equal(result.value.name, "Harbourview Offices");
    assert.equal(result.value.displayName, "Harbourview");
    assert.equal(result.value.status, "active");

    const clients = await harness.clientLocations.listClients({
      organizationId: actor.scope.organizationId,
    });

    assert.equal(clients.ok, true);
    if (!clients.ok) {
      return;
    }

    assert.equal(clients.value.length, 1);
    assert.equal(clients.value[0]?.id, result.value.id);
  });
});
