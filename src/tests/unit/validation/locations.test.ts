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

  test("rejects invalid email fields", () => {
    assert.throws(
      () =>
        createLocationSchema.parse({
          clientOrganizationId: "client-1",
          name: "Pinnacle Tower",
          locationContactEmail: "not-an-email",
        }),
      /locationContactEmail must be a valid email address\./i,
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
