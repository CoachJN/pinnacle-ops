import assert from "node:assert/strict";
import test from "node:test";

import { filterContractors } from "../modules/contractors/domain/filter-contractors.ts";
import { isContractorAssignable } from "../modules/contractors/domain/is-contractor-assignable.ts";
import {
  createContractorSchema,
  updateContractorSchema,
} from "../modules/contractors/domain/schemas.ts";

test("create contractor validation requires core fields and normalizes arrays", () => {
  const contractor = createContractorSchema.parse({
    name: "Maya Chen",
    company: "Blue Arc Electrical",
    email: "ops@bluearc.example",
    phone: "416-555-0311",
    status: "onboarding",
    serviceCategories: ["Electrical", "Electrical", "Emergency power"],
    serviceAreas: ["Toronto", "Mississauga"],
    notes: "Awaiting insurance documents.",
  });

  assert.equal(contractor.name, "Maya Chen");
  assert.equal(contractor.status, "onboarding");
  assert.deepEqual(contractor.serviceCategories, [
    "Electrical",
    "Electrical",
    "Emergency power",
  ]);

  assert.throws(
    () =>
      createContractorSchema.parse({
        name: "",
        company: null,
        email: "invalid",
        phone: "",
        status: "active",
        serviceCategories: [],
        serviceAreas: [],
        notes: null,
      }),
    /name|email|phone/i,
  );
});

test("update contractor validation accepts partial changes", () => {
  const payload = updateContractorSchema.parse({
    status: "suspended",
    serviceCategories: ["HVAC"],
    serviceAreas: ["Toronto West"],
  });

  assert.equal(payload.status, "suspended");
  assert.deepEqual(payload.serviceAreas, ["Toronto West"]);
});

test("contractor filtering matches status and search terms", () => {
  const contractors = [
    {
      name: "Jordan Patel",
      company: "North Peak Mechanical",
      email: "dispatch@northpeak.example",
      phone: "416-555-0208",
      status: "active" as const,
      serviceCategories: ["HVAC"],
      serviceAreas: ["Toronto"],
    },
    {
      name: "Ava Lopez",
      company: "Harbour Plumbing",
      email: "hello@harbourplumbing.example",
      phone: "416-555-0209",
      status: "suspended" as const,
      serviceCategories: ["Plumbing"],
      serviceAreas: ["Hamilton"],
    },
    {
      name: "Owen Brooks",
      company: "Elevate Doors",
      email: "ops@elevatedoors.example",
      phone: "416-555-0210",
      status: "onboarding" as const,
      serviceCategories: ["Access control"],
      serviceAreas: ["Toronto West"],
    },
  ];

  assert.deepEqual(
    filterContractors(contractors, { status: "active" }).map(
      (contractor) => contractor.company,
    ),
    ["North Peak Mechanical"],
  );

  assert.deepEqual(
    filterContractors(contractors, { search: "hamilton" }).map(
      (contractor) => contractor.company,
    ),
    ["Harbour Plumbing"],
  );
});

test("assignment readiness requires active status and service coverage", () => {
  assert.equal(
    isContractorAssignable({
      status: "active",
      serviceCategories: ["HVAC"],
    }),
    true,
  );

  assert.equal(
    isContractorAssignable({
      status: "onboarding",
      serviceCategories: ["HVAC"],
    }),
    false,
  );

  assert.equal(
    isContractorAssignable({
      status: "active",
      serviceCategories: [],
    }),
    false,
  );
});
