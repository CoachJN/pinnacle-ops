import "server-only";

import type {
  ClientOrganizationContactLink,
  Contact as RepositoryContact,
  ContractorContactLink,
  FirestoreRepositories,
  LocationContactLink,
} from "@/server/repositories";
import type { Contact, ContactLinkDetail, ContactSummary } from "@/types/contact";
import type { EntityId } from "@/types/entity";

export function toContactSummary(contact: RepositoryContact): ContactSummary {
  return {
    id: contact.id,
    displayName: contact.displayName,
    email: contact.email ?? undefined,
    primaryPhone: contact.primaryPhone ?? undefined,
    preferredLanguage: contact.preferredLanguage,
    roleTitle: contact.roleTitle ?? undefined,
    status: contact.status,
  };
}

export function toContactDetail(contact: RepositoryContact): Contact {
  return {
    ...contact,
    deletedAt: contact.deletedAt ?? undefined,
    deletedByUserId: contact.deletedByUserId ?? undefined,
    email: contact.email ?? undefined,
    primaryPhone: contact.primaryPhone ?? undefined,
    secondaryPhone: contact.secondaryPhone ?? undefined,
    roleTitle: contact.roleTitle ?? undefined,
    preferredContactMethod: contact.preferredContactMethod ?? undefined,
    notes: contact.notes ?? undefined,
  };
}

export async function resolveContactsById(
  repositories: Pick<FirestoreRepositories, "contacts">,
  contactIds: Array<EntityId | null | undefined>,
): Promise<Record<string, ContactSummary>> {
  const normalizedIds = [...new Set(contactIds.filter(Boolean).map((contactId) => contactId!.trim()))];
  if (normalizedIds.length === 0) {
    return {};
  }

  const contacts = await repositories.contacts.listByIds(normalizedIds);
  return Object.fromEntries(
    contacts.items.map((contact) => [contact.id, toContactSummary(contact)]),
  );
}

export async function resolveClientOrganizationContactLinks(
  repositories: Pick<
    FirestoreRepositories,
    "clientOrganizationContactLinks" | "contacts"
  >,
  clientOrganizationId: EntityId,
): Promise<ContactLinkDetail[]> {
  const links =
    await repositories.clientOrganizationContactLinks.listByClientOrganizationId(
      clientOrganizationId,
      { limit: 100 },
    );
  return resolveLinkDetails(repositories, links.items);
}

export async function resolveLocationContactLinks(
  repositories: Pick<FirestoreRepositories, "contacts" | "locationContactLinks">,
  locationId: EntityId,
): Promise<ContactLinkDetail[]> {
  const links = await repositories.locationContactLinks.listByLocationId(locationId, {
    limit: 100,
  });
  return resolveLinkDetails(repositories, links.items);
}

export async function resolveContractorContactLinks(
  repositories: Pick<
    FirestoreRepositories,
    "contacts" | "contractorContactLinks"
  >,
  contractorId: EntityId,
): Promise<ContactLinkDetail[]> {
  const links = await repositories.contractorContactLinks.listByContractorId(contractorId, {
    limit: 100,
  });
  return resolveLinkDetails(repositories, links.items);
}

async function resolveLinkDetails(
  repositories: Pick<FirestoreRepositories, "contacts">,
  links: Array<
    ClientOrganizationContactLink | LocationContactLink | ContractorContactLink
  >,
): Promise<ContactLinkDetail[]> {
  const contacts = await resolveContactsById(
    repositories,
    links.map((link) => link.contactId),
  );

  const resolvedLinks: Array<ContactLinkDetail | null> = links.map((link) => {
      const contact = contacts[link.contactId];
      if (!contact) {
        return null;
      }

      return {
        id: link.id,
        contactId: link.contactId,
        relationshipType: link.relationshipType,
        isPrimary: link.isPrimary,
        notes: link.notes ?? undefined,
        contact,
      };
    });

  return resolvedLinks.filter(
    (link): link is ContactLinkDetail => link !== null,
  );
}
