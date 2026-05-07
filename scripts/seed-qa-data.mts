import fs from "node:fs";
import path from "node:path";

import { Timestamp, type Firestore } from "firebase-admin/firestore";

import type {
  ClientOrganization,
  ClientOrganizationContactLink,
  Contact,
  ContractorOrganization,
  ContractorContactLink,
  FirestoreRepositories,
  Location,
  LocationContactLink,
} from "@/server/repositories";
import type { WorkOrder } from "@/modules/work-orders";

const now = new Date().toISOString();
const isDryRun = process.argv.includes("--dry-run");
const tenantTag = "qa-seed-2026-04";

interface SeedContext {
  organizationId: string;
  actorUserId: string;
}

interface SeedSummary {
  contacts: string[];
  clients: string[];
  locations: string[];
  contractors: string[];
  workOrders: string[];
}

async function main() {
  loadLocalEnvFile();
  const [{ getFirebaseAdminFirestore }, { createFirestoreRepositories }] =
    await Promise.all([
      import("@/server/firebase"),
      import("@/server/repositories"),
    ]);

  const context: SeedContext = {
    organizationId: readEnv("QA_SEED_ORGANIZATION_ID", "org-1"),
    actorUserId: readEnv("QA_SEED_ACTOR_USER_ID", "qa-seed-bot"),
  };
  const firestore = getFirebaseAdminFirestore();
  const repositories = createFirestoreRepositories(firestore);

  const summary: SeedSummary = {
    contacts: [],
    clients: [],
    locations: [],
    contractors: [],
    workOrders: [],
  };

  const contacts = buildContacts(context);
  for (const contact of contacts) {
    await upsertContact(repositories, contact);
    summary.contacts.push(contact.id);
  }

  const clients = buildClients(context);
  for (const client of clients) {
    await upsertClient(repositories, client);
    summary.clients.push(client.id);
  }

  const locations = buildLocations(context);
  for (const location of locations) {
    await upsertLocation(repositories, location);
    summary.locations.push(location.id);
  }

  const contractors = buildContractors(context);
  for (const contractor of contractors) {
    await upsertContractor(repositories, contractor);
    summary.contractors.push(contractor.id);
  }

  await replaceClientContactLinks(repositories, buildClientContactLinks(context));
  await replaceLocationContactLinks(repositories, buildLocationContactLinks(context));
  await replaceContractorContactLinks(
    repositories,
    buildContractorContactLinks(context),
  );

  const workOrders = buildWorkOrders(context);
  for (const workOrder of workOrders) {
    await upsertWorkOrder(firestore, context, workOrder);
    summary.workOrders.push(workOrder.id);
  }

  printSummary(summary, context);
}

function buildContacts(context: SeedContext): Contact[] {
  return [
    buildContact(context, {
      id: "contact-qa-northstar-ops",
      firstName: "Nora",
      lastName: "Ops",
      email: "nora.ops@northstar-qa.example.com",
      primaryPhone: "416-555-0201",
      roleTitle: "Operations Manager",
    }),
    buildContact(context, {
      id: "contact-qa-northstar-billing",
      firstName: "Brianna",
      lastName: "Billing",
      email: "brianna.billing@northstar-qa.example.com",
      primaryPhone: "416-555-0202",
      roleTitle: "Billing Lead",
    }),
    buildContact(context, {
      id: "contact-qa-harbor-ops",
      firstName: "Harvey",
      lastName: "Operations",
      email: "harvey.ops@harbor-qa.example.com",
      primaryPhone: "416-555-0203",
      roleTitle: "Site Operations",
    }),
    buildContact(context, {
      id: "contact-qa-harbor-billing",
      firstName: "Bianca",
      lastName: "Harbor",
      email: "bianca.billing@harbor-qa.example.com",
      primaryPhone: "416-555-0204",
      roleTitle: "Accounts Payable",
    }),
    buildContact(context, {
      id: "contact-qa-summit-dispatch",
      firstName: "Sam",
      lastName: "Dispatch",
      email: "dispatch@summit-qa.example.com",
      primaryPhone: "416-555-0205",
      roleTitle: "Dispatch Coordinator",
    }),
    buildContact(context, {
      id: "contact-qa-summit-billing",
      firstName: "Paula",
      lastName: "Summit",
      email: "billing@summit-qa.example.com",
      primaryPhone: "416-555-0206",
      roleTitle: "Billing Coordinator",
    }),
  ];
}

function buildContact(
  context: SeedContext,
  input: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    primaryPhone: string;
    roleTitle: string;
  },
): Contact {
  return {
    id: input.id,
    organizationId: context.organizationId,
    recordStatus: "active",
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    createdByUserId: context.actorUserId,
    updatedByUserId: context.actorUserId,
    deletedAt: null,
    deletedByUserId: null,
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: `${input.firstName} ${input.lastName}`,
    email: input.email,
    primaryPhone: input.primaryPhone,
    secondaryPhone: null,
    roleTitle: input.roleTitle,
    preferredLanguage: "en",
    preferredContactMethod: "email",
    notes: `Seeded by ${tenantTag} for manual QA.`,
    status: "active",
  };
}

function buildClients(context: SeedContext): ClientOrganization[] {
  return [
    {
      id: "client-qa-northstar",
      organizationId: context.organizationId,
      recordStatus: "active",
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdByUserId: context.actorUserId,
      updatedByUserId: context.actorUserId,
      deletedAt: null,
      deletedByUserId: null,
      name: "Northstar Retail Group QA",
      displayName: "Northstar QA",
      status: "active",
      primaryContactId: "contact-qa-northstar-ops",
      billingContactId: "contact-qa-northstar-billing",
      notes: `Seeded by ${tenantTag} for manual QA.`,
    },
    {
      id: "client-qa-harbor",
      organizationId: context.organizationId,
      recordStatus: "active",
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdByUserId: context.actorUserId,
      updatedByUserId: context.actorUserId,
      deletedAt: null,
      deletedByUserId: null,
      name: "Harbor Commercial QA",
      displayName: "Harbor QA",
      status: "active",
      primaryContactId: "contact-qa-harbor-ops",
      billingContactId: "contact-qa-harbor-billing",
      notes: `Seeded by ${tenantTag} for manual QA.`,
    },
  ];
}

function buildLocations(context: SeedContext): Location[] {
  return [
    {
      id: "loc-qa-northstar-tower",
      organizationId: context.organizationId,
      recordStatus: "active",
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdByUserId: context.actorUserId,
      updatedByUserId: context.actorUserId,
      deletedAt: null,
      deletedByUserId: null,
      clientOrganizationId: "client-qa-northstar",
      name: "Northstar Tower QA",
      displayName: "Northstar Tower QA",
      code: "NST-QA-01",
      storeNumber: "QA-101",
      status: "active",
      primaryContactId: "contact-qa-northstar-ops",
      siteContactId: "contact-qa-northstar-ops",
      addressLine1: "100 King Street West",
      addressLine2: "Suite 1100",
      city: "Toronto",
      region: "ON",
      postalCode: "M5X 1A9",
      countryCode: "CA",
      latitude: null,
      longitude: null,
      timeZone: "America/Toronto",
      accessNotes:
        "QA seed location for coordinator, client portal, and finance checks.",
      serviceNotes: null,
      notes: `Seeded by ${tenantTag} for manual QA.`,
    },
    {
      id: "loc-qa-harbor-plaza",
      organizationId: context.organizationId,
      recordStatus: "active",
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdByUserId: context.actorUserId,
      updatedByUserId: context.actorUserId,
      deletedAt: null,
      deletedByUserId: null,
      clientOrganizationId: "client-qa-harbor",
      name: "Harbor Plaza QA",
      displayName: "Harbor Plaza QA",
      code: "HBR-QA-01",
      storeNumber: "QA-202",
      status: "active",
      primaryContactId: "contact-qa-harbor-ops",
      siteContactId: "contact-qa-harbor-ops",
      addressLine1: "250 Lakeshore Boulevard East",
      addressLine2: null,
      city: "Toronto",
      region: "ON",
      postalCode: "M5A 1B6",
      countryCode: "CA",
      latitude: null,
      longitude: null,
      timeZone: "America/Toronto",
      accessNotes: "QA seed location for quote-required scenarios.",
      serviceNotes: null,
      notes: `Seeded by ${tenantTag} for manual QA.`,
    },
  ];
}

function buildContractors(context: SeedContext): ContractorOrganization[] {
  return [
    {
      id: "contractor-qa-summit-mechanical",
      organizationId: context.organizationId,
      recordStatus: "active",
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdByUserId: context.actorUserId,
      updatedByUserId: context.actorUserId,
      deletedAt: null,
      deletedByUserId: null,
      name: "Summit Mechanical QA",
      displayName: "Summit Mechanical QA",
      parentContractorId: null,
      status: "active",
      isAssignable: true,
      primaryContactId: "contact-qa-summit-dispatch",
      billingContactId: "contact-qa-summit-billing",
      dispatchContactId: "contact-qa-summit-dispatch",
      businessEmail: "qa-summit@example.com",
      mainPhone: "416-555-0101",
      altPhone: null,
      fax: null,
      trades: ["HVAC", "PLUMBING"],
      serviceArea: "Greater Toronto Area",
      ratingSummary: null,
      addressLine1: "12 Service Road",
      addressLine2: null,
      city: "Toronto",
      region: "ON",
      postalCode: "M4B 1B3",
      countryCode: "CA",
      notes: `Primary valid QA contractor. Seeded by ${tenantTag}.`,
    },
    {
      id: "contractor-qa-nightwatch-electric",
      organizationId: context.organizationId,
      recordStatus: "active",
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdByUserId: context.actorUserId,
      updatedByUserId: context.actorUserId,
      deletedAt: null,
      deletedByUserId: null,
      name: "Nightwatch Electric QA",
      displayName: "Nightwatch Electric QA",
      parentContractorId: null,
      status: "active",
      isAssignable: true,
      primaryContactId: "contact-qa-summit-dispatch",
      billingContactId: "contact-qa-summit-billing",
      dispatchContactId: "contact-qa-summit-dispatch",
      businessEmail: "qa-nightwatch@example.com",
      mainPhone: "416-555-0102",
      altPhone: null,
      fax: null,
      trades: ["ELECTRICAL"],
      serviceArea: "Greater Toronto Area",
      ratingSummary: null,
      addressLine1: "24 Circuit Avenue",
      addressLine2: null,
      city: "Toronto",
      region: "ON",
      postalCode: "M5V 2T6",
      countryCode: "CA",
      notes: `Mismatched-trade QA contractor. Seeded by ${tenantTag}.`,
    },
    {
      id: "contractor-qa-inactive-facilities",
      organizationId: context.organizationId,
      recordStatus: "active",
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdByUserId: context.actorUserId,
      updatedByUserId: context.actorUserId,
      deletedAt: null,
      deletedByUserId: null,
      name: "Inactive Facilities QA",
      displayName: "Inactive Facilities QA",
      parentContractorId: null,
      status: "inactive",
      isAssignable: true,
      primaryContactId: "contact-qa-summit-dispatch",
      billingContactId: "contact-qa-summit-billing",
      dispatchContactId: "contact-qa-summit-dispatch",
      businessEmail: "qa-inactive@example.com",
      mainPhone: "416-555-0103",
      altPhone: null,
      fax: null,
      trades: ["HVAC"],
      serviceArea: "Greater Toronto Area",
      ratingSummary: null,
      addressLine1: "36 Dormant Street",
      addressLine2: null,
      city: "Toronto",
      region: "ON",
      postalCode: "M6J 1A1",
      countryCode: "CA",
      notes: `Inactive QA contractor. Seeded by ${tenantTag}.`,
    },
    {
      id: "contractor-qa-backoffice-cleaning",
      organizationId: context.organizationId,
      recordStatus: "active",
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdByUserId: context.actorUserId,
      updatedByUserId: context.actorUserId,
      deletedAt: null,
      deletedByUserId: null,
      name: "Backoffice Cleaning QA",
      displayName: "Backoffice Cleaning QA",
      parentContractorId: null,
      status: "active",
      isAssignable: false,
      primaryContactId: "contact-qa-summit-dispatch",
      billingContactId: "contact-qa-summit-billing",
      dispatchContactId: "contact-qa-summit-dispatch",
      businessEmail: "qa-backoffice@example.com",
      mainPhone: "416-555-0104",
      altPhone: null,
      fax: null,
      trades: ["CLEANING"],
      serviceArea: "Greater Toronto Area",
      ratingSummary: null,
      addressLine1: "48 Admin Park",
      addressLine2: null,
      city: "Toronto",
      region: "ON",
      postalCode: "M5H 2N2",
      countryCode: "CA",
      notes: `Non-assignable QA contractor. Seeded by ${tenantTag}.`,
    },
  ];
}

function buildWorkOrders(context: SeedContext): WorkOrder[] {
  return [
    buildQaWorkOrder({
      actorUserId: context.actorUserId,
      id: "wo-qa-a-no-quote",
      workOrderNumber: "WO-QA-A",
      title: "WO-A No Quote QA Flow",
      description:
        "QA seed work order for the standard no-quote lifecycle. Use this for coordinator, manager, contractor, and finance walkthroughs.",
      clientOrganizationId: "client-qa-northstar",
      locationId: "loc-qa-northstar-tower",
      requestedByContactId: "contact-qa-northstar-ops",
      siteContactId: "contact-qa-northstar-ops",
      priority: "MEDIUM",
      category: "HVAC",
      requestedByName: "QA Coordinator",
      requestedByEmail: "qa-coordinator@example.com",
      requestedByPhone: "416-555-0110",
      requestedServiceDate: "2026-04-20T13:00:00.000Z",
      dueDate: "2026-04-22T21:00:00.000Z",
      requiresQuote: false,
    }),
    buildQaWorkOrder({
      actorUserId: context.actorUserId,
      id: "wo-qa-b-quote-required",
      workOrderNumber: "WO-QA-B",
      title: "WO-B Quote Required QA Flow",
      description:
        "QA seed work order for the quote-required lifecycle. Use this for contractor quote submission, client approval, and post-approval execution.",
      clientOrganizationId: "client-qa-harbor",
      locationId: "loc-qa-harbor-plaza",
      requestedByContactId: "contact-qa-harbor-ops",
      siteContactId: "contact-qa-harbor-ops",
      priority: "HIGH",
      category: "PLUMBING",
      requestedByName: "QA Manager",
      requestedByEmail: "qa-manager@example.com",
      requestedByPhone: "416-555-0111",
      requestedServiceDate: "2026-04-21T14:00:00.000Z",
      dueDate: "2026-04-24T21:00:00.000Z",
      requiresQuote: true,
      quoteRequiredThresholdCents: 150000,
    }),
    buildQaWorkOrder({
      actorUserId: context.actorUserId,
      id: "wo-qa-c-legacy-candidate",
      workOrderNumber: "WO-QA-C",
      title: "WO-C Legacy Candidate QA Flow",
      description:
        "QA seed work order reserved for legacy or regression checks. This record is intentionally older but remains valid and editable.",
      clientOrganizationId: "client-qa-northstar",
      locationId: "loc-qa-northstar-tower",
      requestedByContactId: "contact-qa-northstar-ops",
      siteContactId: "contact-qa-northstar-ops",
      priority: "LOW",
      category: "GENERAL_REPAIR",
      requestedByName: "QA Owner",
      requestedByEmail: "qa-owner@example.com",
      requestedByPhone: "416-555-0112",
      requestedServiceDate: "2026-04-15T13:00:00.000Z",
      dueDate: "2026-04-30T21:00:00.000Z",
      requiresQuote: false,
      createdAtOverride: "2026-03-20T15:00:00.000Z",
      updatedAtOverride: "2026-03-20T15:00:00.000Z",
    }),
    buildQaWorkOrder({
      actorUserId: context.actorUserId,
      id: "wo-qa-d-minimal",
      workOrderNumber: "WO-QA-D",
      title: "WO-D Minimal QA Flow",
      description:
        "QA seed work order with only the minimum intended fields for late-stage required field checks.",
      clientOrganizationId: "client-qa-harbor",
      locationId: "loc-qa-harbor-plaza",
      requestedByContactId: "contact-qa-harbor-ops",
      siteContactId: "contact-qa-harbor-ops",
      priority: "LOW",
      category: "OTHER",
      requestedByName: "QA Minimal",
      requiresQuote: false,
    }),
  ];
}

function buildQaWorkOrder(input: {
  actorUserId: string;
  id: string;
  workOrderNumber: string;
  title: string;
  description: string;
  clientOrganizationId: string;
  locationId: string;
  requestedByContactId: string;
  siteContactId: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  category:
    | "GENERAL_REPAIR"
    | "ELECTRICAL"
    | "PLUMBING"
    | "HVAC"
    | "CLEANING"
    | "OTHER";
  requestedByName: string;
  requestedByEmail?: string;
  requestedByPhone?: string;
  requestedServiceDate?: string;
  dueDate?: string;
  requiresQuote: boolean;
  quoteRequiredThresholdCents?: number;
  createdAtOverride?: string;
  updatedAtOverride?: string;
}): WorkOrder {
  const createdAt = input.createdAtOverride ?? now;
  const requestedByEmail = input.requestedByEmail ?? null;
  const requestedByPhone = input.requestedByPhone ?? null;
  const searchText = [
    input.workOrderNumber,
    input.title,
    input.description,
    input.requestedByName,
    requestedByEmail,
    requestedByPhone,
    input.clientOrganizationId,
    input.locationId,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return {
    id: input.id,
    workOrderNumber: input.workOrderNumber,
    title: input.title,
    description: input.description,
    clientOrganizationId: input.clientOrganizationId,
    locationId: input.locationId,
    requestedByContactId: input.requestedByContactId,
    siteContactId: input.siteContactId,
    assignedContractorId: null,
    status: "new",
    priority: input.priority,
    category: input.category,
    requestedServiceDate: input.requestedServiceDate ?? null,
    requiresQuote: input.requiresQuote,
    quoteRequiredThresholdCents: input.quoteRequiredThresholdCents ?? null,
    requestedByName: input.requestedByName,
    requestedByEmail,
    requestedByPhone,
    source: "MANUAL",
    createdByUserId: input.actorUserId,
    coordinatorUserId: null,
    managerUserId: null,
    dueDate: input.dueDate ?? null,
    createdAt,
    updatedAt: input.updatedAtOverride ?? now,
    closedAt: null,
    isArchived: false,
    searchText,
  };
}

function buildClientContactLinks(
  context: SeedContext,
): ClientOrganizationContactLink[] {
  return [
    buildClientContactLink(context, {
      id: "link-client-qa-northstar-primary",
      clientOrganizationId: "client-qa-northstar",
      contactId: "contact-qa-northstar-ops",
      relationshipType: "primary",
      isPrimary: true,
    }),
    buildClientContactLink(context, {
      id: "link-client-qa-northstar-billing",
      clientOrganizationId: "client-qa-northstar",
      contactId: "contact-qa-northstar-billing",
      relationshipType: "billing",
      isPrimary: false,
    }),
    buildClientContactLink(context, {
      id: "link-client-qa-harbor-primary",
      clientOrganizationId: "client-qa-harbor",
      contactId: "contact-qa-harbor-ops",
      relationshipType: "primary",
      isPrimary: true,
    }),
    buildClientContactLink(context, {
      id: "link-client-qa-harbor-billing",
      clientOrganizationId: "client-qa-harbor",
      contactId: "contact-qa-harbor-billing",
      relationshipType: "billing",
      isPrimary: false,
    }),
  ];
}

function buildLocationContactLinks(context: SeedContext): LocationContactLink[] {
  return [
    buildLocationContactLink(context, {
      id: "link-location-qa-northstar-site",
      locationId: "loc-qa-northstar-tower",
      contactId: "contact-qa-northstar-ops",
      relationshipType: "site",
      isPrimary: true,
    }),
    buildLocationContactLink(context, {
      id: "link-location-qa-harbor-site",
      locationId: "loc-qa-harbor-plaza",
      contactId: "contact-qa-harbor-ops",
      relationshipType: "site",
      isPrimary: true,
    }),
  ];
}

function buildContractorContactLinks(
  context: SeedContext,
): ContractorContactLink[] {
  return [
    buildContractorContactLink(context, {
      id: "link-contractor-qa-summit-dispatch",
      contractorId: "contractor-qa-summit-mechanical",
      contactId: "contact-qa-summit-dispatch",
      relationshipType: "dispatch",
      isPrimary: true,
    }),
    buildContractorContactLink(context, {
      id: "link-contractor-qa-summit-billing",
      contractorId: "contractor-qa-summit-mechanical",
      contactId: "contact-qa-summit-billing",
      relationshipType: "billing",
      isPrimary: false,
    }),
  ];
}

function buildClientContactLink(
  context: SeedContext,
  input: {
    id: string;
    clientOrganizationId: string;
    contactId: string;
    relationshipType: ClientOrganizationContactLink["relationshipType"];
    isPrimary: boolean;
  },
): ClientOrganizationContactLink {
  return {
    id: input.id,
    organizationId: context.organizationId,
    recordStatus: "active",
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    createdByUserId: context.actorUserId,
    updatedByUserId: context.actorUserId,
    deletedAt: null,
    deletedByUserId: null,
    clientOrganizationId: input.clientOrganizationId,
    contactId: input.contactId,
    relationshipType: input.relationshipType,
    isPrimary: input.isPrimary,
    notes: `Seeded by ${tenantTag} for manual QA.`,
  };
}

function buildLocationContactLink(
  context: SeedContext,
  input: {
    id: string;
    locationId: string;
    contactId: string;
    relationshipType: LocationContactLink["relationshipType"];
    isPrimary: boolean;
  },
): LocationContactLink {
  return {
    id: input.id,
    organizationId: context.organizationId,
    recordStatus: "active",
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    createdByUserId: context.actorUserId,
    updatedByUserId: context.actorUserId,
    deletedAt: null,
    deletedByUserId: null,
    locationId: input.locationId,
    contactId: input.contactId,
    relationshipType: input.relationshipType,
    isPrimary: input.isPrimary,
    notes: `Seeded by ${tenantTag} for manual QA.`,
  };
}

function buildContractorContactLink(
  context: SeedContext,
  input: {
    id: string;
    contractorId: string;
    contactId: string;
    relationshipType: ContractorContactLink["relationshipType"];
    isPrimary: boolean;
  },
): ContractorContactLink {
  return {
    id: input.id,
    organizationId: context.organizationId,
    recordStatus: "active",
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    createdByUserId: context.actorUserId,
    updatedByUserId: context.actorUserId,
    deletedAt: null,
    deletedByUserId: null,
    contractorId: input.contractorId,
    contactId: input.contactId,
    relationshipType: input.relationshipType,
    isPrimary: input.isPrimary,
    notes: `Seeded by ${tenantTag} for manual QA.`,
  };
}

async function upsertClient(
  repositories: FirestoreRepositories,
  client: ClientOrganization,
) {
  if (isDryRun) {
    return;
  }

  await repositories.clientOrganizations.save(client);
}

async function upsertContact(
  repositories: FirestoreRepositories,
  contact: Contact,
) {
  if (isDryRun) {
    return;
  }

  await repositories.contacts.save(contact);
}

async function upsertLocation(
  repositories: FirestoreRepositories,
  location: Location,
) {
  if (isDryRun) {
    return;
  }

  await repositories.locations.save(location);
}

async function upsertContractor(
  repositories: FirestoreRepositories,
  contractor: ContractorOrganization,
) {
  if (isDryRun) {
    return;
  }

  await repositories.contractorOrganizations.save(contractor);
}

async function replaceClientContactLinks(
  repositories: FirestoreRepositories,
  links: readonly ClientOrganizationContactLink[],
) {
  if (isDryRun) {
    return;
  }

  const byClient = new Map<string, ClientOrganizationContactLink[]>();
  for (const link of links) {
    const current = byClient.get(link.clientOrganizationId) ?? [];
    current.push(link);
    byClient.set(link.clientOrganizationId, current);
  }

  for (const [clientOrganizationId, clientLinks] of byClient.entries()) {
    await repositories.clientOrganizationContactLinks.replaceForClientOrganizationId(
      clientOrganizationId,
      clientLinks,
    );
  }
}

async function replaceLocationContactLinks(
  repositories: FirestoreRepositories,
  links: readonly LocationContactLink[],
) {
  if (isDryRun) {
    return;
  }

  const byLocation = new Map<string, LocationContactLink[]>();
  for (const link of links) {
    const current = byLocation.get(link.locationId) ?? [];
    current.push(link);
    byLocation.set(link.locationId, current);
  }

  for (const [locationId, locationLinks] of byLocation.entries()) {
    await repositories.locationContactLinks.replaceForLocationId(
      locationId,
      locationLinks,
    );
  }
}

async function replaceContractorContactLinks(
  repositories: FirestoreRepositories,
  links: readonly ContractorContactLink[],
) {
  if (isDryRun) {
    return;
  }

  const byContractor = new Map<string, ContractorContactLink[]>();
  for (const link of links) {
    const current = byContractor.get(link.contractorId) ?? [];
    current.push(link);
    byContractor.set(link.contractorId, current);
  }

  for (const [contractorId, contractorLinks] of byContractor.entries()) {
    await repositories.contractorContactLinks.replaceForContractorId(
      contractorId,
      contractorLinks,
    );
  }
}

async function upsertWorkOrder(
  firestore: Firestore,
  context: SeedContext,
  workOrder: WorkOrder,
) {
  if (isDryRun) {
    return;
  }

  const locationAddress =
    workOrder.locationId === "loc-qa-northstar-tower"
      ? "100 King Street West, Suite 1100, Toronto, ON"
      : "250 Lakeshore Boulevard East, Toronto, ON";

  const legacyCompatibleFields = {
    organizationId: context.organizationId,
    recordStatus: "active",
    isDeleted: false,
    createdAt: Timestamp.fromDate(new Date(workOrder.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(workOrder.updatedAt)),
    createdByUserId: context.actorUserId,
    updatedByUserId: context.actorUserId,
    deletedAt: null,
    deletedByUserId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    clientSnapshot: {
      id: workOrder.clientOrganizationId,
      name:
        workOrder.clientOrganizationId === "client-qa-northstar"
          ? "Northstar QA"
          : "Harbor QA",
    },
    locationSnapshot: {
      id: workOrder.locationId,
      name:
        workOrder.locationId === "loc-qa-northstar-tower"
          ? "Northstar Tower QA"
          : "Harbor Plaza QA",
      addressText: locationAddress,
    },
    contractorSnapshot: null,
    submittedAt: null,
    approvedAt: null,
    completedAt: null,
  };

  await firestore
    .collection("workOrders")
    .doc(workOrder.id)
    .set(
      {
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        description: workOrder.description,
        clientOrganizationId: workOrder.clientOrganizationId,
        locationId: workOrder.locationId,
        requestedByContactId: workOrder.requestedByContactId ?? null,
        siteContactId: workOrder.siteContactId ?? null,
        assignedContractorId: workOrder.assignedContractorId ?? null,
        status: workOrder.status,
        priority: workOrder.priority,
        category: workOrder.category,
        requestedServiceDate: workOrder.requestedServiceDate
          ? Timestamp.fromDate(new Date(workOrder.requestedServiceDate))
          : null,
        requiresQuote: workOrder.requiresQuote ?? false,
        quoteRequiredThresholdCents:
          workOrder.quoteRequiredThresholdCents ?? null,
        requestedByName: workOrder.requestedByName,
        requestedByEmail: workOrder.requestedByEmail ?? null,
        requestedByPhone: workOrder.requestedByPhone ?? null,
        source: workOrder.source,
        coordinatorUserId: workOrder.coordinatorUserId ?? null,
        managerUserId: workOrder.managerUserId ?? null,
        dueDate: workOrder.dueDate
          ? Timestamp.fromDate(new Date(workOrder.dueDate))
          : null,
        closedAt: workOrder.closedAt
          ? Timestamp.fromDate(new Date(workOrder.closedAt))
          : null,
        isArchived: workOrder.isArchived ?? false,
        searchText: workOrder.searchText,
        ...legacyCompatibleFields,
      },
      { merge: true },
    );
}

function printSummary(summary: SeedSummary, context: SeedContext) {
  console.log("");
  console.log(isDryRun ? "QA seed dry run complete." : "QA seed complete.");
  console.log(`Organization: ${context.organizationId}`);
  console.log(`Actor: ${context.actorUserId}`);
  console.log("");
  console.log(`Contacts: ${summary.contacts.join(", ")}`);
  console.log(`Clients: ${summary.clients.join(", ")}`);
  console.log(`Locations: ${summary.locations.join(", ")}`);
  console.log(`Contractors: ${summary.contractors.join(", ")}`);
  console.log(`Work orders: ${summary.workOrders.join(", ")}`);
  console.log("");
  console.log("Fixture mapping:");
  console.log("  WO-A -> wo-qa-a-no-quote");
  console.log("  WO-B -> wo-qa-b-quote-required");
  console.log("  WO-C -> wo-qa-c-legacy-candidate");
  console.log("  WO-D -> wo-qa-d-minimal");
}

function readEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function loadLocalEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

main().catch((error) => {
  console.error("");
  console.error("QA seed failed.");
  console.error(error);
  process.exitCode = 1;
});
