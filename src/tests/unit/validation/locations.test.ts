import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createLocationSchema,
  updateLocationSchema,
} from "../../../lib/validation/locations.ts";

describe("location payload validation", () => {
  test("rejects missing required location fields", () => {
    assert.throws(
      () =>
        createLocationSchema.parse({
          name: "Pinnacle Tower",
        }),
      /Invalid clientOrganizationId\./,
    );
  });

  test("rejects malformed postal code values when they are not non-empty strings", () => {
    assert.throws(
      () =>
        createLocationSchema.parse({
          clientOrganizationId: "client-1",
          name: "Pinnacle Tower",
          postalCode: 90210,
        }),
      /postalCode must be a non-empty string\./i,
    );
  });

  test("rejects malformed postal code values when they are blank strings", () => {
    assert.throws(
      () =>
        createLocationSchema.parse({
          clientOrganizationId: "client-1",
          name: "Pinnacle Tower",
          postalCode: "   ",
        }),
      /postalCode must be a non-empty string\./i,
    );
  });

  test("accepts null optional create fields from form payloads", () => {
    const parsed = createLocationSchema.parse({
      clientOrganizationId: "client-1",
      name: "Pinnacle Tower",
      code: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      region: null,
      postalCode: null,
      countryCode: null,
      accessNotes: null,
      notes: null,
      status: "active",
    });

    assert.equal(parsed.clientOrganizationId, "client-1");
    assert.equal(parsed.name, "Pinnacle Tower");
    assert.equal(parsed.status, "active");
    assert.equal(parsed.code, undefined);
    assert.equal(parsed.addressLine1, undefined);
    assert.equal(parsed.addressLine2, undefined);
    assert.equal(parsed.city, undefined);
    assert.equal(parsed.region, undefined);
    assert.equal(parsed.postalCode, undefined);
    assert.equal(parsed.countryCode, undefined);
    assert.equal(parsed.accessNotes, undefined);
    assert.equal(parsed.notes, undefined);
  });

  test("rejects unknown fields where schema is strict", () => {
    assert.throws(
      () =>
        updateLocationSchema.parse({
          notes: "Updated notes",
          unexpectedField: true,
        }),
      /unsupported field\(s\): unexpectedField/i,
    );
  });
});
