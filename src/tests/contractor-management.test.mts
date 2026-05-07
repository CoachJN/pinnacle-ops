import assert from "node:assert/strict";
import test from "node:test";

import { filterContractors } from "../modules/contractors/domain/filter-contractors.ts";
import { isContractorAssignable } from "../modules/contractors/domain/is-contractor-assignable.ts";
import {
  createContractorSchema,
  updateContractorSchema,
} from "../modules/contractors/domain/schemas.ts";
import { createContractorService } from "../server/services/contractor-service.ts";
import type {
  Contact,
  ContractorContactLink,
  ContractorOrganization,
  FirestoreRepositories,
  RepositoryListOptions,
  RepositoryListResult,
  WorkOrder,
} from "../server/repositories/index.ts";
import { makeAuditContext, makeOwnerActor } from "./support/phase-two-fixtures.ts";
import type { EntityId } from "../types/entity.ts";

test("create contractor validation requires core fields and normalizes arrays", () => {
  const contractor = createContractorSchema.parse({
    legalName: "Blue Arc Electrical",
    displayName: "Blue Arc Electrical",
    parentContractorId: "contractor-parent-1",
    businessEmail: "ops@bluearc.example",
    mainPhone: "416-555-0311",
    altPhone: "416-555-0312",
    fax: "416-555-0313",
    primaryContactId: "contact-primary-1",
    billingContactId: "contact-billing-1",
    dispatchContactId: "contact-dispatch-1",
    status: "onboarding",
    trades: ["electrical", "other"],
    isAssignable: false,
    serviceArea: "Toronto Core",
    notes: "Awaiting insurance documents.",
  });

  assert.equal(contractor.legalName, "Blue Arc Electrical");
  assert.equal(contractor.parentContractorId, "contractor-parent-1");
  assert.equal(contractor.status, "onboarding");
  assert.equal(contractor.isAssignable, false);
  assert.equal(contractor.primaryContactId, "contact-primary-1");
  assert.equal(contractor.serviceArea, "Toronto Core");
  assert.deepEqual(contractor.trades, ["electrical", "other"]);

  assert.throws(
    () =>
      createContractorSchema.parse({
        legalName: "",
        displayName: null,
        businessEmail: "invalid",
        mainPhone: "",
        status: "active",
        trades: [],
        notes: null,
      }),
    /legal name|email|phone/i,
  );
});

test("update contractor validation accepts partial changes", () => {
  const payload = updateContractorSchema.parse({
    parentContractorId: "contractor-parent-2",
    status: "suspended",
    isAssignable: false,
    trades: ["hvac"],
    serviceArea: "Toronto West",
  });

  assert.equal(payload.parentContractorId, "contractor-parent-2");
  assert.equal(payload.status, "suspended");
  assert.equal(payload.isAssignable, false);
  assert.deepEqual(payload.trades, ["hvac"]);
  assert.equal(payload.serviceArea, "Toronto West");
});

test("contractor filtering matches status and search terms", () => {
  const contractors = [
    {
      legalName: "North Peak Mechanical",
      displayName: "North Peak Mechanical",
      businessEmail: "dispatch@northpeak.example",
      mainPhone: "416-555-0208",
      status: "active" as const,
      trades: ["hvac"],
      serviceArea: "Toronto",
    },
    {
      legalName: "Harbour Plumbing",
      displayName: "Harbour Plumbing",
      businessEmail: "hello@harbourplumbing.example",
      mainPhone: "416-555-0209",
      status: "suspended" as const,
      trades: ["plumbing"],
      serviceArea: "Hamilton",
    },
    {
      legalName: "Elevate Doors",
      displayName: "Elevate Doors",
      businessEmail: "ops@elevatedoors.example",
      mainPhone: "416-555-0210",
      status: "onboarding" as const,
      trades: ["access_control"],
      serviceArea: "Toronto West",
    },
  ];

  assert.deepEqual(
    filterContractors(contractors, { status: "active" }).map(
      (contractor) => contractor.displayName,
    ),
    ["North Peak Mechanical"],
  );

  assert.deepEqual(
    filterContractors(contractors, { search: "hamilton" }).map(
      (contractor) => contractor.displayName,
    ),
    ["Harbour Plumbing"],
  );
});

test("assignment readiness requires active status and service coverage", () => {
  assert.equal(
    isContractorAssignable({
      status: "active",
      isAssignable: true,
      trades: ["HVAC"],
    }),
    true,
  );

  assert.equal(
    isContractorAssignable({
      status: "onboarding",
      isAssignable: true,
      trades: ["HVAC"],
    }),
    false,
  );

  assert.equal(
    isContractorAssignable({
      status: "active",
      isAssignable: true,
      trades: [],
    }),
    false,
  );

  assert.equal(
    isContractorAssignable({
      status: "active",
      isAssignable: false,
      trades: ["hvac"],
    }),
    false,
  );
});

test("contractor service clears linked primary contact ids when removed", async () => {
  const actor = makeOwnerActor();
  const repositories = createContractorServiceRepositories([
    makeContractorOrganization({
      id: "contractor-parent-1",
      name: "North Peak Group",
      displayName: "North Peak Group",
    }),
  ]);
  const service = createContractorService(repositories);

  const created = await service.createContractorOrganization({
    ...makeAuditContext(actor),
    name: "North Peak Mechanical",
    parentContractorId: "contractor-parent-1",
    primaryContactId: "contact-avery-hill",
    status: "active",
    trades: ["hvac"],
  });

  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  assert.equal(created.value.parentContractorId, "contractor-parent-1");

  let links = await repositories.contractorContactLinks.listByContractorId(
    created.value.id,
  );
  assert.equal(links.count, 1);
  assert.equal(links.items[0]?.relationshipType, "primary");
  assert.equal(links.items[0]?.contactId, "contact-avery-hill");

  const updated = await service.updateContractorOrganization({
    ...makeAuditContext(actor),
    contractorOrganizationId: created.value.id,
    parentContractorId: null,
    primaryContactId: null,
    linkedContacts: [],
  });

  assert.equal(updated.ok, true);
  if (!updated.ok) {
    return;
  }

  assert.equal(updated.value.parentContractorId, null);
  assert.equal(updated.value.primaryContactId, null);

  links = await repositories.contractorContactLinks.listByContractorId(
    created.value.id,
  );
  assert.equal(links.count, 0);
});

test("contractor service links and unlinks additional contacts while keeping dispatch roles valid", async () => {
  const actor = makeOwnerActor();
  const repositories = createContractorServiceRepositories();
  const service = createContractorService(repositories);

  const created = await service.createContractorOrganization({
    ...makeAuditContext(actor),
    name: "Blue Arc Electrical",
    dispatchContactId: "contact-jordan-lee",
    linkedContacts: [
      {
        contactId: "contact-avery-hill",
        relationshipType: "accounting",
      },
    ],
    status: "active",
    trades: ["electrical"],
  });

  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  let links = await repositories.contractorContactLinks.listByContractorId(
    created.value.id,
  );
  assert.equal(links.count, 2);

  const updated = await service.updateContractorOrganization({
    ...makeAuditContext(actor),
    contractorOrganizationId: created.value.id,
    dispatchContactId: "contact-jordan-lee",
    linkedContacts: [],
  });

  assert.equal(updated.ok, true);
  if (!updated.ok) {
    return;
  }

  links = await repositories.contractorContactLinks.listByContractorId(
    created.value.id,
  );
  assert.equal(links.count, 1);
  assert.equal(links.items[0]?.contactId, "contact-jordan-lee");
  assert.equal(updated.value.dispatchContactId, "contact-jordan-lee");
});

function createContractorServiceRepositories(
  contractors: ContractorOrganization[] = [],
): Pick<
  FirestoreRepositories,
  "contacts" | "contractorContactLinks" | "contractorOrganizations" | "workOrders"
> {
  const store = new Map<EntityId, ContractorOrganization>(
    contractors.map((contractor) => [contractor.id, contractor]),
  );
  const contacts = new Map<EntityId, Contact>([
    [
      "contact-avery-hill",
      {
        id: "contact-avery-hill",
        organizationId: "org-1",
        recordStatus: "active",
        isDeleted: false,
        createdAt: "2026-04-13T12:00:00.000Z",
        updatedAt: "2026-04-13T12:00:00.000Z",
        createdByUserId: "owner-1",
        updatedByUserId: "owner-1",
        deletedAt: null,
        deletedByUserId: null,
        firstName: "Avery",
        lastName: "Hill",
        displayName: "Avery Hill",
        email: "avery.hill@example.com",
        primaryPhone: "416-555-0101",
        secondaryPhone: null,
        roleTitle: "Operations Manager",
        preferredLanguage: "en",
        preferredContactMethod: "email",
        notes: null,
        status: "active",
      },
    ],
    [
      "contact-jordan-lee",
      {
        id: "contact-jordan-lee",
        organizationId: "org-1",
        recordStatus: "active",
        isDeleted: false,
        createdAt: "2026-04-13T12:00:00.000Z",
        updatedAt: "2026-04-13T12:00:00.000Z",
        createdByUserId: "owner-1",
        updatedByUserId: "owner-1",
        deletedAt: null,
        deletedByUserId: null,
        firstName: "Jordan",
        lastName: "Lee",
        displayName: "Jordan Lee",
        email: "jordan.lee@example.com",
        primaryPhone: "416-555-0102",
        secondaryPhone: null,
        roleTitle: "Dispatcher",
        preferredLanguage: "en",
        preferredContactMethod: "email",
        notes: null,
        status: "active",
      },
    ],
  ]);
  const contractorContactLinks = new Map<EntityId, ContractorContactLink>();

  return {
    contacts: {
      newId() {
        return `contact-${contacts.size + 1}`;
      },
      async getById(id) {
        return contacts.get(id) ?? null;
      },
      async create(entity) {
        contacts.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        contacts.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async listByOrganizationId(organizationId, options) {
        const items = [...contacts.values()]
          .filter((item) => item.organizationId === organizationId)
          .slice(0, options?.limit);
        return { items, count: items.length };
      },
      async listByIds(contactIds) {
        const items = contactIds
          .map((contactId) => contacts.get(contactId))
          .filter((contact): contact is Contact => Boolean(contact));
        return { items, count: items.length };
      },
    },
    contractorOrganizations: {
      newId() {
        return `contractor-${store.size + 1}`;
      },
      async getById(id) {
        return store.get(id) ?? null;
      },
      async create(entity) {
        store.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        store.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async listByOrganizationId(
        organizationId,
        options?: RepositoryListOptions,
      ): Promise<RepositoryListResult<ContractorOrganization>> {
        return listStoredContractors(store, organizationId, options);
      },
      async listActive(
        options?: RepositoryListOptions,
      ): Promise<RepositoryListResult<ContractorOrganization>> {
        const items = [...store.values()]
          .filter(
            (item) =>
              item.recordStatus === "active" &&
              item.status === "active" &&
              !item.isDeleted,
          )
          .slice(0, options?.limit);
        return {
          items,
          count: items.length,
        };
      },
    },
    contractorContactLinks: {
      newId() {
        return `contractor-link-${contractorContactLinks.size + 1}`;
      },
      async getById(id) {
        return contractorContactLinks.get(id) ?? null;
      },
      async create(entity) {
        contractorContactLinks.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        contractorContactLinks.set(entity.id, entity);
        return { id: entity.id, item: entity };
      },
      async listByContractorId(contractorId) {
        const items = [...contractorContactLinks.values()].filter(
          (item) => item.contractorId === contractorId,
        );
        return { items, count: items.length };
      },
      async replaceForContractorId(contractorId, links) {
        for (const [id, link] of contractorContactLinks.entries()) {
          if (link.contractorId === contractorId) {
            contractorContactLinks.delete(id);
          }
        }

        for (const link of links) {
          contractorContactLinks.set(link.id, link);
        }
      },
    },
    workOrders: {
      async listByContractorOrganizationId(
        _contractorOrganizationId: EntityId,
        _options?: RepositoryListOptions,
      ): Promise<RepositoryListResult<WorkOrder>> {
        return {
          items: [],
          count: 0,
        };
      },
    } as FirestoreRepositories["workOrders"],
  };
}

function listStoredContractors(
  store: Map<EntityId, ContractorOrganization>,
  organizationId: EntityId,
  options?: RepositoryListOptions,
): RepositoryListResult<ContractorOrganization> {
  const items = [...store.values()]
    .filter((item) => item.organizationId === organizationId)
    .slice(0, options?.limit);

  return {
    items,
    count: items.length,
  };
}

function makeContractorOrganization(
  overrides: Partial<ContractorOrganization> = {},
): ContractorOrganization {
  return {
    id: "contractor-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-13T12:00:00.000Z",
    updatedAt: "2026-04-13T12:00:00.000Z",
    createdByUserId: "owner-1",
    updatedByUserId: "owner-1",
    deletedAt: null,
    deletedByUserId: null,
    name: "North Peak Mechanical",
    displayName: "North Peak Mechanical",
    parentContractorId: null,
    status: "active",
    isAssignable: true,
    primaryContactId: null,
    billingContactId: null,
    dispatchContactId: null,
    businessEmail: null,
    mainPhone: null,
    altPhone: null,
    fax: null,
    trades: ["hvac"],
    serviceArea: null,
    notes: null,
    ...overrides,
  };
}
