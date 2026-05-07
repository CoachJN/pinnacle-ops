import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createPhaseTwoServiceHarness,
  makeAuditContext,
  makeClientOrganization,
  makeOwnerActor,
} from "../../support/phase-two-fixtures.ts";

describe("normalized contact linking", () => {
  test("persists and clears location contact links", async () => {
    const actor = makeOwnerActor();
    const harness = createPhaseTwoServiceHarness({
      clients: [makeClientOrganization()],
    });

    const created = await harness.clientLocations.createLocation({
      ...makeAuditContext(actor),
      clientOrganizationId: "client-1",
      name: "North Annex",
      primaryContactId: "contact-avery-hill",
      siteContactId: "contact-jordan-lee",
    });

    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }

    let links = await harness.repositories.locationContactLinks.listByLocationId(
      created.value.id,
    );
    assert.equal(links.count, 2);
    assert.deepEqual(
      links.items.map((link) => [link.relationshipType, link.contactId, link.isPrimary]),
      [
        ["primary", "contact-avery-hill", true],
        ["site", "contact-jordan-lee", false],
      ],
    );

    const updated = await harness.clientLocations.updateLocation({
      ...makeAuditContext(actor),
      locationId: created.value.id,
      primaryContactId: null,
      siteContactId: null,
      linkedContacts: [],
    });

    assert.equal(updated.ok, true);
    if (!updated.ok) {
      return;
    }

    links = await harness.repositories.locationContactLinks.listByLocationId(
      created.value.id,
    );
    assert.equal(links.count, 0);
  });

  test("preserves role-slot consistency when location links change", async () => {
    const actor = makeOwnerActor();
    const harness = createPhaseTwoServiceHarness({
      clients: [makeClientOrganization()],
    });

    const created = await harness.clientLocations.createLocation({
      ...makeAuditContext(actor),
      clientOrganizationId: "client-1",
      name: "South Annex",
      primaryContactId: "contact-avery-hill",
      linkedContacts: [
        {
          contactId: "contact-jordan-lee",
          relationshipType: "site",
        },
      ],
    });

    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }

    const updated = await harness.clientLocations.updateLocation({
      ...makeAuditContext(actor),
      locationId: created.value.id,
      primaryContactId: "contact-avery-hill",
      linkedContacts: [
        {
          contactId: "contact-jordan-lee",
          relationshipType: "site",
        },
      ],
    });

    assert.equal(updated.ok, true);
    if (!updated.ok) {
      return;
    }

    const links = await harness.repositories.locationContactLinks.listByLocationId(
      created.value.id,
    );
    assert.deepEqual(
      links.items.map((link) => [link.contactId, link.relationshipType]),
      [
        ["contact-jordan-lee", "site"],
        ["contact-avery-hill", "primary"],
      ],
    );
  });
});
