import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createWorkOrderSchema } from "../../../lib/validation/work-orders.ts";

describe("work order payload validation", () => {
  test("rejects work order creation without locationId", () => {
    assert.throws(
      () =>
        createWorkOrderSchema.parse({
          title: "Generator repair",
          description: "Investigate alarm.",
          priority: "medium",
          clientOrganizationId: "client-1",
        }),
      /Invalid locationId\./,
    );
  });

  test("rejects work order creation when locationId is blank", () => {
    assert.throws(
      () =>
        createWorkOrderSchema.parse({
          title: "Generator repair",
          description: "Investigate alarm.",
          priority: "medium",
          clientOrganizationId: "client-1",
          locationId: "   ",
        }),
      /Invalid locationId\./,
    );
  });

  test("rejects unknown fields where schema is strict", () => {
    assert.throws(
      () =>
        createWorkOrderSchema.parse({
          title: "Generator repair",
          description: "Investigate alarm.",
          priority: "medium",
          clientOrganizationId: "client-1",
          locationId: "loc-1",
          extraField: "nope",
        }),
      /unsupported field\(s\): extraField/i,
    );
  });
});
