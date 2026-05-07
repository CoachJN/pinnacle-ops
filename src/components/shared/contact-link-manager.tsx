"use client";

import { useMemo, useState } from "react";
import {
  CONTACT_RELATIONSHIP_TYPE_VALUES,
  type ContactLinkInput,
  type ContactRelationshipType,
  type ContactSummary,
} from "@/types/contact";
import {
  ensureRoleSlotContactsAreLinked,
  getAssignedRoleSlotLabels,
  removeLinkedContactFromState,
  type ContactRoleSlotAssignment,
} from "@/lib/contact-linking";

export interface ContactLinkManagerRoleSlot<TKey extends string = string>
  extends ContactRoleSlotAssignment<TKey> {}

interface ContactLinkManagerProps<TKey extends string = string> {
  contacts: ContactSummary[];
  linkedContacts: ContactLinkInput[];
  roleSlots: ContactLinkManagerRoleSlot<TKey>[];
  onLinkedContactsChange: (links: ContactLinkInput[]) => void;
  onRoleSlotsChange: (slots: ContactLinkManagerRoleSlot<TKey>[]) => void;
  className?: string;
  title?: string;
  description?: string;
}

export function ContactLinkManager<TKey extends string = string>({
  contacts,
  linkedContacts,
  roleSlots,
  onLinkedContactsChange,
  onRoleSlotsChange,
  className,
  title = "Contact links",
  description = "Manage normalized linked contact membership separately from role-slot assignment.",
}: ContactLinkManagerProps<TKey>) {
  const [pendingContactId, setPendingContactId] = useState("");
  const contactsById = useMemo(
    () => Object.fromEntries(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );
  const normalizedLinks = useMemo(
    () => ensureRoleSlotContactsAreLinked(linkedContacts, roleSlots),
    [linkedContacts, roleSlots],
  );
  const linkedContactIds = new Set(normalizedLinks.map((link) => link.contactId));
  const unlinkedContacts = contacts.filter((contact) => !linkedContactIds.has(contact.id));

  function handleRoleSlotChange(slotKey: TKey, contactId: string) {
    const nextRoleSlots = roleSlots.map((slot) =>
      slot.key === slotKey
        ? {
            ...slot,
            contactId: contactId.trim() ? contactId : null,
          }
        : slot,
    );

    onRoleSlotsChange(nextRoleSlots);
    onLinkedContactsChange(ensureRoleSlotContactsAreLinked(normalizedLinks, nextRoleSlots));
  }

  function handleRelationshipChange(
    contactId: string,
    relationshipType: ContactRelationshipType,
  ) {
    onLinkedContactsChange(
      normalizedLinks.map((link) =>
        link.contactId === contactId ? { ...link, relationshipType } : link,
      ),
    );
  }

  function handleAddContact() {
    const contactId = pendingContactId.trim();
    if (!contactId) {
      return;
    }

    onLinkedContactsChange([
      ...normalizedLinks,
      {
        contactId,
        relationshipType: "operations",
        notes: null,
      },
    ]);
    setPendingContactId("");
  }

  function handleRemoveContact(contactId: string) {
    const nextState = removeLinkedContactFromState({
      contactId,
      links: normalizedLinks,
      roleSlots,
    });
    onRoleSlotsChange(nextState.roleSlots);
    onLinkedContactsChange(nextState.links);
  }

  return (
    <section
      className={`rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm ${className ?? ""}`}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Role slots
          </p>
          <div className="mt-4 grid gap-4">
            {roleSlots.map((slot) => (
              <label className="text-sm font-medium text-neutral-700" key={slot.key}>
                {slot.label}
                <select
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
                  onChange={(event) =>
                    handleRoleSlotChange(slot.key, event.target.value)
                  }
                  value={slot.contactId ?? ""}
                >
                  <option value="">No assigned contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.displayName}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-neutral-500">
                  Selecting a role slot keeps the contact linked automatically.
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1 text-sm font-medium text-neutral-700">
              Add existing contact
              <select
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
                onChange={(event) => setPendingContactId(event.target.value)}
                value={pendingContactId}
              >
                <option value="">Select a contact to link</option>
                {unlinkedContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!pendingContactId}
              onClick={handleAddContact}
              type="button"
            >
              Link contact
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {normalizedLinks.length > 0 ? (
              normalizedLinks.map((link) => {
                const contact = contactsById[link.contactId];
                const slotLabels = getAssignedRoleSlotLabels(link.contactId, roleSlots);
                return (
                  <article
                    className="rounded-2xl border border-neutral-200 bg-white p-4"
                    key={link.contactId}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">
                          {contact?.displayName ?? link.contactId}
                        </p>
                        <p className="mt-1 text-sm text-neutral-600">
                          {[contact?.email ?? "No email", contact?.primaryPhone ?? "No phone"]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                        {slotLabels.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {slotLabels.map((slotLabel) => (
                              <span
                                className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900"
                                key={slotLabel}
                              >
                                {slotLabel}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <button
                        className="inline-flex rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                        onClick={() => handleRemoveContact(link.contactId)}
                        type="button"
                      >
                        {slotLabels.length > 0 ? "Unlink and clear roles" : "Unlink"}
                      </button>
                    </div>

                    <label className="mt-4 block text-sm font-medium text-neutral-700">
                      Relationship type
                      <select
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
                        onChange={(event) =>
                          handleRelationshipChange(
                            link.contactId,
                            event.target.value as ContactRelationshipType,
                          )
                        }
                        value={link.relationshipType}
                      >
                        {CONTACT_RELATIONSHIP_TYPE_VALUES.map((relationshipType) => (
                          <option key={relationshipType} value={relationshipType}>
                            {formatRelationshipTypeLabel(relationshipType)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                );
              })
            ) : (
              <p className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-5 text-sm text-neutral-600">
                No contacts are linked yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export function formatRelationshipTypeLabel(
  relationshipType: ContactRelationshipType,
): string {
  return relationshipType
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
