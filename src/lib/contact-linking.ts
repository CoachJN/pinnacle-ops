import type {
  ContactLinkInput,
  ContactRelationshipType,
} from "@/types/contact";
import type { EntityId } from "@/types/entity";

export interface ContactRoleSlotDefinition<TKey extends string = string> {
  key: TKey;
  label: string;
  relationshipType: ContactRelationshipType;
  isPrimary?: boolean;
}

export interface ContactRoleSlotAssignment<TKey extends string = string>
  extends ContactRoleSlotDefinition<TKey> {
  contactId: EntityId | null;
}

export function normalizeContactLinkInputs(
  links: readonly ContactLinkInput[],
): ContactLinkInput[] {
  const normalized = new Map<EntityId, ContactLinkInput>();

  for (const link of links) {
    const contactId = link.contactId.trim();
    if (!contactId) {
      continue;
    }

    normalized.set(contactId, {
      contactId,
      relationshipType: link.relationshipType,
      notes: normalizeNullableText(link.notes),
    });
  }

  return [...normalized.values()];
}

export function ensureRoleSlotContactsAreLinked<TKey extends string>(
  links: readonly ContactLinkInput[],
  roleSlots: readonly ContactRoleSlotAssignment<TKey>[],
): ContactLinkInput[] {
  const normalized = new Map(
    normalizeContactLinkInputs(links).map((link) => [link.contactId, link]),
  );

  for (const slot of roleSlots) {
    const contactId = slot.contactId?.trim();
    if (!contactId) {
      continue;
    }

    if (!normalized.has(contactId)) {
      normalized.set(contactId, {
        contactId,
        relationshipType: slot.relationshipType,
        notes: null,
      });
    }
  }

  return [...normalized.values()];
}

export function clearRoleSlotsForContact<TKey extends string>(
  roleSlots: readonly ContactRoleSlotAssignment<TKey>[],
  contactId: EntityId,
): ContactRoleSlotAssignment<TKey>[] {
  return roleSlots.map((slot) =>
    slot.contactId === contactId ? { ...slot, contactId: null } : slot,
  );
}

export function removeLinkedContactFromState<TKey extends string>(input: {
  contactId: EntityId;
  links: readonly ContactLinkInput[];
  roleSlots: readonly ContactRoleSlotAssignment<TKey>[];
}): {
  links: ContactLinkInput[];
  roleSlots: ContactRoleSlotAssignment<TKey>[];
} {
  return {
    links: input.links.filter((link) => link.contactId !== input.contactId),
    roleSlots: clearRoleSlotsForContact(input.roleSlots, input.contactId),
  };
}

export function getAssignedRoleSlotLabels<TKey extends string>(
  contactId: EntityId,
  roleSlots: readonly ContactRoleSlotAssignment<TKey>[],
): string[] {
  return roleSlots
    .filter((slot) => slot.contactId === contactId)
    .map((slot) => slot.label);
}

export function isContactAssignedToPrimaryRole<TKey extends string>(
  contactId: EntityId,
  roleSlots: readonly ContactRoleSlotAssignment<TKey>[],
): boolean {
  return roleSlots.some(
    (slot) => slot.contactId === contactId && Boolean(slot.isPrimary),
  );
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
