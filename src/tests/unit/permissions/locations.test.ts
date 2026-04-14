import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertCanCreateLocation,
  assertCanReadLocation,
  assertCanUpdateLocation,
} from "../../../lib/permissions/locations.ts";
import {
  makeClientActor,
  makeContractorActor,
  makeLocation,
  makeOwnerActor,
} from "../../support/phase-two-fixtures.ts";

describe("location permissions", () => {
  test("client user cannot read another organization's location", () => {
    const actor = makeClientActor({ clientOrganizationId: "client-1" });
    const otherLocation = makeLocation({
      id: "loc-2",
      clientOrganizationId: "client-2",
      clientSnapshot: {
        id: "client-2",
        name: "Other Client",
      },
    });

    assert.throws(
      () => assertCanReadLocation(actor, otherLocation),
      /do not have access to this location/i,
    );
  });

  test("client user cannot create a location for another organization", () => {
    const actor = makeClientActor({ clientOrganizationId: "client-1" });

    assert.throws(
      () =>
        assertCanCreateLocation(actor, {
          organizationId: "org-1",
          clientOrganizationId: "client-2",
        }),
      /do not have access to create locations/i,
    );
  });

  test("client user cannot update another organization's location", () => {
    const actor = makeClientActor({ clientOrganizationId: "client-1" });
    const otherLocation = makeLocation({
      id: "loc-2",
      clientOrganizationId: "client-2",
      clientSnapshot: {
        id: "client-2",
        name: "Other Client",
      },
    });

    assert.throws(
      () => assertCanUpdateLocation(actor, otherLocation),
      /do not have access to update this location/i,
    );
  });

  test("contractor user is denied location management access", () => {
    const actor = makeContractorActor();
    const location = makeLocation();

    assert.throws(
      () =>
        assertCanCreateLocation(actor, {
          organizationId: "org-1",
          clientOrganizationId: "client-1",
        }),
      /do not have access to create locations/i,
    );
    assert.throws(
      () => assertCanReadLocation(actor, location),
      /do not have access to this location/i,
    );
    assert.throws(
      () => assertCanUpdateLocation(actor, location),
      /do not have access to update this location/i,
    );
  });

  test("internal authorized users can manage location data as intended", () => {
    const actor = makeOwnerActor();
    const location = makeLocation();

    assert.doesNotThrow(() =>
      assertCanCreateLocation(actor, {
        organizationId: "org-1",
        clientOrganizationId: "client-1",
      }),
    );
    assert.doesNotThrow(() => assertCanReadLocation(actor, location));
    assert.doesNotThrow(() => assertCanUpdateLocation(actor, location));
  });
});
