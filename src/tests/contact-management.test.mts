import assert from "node:assert/strict";
import test from "node:test";

import {
  filterContacts,
  mapContactToFormValues,
  toContactPayload,
  validateContactFormValues,
} from "../components/contacts/contact-form.ts";
import { createContactSchema, updateContactSchema } from "../modules/contacts/domain/schemas.ts";
import { toContactDetail, toContactSummary } from "../server/api/contact-projections.ts";
import type { FirestoreRepositories } from "../server/repositories/index.ts";
import { createContactService } from "../server/services/contact-service.ts";
import {
  createPhaseTwoServiceHarness,
  makeAuditContext,
  makeContact,
  makeOwnerActor,
} from "./support/phase-two-fixtures.ts";

test("contact schema normalizes nullable fields for create and update", () => {
  const created = createContactSchema.parse({
    firstName: " Avery ",
    lastName: " Hill ",
    displayName: " ",
    email: "avery@example.com",
    primaryPhone: " ",
    preferredLanguage: "en",
    preferredContactMethod: null,
    notes: " ",
    status: "active",
  });
  const updated = updateContactSchema.parse({
    displayName: " ",
    roleTitle: " Operations Lead ",
    preferredContactMethod: "phone",
  });

  assert.equal(created.firstName, "Avery");
  assert.equal(created.lastName, "Hill");
  assert.equal(created.displayName, null);
  assert.equal(created.primaryPhone, null);
  assert.equal(created.notes, null);
  assert.equal(updated.displayName, null);
  assert.equal(updated.roleTitle, "Operations Lead");
});

test("contact form helpers validate and serialize canonical payloads", () => {
  const invalid = validateContactFormValues({
    firstName: "",
    lastName: "",
    displayName: "",
    email: "not-an-email",
    primaryPhone: "",
    secondaryPhone: "",
    roleTitle: "",
    preferredLanguage: "unknown",
    preferredContactMethod: "",
    notes: "",
    status: "active",
  });

  assert.equal(invalid.firstName, "First name is required.");
  assert.equal(invalid.lastName, "Last name is required.");
  assert.equal(invalid.email, "Enter a valid email address.");

  const payload = toContactPayload({
    firstName: " Avery ",
    lastName: " Hill ",
    displayName: "",
    email: " ",
    primaryPhone: "416-555-0100",
    secondaryPhone: "",
    roleTitle: "Operations Manager",
    preferredLanguage: "en",
    preferredContactMethod: "",
    notes: " ",
    status: "inactive",
  });

  assert.deepEqual(payload, {
    firstName: "Avery",
    lastName: "Hill",
    displayName: null,
    email: null,
    primaryPhone: "416-555-0100",
    secondaryPhone: null,
    roleTitle: "Operations Manager",
    preferredLanguage: "en",
    preferredContactMethod: null,
    notes: null,
    status: "inactive",
  });
});

test("contact list helpers keep derived display names clean and searchable", () => {
  const contact = makeContact({
    firstName: "Jordan",
    lastName: "Lee",
    displayName: "Jordan Lee",
    status: "inactive",
  });

  assert.equal(mapContactToFormValues(toContactDetail(contact)).displayName, "");

  const filtered = filterContacts(
    [
      toContactSummary(contact),
      toContactSummary(
        makeContact({
        id: "contact-2",
        firstName: "Avery",
        lastName: "Hill",
        roleTitle: "Operations Manager",
        status: "active",
        }),
      ),
    ],
    { search: "operations", status: "active" },
  );

  assert.deepEqual(filtered.map((item) => item.id), ["contact-2"]);
});

test("contact service updates preserve canonical detail fields for edit flows", async () => {
  const actor = makeOwnerActor();
  const contact = makeContact({
    id: "contact-1",
    firstName: "Avery",
    lastName: "Hill",
    displayName: "Avery Hill",
    preferredContactMethod: "email",
  });
  const harness = createPhaseTwoServiceHarness({ contacts: [contact] });
  const service = createContactService({
    contacts: harness.repositories.contacts,
    clientOrganizationContactLinks: harness.repositories.clientOrganizationContactLinks,
    locationContactLinks: harness.repositories.locationContactLinks,
    contractorContactLinks: {
      newId() {
        return "contractor-contact-link-1";
      },
      async getById() {
        return null;
      },
      async create(entity) {
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        return { id: entity.id, item: entity };
      },
      async listByContractorId() {
        return { items: [], count: 0 };
      },
      async replaceForContractorId() {
        return;
      },
    } satisfies FirestoreRepositories["contractorContactLinks"],
  });

  const result = await service.updateContact({
    ...makeAuditContext(actor),
    contactId: contact.id,
    firstName: "Avery",
    lastName: "Hill",
    displayName: null,
    secondaryPhone: "416-555-0101",
    preferredContactMethod: "phone",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const detail = toContactDetail(result.value);
  assert.equal(detail.displayName, "Avery Hill");
  assert.equal(detail.secondaryPhone, "416-555-0101");
  assert.equal(detail.preferredContactMethod, "phone");
});
