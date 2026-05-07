import test from "node:test";
import assert from "node:assert/strict";
import { syncSelectedContacts } from "../components/work-orders/create/contact-selection";
import type { WorkOrderFormValues } from "../components/work-orders/create/types";
import type { ContactSummary } from "../types/contact";

test("syncSelectedContacts hydrates requester fields from the selected contact", () => {
  const values = makeFormValues({
    requestedByContactId: "contact-1",
    requestedByName: "",
    requestedByEmail: "",
    requestedByPhone: "",
  });

  const nextValues = syncSelectedContacts({
    contacts: [makeContact({ id: "contact-1" })],
    values,
  });

  assert.deepEqual(nextValues, {
    ...values,
    requestedByName: "Avery Hill",
    requestedByEmail: "avery@example.com",
    requestedByPhone: "555-0101",
  });
});

test("syncSelectedContacts clears stale linked ids when the scoped contacts change", () => {
  const values = makeFormValues({
    requestedByContactId: "contact-1",
    siteContactId: "contact-2",
    requestedByName: "Manual Requester",
    requestedByEmail: "manual@example.com",
    requestedByPhone: "555-0000",
  });

  const nextValues = syncSelectedContacts({
    contacts: [],
    values,
  });

  assert.deepEqual(nextValues, {
    ...values,
    requestedByContactId: "",
    siteContactId: "",
  });
});

test("syncSelectedContacts returns null when no state changes are required", () => {
  const values = makeFormValues();

  const nextValues = syncSelectedContacts({
    contacts: [],
    values,
  });

  assert.equal(nextValues, null);
});

function makeFormValues(
  overrides: Partial<WorkOrderFormValues> = {},
): WorkOrderFormValues {
  return {
    title: "Broken sink faucet",
    description: "Water is leaking from the supply line behind the sink.",
    clientOrganizationId: "client-1",
    locationId: "location-1",
    requestedByContactId: "",
    siteContactId: "",
    priority: "MEDIUM",
    category: "GENERAL_REPAIR",
    requestedServiceDate: "",
    requiresQuote: false,
    quoteRequiredThreshold: "",
    requestedByName: "Pat Example",
    requestedByEmail: "",
    requestedByPhone: "",
    dueDate: "",
    ...overrides,
  };
}

function makeContact(
  overrides: Partial<ContactSummary> = {},
): ContactSummary {
  return {
    id: "contact-1",
    displayName: "Avery Hill",
    email: "avery@example.com",
    primaryPhone: "555-0101",
    preferredLanguage: "en",
    roleTitle: "Site Contact",
    status: "active",
    ...overrides,
  };
}
