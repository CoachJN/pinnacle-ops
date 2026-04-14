import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createLocationSchema,
  updateLocationSchema,
} from "../../../lib/validation/locations.ts";
import {
  createLocationDomainServiceHarness,
  makeClientActor,
  makeClientOrganization,
  makeContractorActor,
  makeLocation,
  makeOwnerActor,
} from "../../support/phase-two-fixtures.ts";

describe("location api integration", () => {
  test("creates a location successfully", async () => {
    const actor = makeOwnerActor();
    const harness = createLocationDomainServiceHarness({
      clients: [makeClientOrganization()],
    });
    const payload = createLocationSchema.parse({
      clientOrganizationId: "client-1",
      name: "Harbour Centre",
      city: "Toronto",
      locationContactEmail: "ops@example.com",
    });

    const result = await harness.service.createLocation({
      actor,
      payload,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.name, "Harbour Centre");
    assert.equal(result.value.city, "Toronto");
    assert.equal(result.value.locationContactEmail, "ops@example.com");
    assert.equal(result.value.clientOrganizationId, "client-1");
  });

  test("updates a location successfully", async () => {
    const actor = makeOwnerActor();
    const location = makeLocation();
    const harness = createLocationDomainServiceHarness({
      clients: [makeClientOrganization()],
      locations: [location],
    });

    const result = await harness.service.updateLocation({
      actor,
      locationId: location.id,
      payload: updateLocationSchema.parse({
        name: "Pinnacle Tower East",
        notes: "Updated by API test",
      }),
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.name, "Pinnacle Tower East");
    assert.equal(result.value.notes, "Updated by API test");
  });

  test("deactivates a location successfully", async () => {
    const actor = makeOwnerActor();
    const location = makeLocation();
    const harness = createLocationDomainServiceHarness({
      clients: [makeClientOrganization()],
      locations: [location],
    });

    const result = await harness.service.deactivateLocation({
      actor,
      locationId: location.id,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.status, "inactive");
  });

  test("fetches location detail successfully", async () => {
    const actor = makeOwnerActor();
    const location = makeLocation();
    const harness = createLocationDomainServiceHarness({
      clients: [makeClientOrganization()],
      locations: [location],
    });

    const result = await harness.service.getLocationDetail({
      actor,
      locationId: location.id,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.id, location.id);
    assert.equal(result.value.clientOrganizationId, "client-1");
  });

  test("client user cannot read another organization's location", async () => {
    const actor = makeClientActor({ clientOrganizationId: "client-1" });
    const harness = createLocationDomainServiceHarness({
      clients: [
        makeClientOrganization({ id: "client-1" }),
        makeClientOrganization({
          id: "client-2",
          name: "Other Client",
          displayName: "Other Client",
        }),
      ],
      locations: [
        makeLocation({
          id: "loc-2",
          clientOrganizationId: "client-2",
          clientSnapshot: {
            id: "client-2",
            name: "Other Client",
          },
        }),
      ],
    });

    const result = await harness.service.getLocationDetail({
      actor,
      locationId: "loc-2",
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }

    assert.match(result.error.message, /do not have access to this location/i);
  });

  test("client user cannot create a location for another organization", async () => {
    const actor = makeClientActor({ clientOrganizationId: "client-1" });
    const harness = createLocationDomainServiceHarness({
      clients: [
        makeClientOrganization({ id: "client-1" }),
        makeClientOrganization({
          id: "client-2",
          name: "Other Client",
          displayName: "Other Client",
        }),
      ],
    });

    const result = await harness.service.createLocation({
      actor,
      payload: createLocationSchema.parse({
        clientOrganizationId: "client-2",
        name: "Restricted Location",
      }),
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }

    assert.match(
      result.error.message,
      /client users can only act within their own client organization/i,
    );
  });

  test("client user cannot update another organization's location", async () => {
    const actor = makeClientActor({ clientOrganizationId: "client-1" });
    const harness = createLocationDomainServiceHarness({
      clients: [
        makeClientOrganization({ id: "client-1" }),
        makeClientOrganization({
          id: "client-2",
          name: "Other Client",
          displayName: "Other Client",
        }),
      ],
      locations: [
        makeLocation({
          id: "loc-2",
          clientOrganizationId: "client-2",
          clientSnapshot: {
            id: "client-2",
            name: "Other Client",
          },
        }),
      ],
    });

    const result = await harness.service.updateLocation({
      actor,
      locationId: "loc-2",
      payload: updateLocationSchema.parse({
        notes: "Should not be allowed",
      }),
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }

    assert.match(result.error.message, /do not have access to locations/i);
  });

  test("contractor user is denied location management access", async () => {
    const actor = makeContractorActor();
    const harness = createLocationDomainServiceHarness({
      clients: [makeClientOrganization()],
      locations: [makeLocation()],
    });

    const [createResult, detailResult, updateResult] = await Promise.all([
      harness.service.createLocation({
        actor,
        payload: createLocationSchema.parse({
          clientOrganizationId: "client-1",
          name: "Restricted Location",
        }),
      }),
      harness.service.getLocationDetail({
        actor,
        locationId: "loc-1",
      }),
      harness.service.updateLocation({
        actor,
        locationId: "loc-1",
        payload: updateLocationSchema.parse({
          notes: "Denied",
        }),
      }),
    ]);

    assert.equal(createResult.ok, false);
    assert.equal(detailResult.ok, false);
    assert.equal(updateResult.ok, false);

    if (!createResult.ok) {
      assert.match(createResult.error.message, /do not have access to locations/i);
    }
    if (!detailResult.ok) {
      assert.match(detailResult.error.message, /do not have access to this location/i);
    }
    if (!updateResult.ok) {
      assert.match(updateResult.error.message, /do not have access to locations/i);
    }
  });

  test("internal authorized users can manage location data as intended", async () => {
    const actor = makeOwnerActor();
    const harness = createLocationDomainServiceHarness({
      clients: [makeClientOrganization()],
    });

    const created = await harness.service.createLocation({
      actor,
      payload: createLocationSchema.parse({
        clientOrganizationId: "client-1",
        name: "Managed Location",
        city: "Toronto",
      }),
    });

    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }

    const updated = await harness.service.updateLocation({
      actor,
      locationId: created.value.id,
      payload: updateLocationSchema.parse({
        notes: "Managed by internal user",
      }),
    });

    assert.equal(updated.ok, true);
    if (!updated.ok) {
      return;
    }

    const fetched = await harness.service.getLocationDetail({
      actor,
      locationId: created.value.id,
    });
    const deactivated = await harness.service.deactivateLocation({
      actor,
      locationId: created.value.id,
    });

    assert.equal(fetched.ok, true);
    assert.equal(deactivated.ok, true);
    if (fetched.ok) {
      assert.equal(fetched.value.notes, "Managed by internal user");
    }
    if (deactivated.ok) {
      assert.equal(deactivated.value.status, "inactive");
    }
  });
});
