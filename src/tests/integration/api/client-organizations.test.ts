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
      primaryContactId: "contact-jordan-lee",
      billingContactId: "contact-jordan-lee",
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

  test("stores normalized client contact links using canonical contact ids", async () => {
    const actor = makeOwnerActor();
    const harness = createPhaseTwoServiceHarness();

    const result = await harness.clientLocations.createClient({
      ...makeAuditContext(actor),
      name: "Northshore Retail",
      primaryContactId: "contact-avery-hill",
      billingContactId: "contact-jordan-lee",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.primaryContactId, "contact-avery-hill");
    assert.equal(result.value.billingContactId, "contact-jordan-lee");

    const links =
      await harness.repositories.clientOrganizationContactLinks.listByClientOrganizationId(
        result.value.id,
      );
    assert.equal(links.count, 2);
    assert.deepEqual(
      links.items.map((link) => [link.relationshipType, link.contactId, link.isPrimary]),
      [
        ["primary", "contact-avery-hill", true],
        ["billing", "contact-jordan-lee", false],
      ],
    );
  });

  test("clears linked client contacts when they are removed", async () => {
    const actor = makeOwnerActor();
    const harness = createPhaseTwoServiceHarness();

    const created = await harness.clientLocations.createClient({
      ...makeAuditContext(actor),
      name: "Detach Test Client",
      primaryContactId: "contact-avery-hill",
      billingContactId: "contact-jordan-lee",
    });

    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }

    const updated = await harness.clientLocations.updateClient({
      ...makeAuditContext(actor),
      clientOrganizationId: created.value.id,
      primaryContactId: null,
      billingContactId: null,
      linkedContacts: [],
    });

    assert.equal(updated.ok, true);
    if (!updated.ok) {
      return;
    }

    assert.equal(updated.value.primaryContactId, null);
    assert.equal(updated.value.billingContactId, null);

    const links =
      await harness.repositories.clientOrganizationContactLinks.listByClientOrganizationId(
        created.value.id,
      );
    assert.equal(links.count, 0);
  });

  test("links and unlinks additional client contacts without disturbing role slots", async () => {
    const actor = makeOwnerActor();
    const harness = createPhaseTwoServiceHarness();

    const created = await harness.clientLocations.createClient({
      ...makeAuditContext(actor),
      name: "Operations Client",
      primaryContactId: "contact-avery-hill",
      linkedContacts: [
        {
          contactId: "contact-jordan-lee",
          relationshipType: "operations",
        },
      ],
    });

    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }

    let links =
      await harness.repositories.clientOrganizationContactLinks.listByClientOrganizationId(
        created.value.id,
      );
    assert.equal(links.count, 2);
    assert.deepEqual(
      links.items.map((link) => [link.contactId, link.relationshipType]),
      [
        ["contact-jordan-lee", "operations"],
        ["contact-avery-hill", "primary"],
      ],
    );

    const updated = await harness.clientLocations.updateClient({
      ...makeAuditContext(actor),
      clientOrganizationId: created.value.id,
      primaryContactId: "contact-avery-hill",
      linkedContacts: [],
    });

    assert.equal(updated.ok, true);
    if (!updated.ok) {
      return;
    }

    links =
      await harness.repositories.clientOrganizationContactLinks.listByClientOrganizationId(
        created.value.id,
      );
    assert.equal(links.count, 1);
    assert.equal(links.items[0]?.contactId, "contact-avery-hill");
    assert.equal(updated.value.primaryContactId, "contact-avery-hill");
  });
});
