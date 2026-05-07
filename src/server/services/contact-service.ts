import "server-only";

import type {
  ClientOrganizationContactLink,
  Contact,
  ContractorContactLink,
  FirestoreRepositories,
  LocationContactLink,
} from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import { notFoundError, validationError } from "./errors";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types";

export interface ContactService {
  listContacts(input: ListContactsInput): Promise<ServiceResult<Contact[]>>;
  getContact(contactId: EntityId): Promise<ServiceResult<Contact>>;
  createContact(input: CreateContactInput): Promise<ServiceResult<Contact>>;
  updateContact(input: UpdateContactInput): Promise<ServiceResult<Contact>>;
}

export interface ListContactsInput {
  organizationId: EntityId;
  ids?: readonly EntityId[];
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  contractorId?: EntityId;
  limit?: number;
}

export interface CreateContactInput extends ServiceAuditContext {
  firstName: string;
  lastName: string;
  displayName?: string | null;
  email?: string | null;
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
  roleTitle?: string | null;
  preferredLanguage?: Contact["preferredLanguage"];
  preferredContactMethod?: Contact["preferredContactMethod"];
  notes?: string | null;
  status?: Contact["status"];
}

export interface UpdateContactInput extends ServiceAuditContext {
  contactId: EntityId;
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  email?: string | null;
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
  roleTitle?: string | null;
  preferredLanguage?: Contact["preferredLanguage"];
  preferredContactMethod?: Contact["preferredContactMethod"];
  notes?: string | null;
  status?: Contact["status"];
}

export function createContactService(
  repositories: Pick<
    FirestoreRepositories,
    | "clientOrganizationContactLinks"
    | "contacts"
    | "contractorContactLinks"
    | "locationContactLinks"
  >,
): ContactService {
  return new FirestoreContactService(repositories);
}

class FirestoreContactService implements ContactService {
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      | "clientOrganizationContactLinks"
      | "contacts"
      | "contractorContactLinks"
      | "locationContactLinks"
    >,
  ) {}

  async listContacts(input: ListContactsInput): Promise<ServiceResult<Contact[]>> {
    if (input.ids && input.ids.length > 0) {
      const contacts = await this.repositories.contacts.listByIds(input.ids);
      return serviceOk(
        contacts.items.filter((contact) => contact.organizationId === input.organizationId),
      );
    }

    if (input.clientOrganizationId) {
      return this.listScopedContacts({
        organizationId: input.organizationId,
        links: await this.repositories.clientOrganizationContactLinks.listByClientOrganizationId(
          input.clientOrganizationId,
          { limit: input.limit ?? 100 },
        ),
      });
    }

    if (input.locationId) {
      return this.listScopedContacts({
        organizationId: input.organizationId,
        links: await this.repositories.locationContactLinks.listByLocationId(
          input.locationId,
          { limit: input.limit ?? 100 },
        ),
      });
    }

    if (input.contractorId) {
      return this.listScopedContacts({
        organizationId: input.organizationId,
        links: await this.repositories.contractorContactLinks.listByContractorId(
          input.contractorId,
          { limit: input.limit ?? 100 },
        ),
      });
    }

    const contacts = await this.repositories.contacts.listByOrganizationId(
      input.organizationId,
      { limit: input.limit ?? 100 },
    );
    return serviceOk(contacts.items);
  }

  async getContact(contactId: EntityId): Promise<ServiceResult<Contact>> {
    const contact = await this.repositories.contacts.getById(contactId);
    if (!contact || contact.isDeleted) {
      return serviceFail(notFoundError("Contact could not be found."));
    }

    return serviceOk(contact);
  }

  async createContact(input: CreateContactInput): Promise<ServiceResult<Contact>> {
    const firstName = normalizeRequiredText(input.firstName, "First name");
    if (!firstName.ok) {
      return firstName;
    }

    const lastName = normalizeRequiredText(input.lastName, "Last name");
    if (!lastName.ok) {
      return lastName;
    }

    const contact: Contact = {
      id: this.repositories.contacts.newId(),
      ...createAuditFields(input),
      firstName: firstName.value,
      lastName: lastName.value,
      displayName: buildDisplayName({
        displayName: input.displayName,
        firstName: firstName.value,
        lastName: lastName.value,
      }),
      email: normalizeNullableText(input.email),
      primaryPhone: normalizeNullableText(input.primaryPhone),
      secondaryPhone: normalizeNullableText(input.secondaryPhone),
      roleTitle: normalizeNullableText(input.roleTitle),
      preferredLanguage: input.preferredLanguage ?? "unknown",
      preferredContactMethod: input.preferredContactMethod ?? null,
      notes: normalizeNullableText(input.notes),
      status: input.status ?? "active",
    };

    await this.repositories.contacts.create(contact);
    return serviceOk(contact);
  }

  async updateContact(input: UpdateContactInput): Promise<ServiceResult<Contact>> {
    const existing = await this.repositories.contacts.getById(input.contactId);
    if (!existing || existing.isDeleted) {
      return serviceFail(notFoundError("Contact could not be found."));
    }

    const firstName =
      input.firstName === undefined
        ? serviceOk(existing.firstName)
        : normalizeRequiredText(input.firstName, "First name");
    if (!firstName.ok) {
      return firstName;
    }

    const lastName =
      input.lastName === undefined
        ? serviceOk(existing.lastName)
        : normalizeRequiredText(input.lastName, "Last name");
    if (!lastName.ok) {
      return lastName;
    }

    const updated = touchAuditFields(
      {
        ...existing,
        firstName: firstName.value,
        lastName: lastName.value,
        displayName: buildDisplayName({
          displayName:
            input.displayName === undefined
              ? existing.displayName
              : normalizeNullableText(input.displayName),
          firstName: firstName.value,
          lastName: lastName.value,
        }),
        email:
          input.email === undefined ? existing.email : normalizeNullableText(input.email),
        primaryPhone:
          input.primaryPhone === undefined
            ? existing.primaryPhone
            : normalizeNullableText(input.primaryPhone),
        secondaryPhone:
          input.secondaryPhone === undefined
            ? existing.secondaryPhone
            : normalizeNullableText(input.secondaryPhone),
        roleTitle:
          input.roleTitle === undefined
            ? existing.roleTitle
            : normalizeNullableText(input.roleTitle),
        preferredLanguage: input.preferredLanguage ?? existing.preferredLanguage,
        preferredContactMethod:
          input.preferredContactMethod === undefined
            ? existing.preferredContactMethod
            : input.preferredContactMethod,
        notes:
          input.notes === undefined ? existing.notes : normalizeNullableText(input.notes),
        status: input.status ?? existing.status,
      },
      input,
    );

    await this.repositories.contacts.save(updated);
    return serviceOk(updated);
  }

  private async listScopedContacts(input: {
    organizationId: EntityId;
    links: { items: Array<ClientOrganizationContactLink | LocationContactLink | ContractorContactLink> };
  }): Promise<ServiceResult<Contact[]>> {
    const contactIds = [...new Set(input.links.items.map((link) => link.contactId))];
    const contacts = await this.repositories.contacts.listByIds(contactIds);
    return serviceOk(
      contacts.items.filter((contact) => contact.organizationId === input.organizationId),
    );
  }
}

function buildDisplayName(input: {
  displayName: string | null | undefined;
  firstName: string;
  lastName: string;
}): string {
  return normalizeNullableText(input.displayName) ?? `${input.firstName} ${input.lastName}`;
}

function normalizeRequiredText(
  value: string,
  label: string,
): ServiceResult<string> {
  const normalized = value.trim();
  if (!normalized) {
    return serviceFail(validationError(`${label} is required.`));
  }

  return serviceOk(normalized);
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
