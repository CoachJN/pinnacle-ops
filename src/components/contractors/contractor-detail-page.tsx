"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import {
  ContactLinkManager,
  formatRelationshipTypeLabel,
} from "@/components/shared/contact-link-manager";
import { ContractorStatusBadge } from "@/components/contractors/contractor-status-badge";
import type { Contractor } from "@/types/contractor";
import type { ContactLinkInput, ContactSummary } from "@/types/contact";
import type {
  ContractorApiErrorResponse,
  ContractorDetailResponse,
  ContractorListResponse,
} from "@/components/contractors/types";
import { DetailField, DetailSection } from "@/components/work-orders/detail-section";
import type { ContactRoleSlotAssignment } from "@/lib/contact-linking";

interface ContactsResponse {
  contacts: ContactSummary[];
}

export function ContractorDetailPage({
  contractorId,
}: {
  contractorId: string;
}) {
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [contractorsById, setContractorsById] = useState<Record<string, Contractor>>(
    {},
  );
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [contactsById, setContactsById] = useState<Record<string, ContactSummary>>(
    {},
  );
  const [editableLinks, setEditableLinks] = useState<ContactLinkInput[]>([]);
  const [roleSlots, setRoleSlots] = useState<
    ContactRoleSlotAssignment<
      "primaryContactId" | "billingContactId" | "dispatchContactId"
    >[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingContacts, setIsSavingContacts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadContractor() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [contractorResponse, contractorsResponse, contactsResponse] =
          await Promise.all([
            fetch(`/api/contractors/${contractorId}`, {
              cache: "no-store",
            }),
            fetch("/api/contractors?limit=100", {
              cache: "no-store",
            }),
            fetch("/api/contacts", { cache: "no-store" }),
          ]);
        const payload = (await contractorResponse.json()) as
          | ContractorDetailResponse
          | ContractorApiErrorResponse;
        const contractorsPayload = (await contractorsResponse.json()) as
          | ContractorListResponse
          | ContractorApiErrorResponse;
        const contactsPayload = (await contactsResponse.json()) as
          | ContactsResponse
          | ContractorApiErrorResponse;

        if (!contractorResponse.ok) {
          throw new Error(
            (payload as ContractorApiErrorResponse).error?.message ??
              "Unable to load contractor.",
          );
        }
        if (!contractorsResponse.ok) {
          throw new Error(
            (contractorsPayload as ContractorApiErrorResponse).error?.message ??
              "Unable to load contractors.",
          );
        }
        if (!contactsResponse.ok) {
          throw new Error(
            (contactsPayload as ContractorApiErrorResponse).error?.message ??
              "Unable to load contacts.",
          );
        }

        if (!isCancelled) {
          const nextContractor = (payload as ContractorDetailResponse).contractor;
          const allContractors =
            (contractorsPayload as ContractorListResponse).contractors;
          const allContacts = (contactsPayload as ContactsResponse).contacts;
          setContractor(nextContractor);
          setContractorsById(
            Object.fromEntries(
              allContractors.map((candidate) => [candidate.id, candidate]),
            ),
          );
          setContacts(allContacts);
          setContactsById(
            Object.fromEntries(
              (nextContractor.linkedContacts ?? []).map((linkedContact) => [
                linkedContact.contact.id,
                linkedContact.contact,
              ]),
            ),
          );
          setEditableLinks(toEditableLinks(nextContractor));
          setRoleSlots(toContractorRoleSlots(nextContractor));
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load contractor.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContractor();

    return () => {
      isCancelled = true;
    };
  }, [contractorId]);

  async function handleSaveContacts() {
    if (!contractor) {
      return;
    }

    setIsSavingContacts(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/contractors/${contractor.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryContactId:
            roleSlots.find((slot) => slot.key === "primaryContactId")?.contactId ?? null,
          billingContactId:
            roleSlots.find((slot) => slot.key === "billingContactId")?.contactId ?? null,
          dispatchContactId:
            roleSlots.find((slot) => slot.key === "dispatchContactId")?.contactId ?? null,
          linkedContacts: editableLinks,
        }),
      });

      const result = (await response.json()) as
        | ContractorDetailResponse
        | ContractorApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          (result as ContractorApiErrorResponse).error?.message ??
            "Unable to update linked contacts.",
        );
      }

      const nextContractor = (result as ContractorDetailResponse).contractor;
      setContractor(nextContractor);
      setContactsById(
        Object.fromEntries(
          (nextContractor.linkedContacts ?? []).map((linkedContact) => [
            linkedContact.contact.id,
            linkedContact.contact,
          ]),
        ),
      );
      setEditableLinks(toEditableLinks(nextContractor));
      setRoleSlots(toContractorRoleSlots(nextContractor));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update linked contacts.",
      );
    } finally {
      setIsSavingContacts(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-600">Loading contractor...</p>
      </section>
    );
  }

  if (errorMessage || !contractor) {
    return <ActionFeedback message={errorMessage ?? "Contractor not found."} />;
  }

  const parentContractor = contractor.parentContractorId
    ? contractorsById[contractor.parentContractorId] ?? null
    : null;
  const childContractors = Object.values(contractorsById).filter(
    (candidate) => candidate.parentContractorId === contractor.id,
  );

  return (
    <section className="space-y-6">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <Link
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
          href="/contractors"
        >
          Back to contractors
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Contractor Detail
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              {contractor.displayName ?? contractor.legalName}
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              {contractor.legalName}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <ContractorStatusBadge status={contractor.status} />
            <Link
              className="inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
              href={`/contractors/${contractor.id}/edit`}
            >
              Edit contractor
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white px-6 shadow-sm">
        <DetailSection title="Contractor information">
          <DetailField label="Legal name" value={contractor.legalName} />
          <DetailField label="Display name" value={contractor.displayName} />
          <DetailField
            label="Parent contractor"
            value={
              parentContractor
                ? `${parentContractor.displayName ?? parentContractor.legalName} (${parentContractor.id})`
                : "Independent contractor"
            }
          />
          <DetailField
            label="Branches / divisions"
            value={
              childContractors.length > 0
                ? childContractors
                    .map((child) => child.displayName ?? child.legalName)
                    .join(", ")
                : "No child branches"
            }
          />
          <DetailField label="Business email" value={contractor.businessEmail} />
          <DetailField label="Main phone" value={contractor.mainPhone} />
          <DetailField label="Alternate phone" value={contractor.altPhone} />
          <DetailField label="Fax" value={contractor.fax} />
          <DetailField
            label="Trades"
            value={contractor.trades.map(formatTradeLabel).join(", ")}
            fullWidth
          />
          <DetailField label="Service area" value={contractor.serviceArea} fullWidth />
          <DetailField
            label="Primary contact slot"
            value={formatLinkedContact(contactsById[contractor.primaryContactId ?? ""])}
          />
          <DetailField
            label="Billing contact slot"
            value={formatLinkedContact(contactsById[contractor.billingContactId ?? ""])}
          />
          <DetailField
            label="Dispatch contact slot"
            value={formatLinkedContact(contactsById[contractor.dispatchContactId ?? ""])}
          />
          <DetailField label="Notes" value={contractor.notes} fullWidth />
        </DetailSection>
        <DetailSection title="Linked contacts">
          <DetailField
            fullWidth
            label="Membership"
            value={
              contractor.linkedContacts?.length
                ? contractor.linkedContacts
                    .map(
                      (link) =>
                        `${link.contact.displayName} (${formatRelationshipTypeLabel(link.relationshipType)}${link.isPrimary ? ", primary slot" : ""})`,
                    )
                    .join(", ")
                : "No linked contacts"
            }
          />
        </DetailSection>
        <DetailSection title="Metadata">
          <DetailField
            label="Assignment readiness"
            value={
              contractor.isAssignable ? "Ready for assignment" : "Not ready"
            }
          />
          <DetailField label="Created" value={formatDateTime(contractor.createdAt)} />
          <DetailField label="Updated" value={formatDateTime(contractor.updatedAt)} />
          <DetailField label="Created by user" value={contractor.createdByUserId} />
          <DetailField label="Updated by user" value={contractor.updatedByUserId} />
        </DetailSection>
      </section>

      <ContactLinkManager
        contacts={contacts}
        description="Manage contractor-linked contacts directly here. Removing a role-assigned contact clears that slot in the same change."
        linkedContacts={editableLinks}
        onLinkedContactsChange={setEditableLinks}
        onRoleSlotsChange={setRoleSlots}
        roleSlots={roleSlots}
        title="Manage linked contacts"
      />
      <div className="flex justify-end">
        <button
          className="inline-flex rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSavingContacts}
          onClick={handleSaveContacts}
          type="button"
        >
          {isSavingContacts ? "Saving contacts..." : "Save linked contacts"}
        </button>
      </div>

      <section className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-6">
        <h2 className="text-lg font-semibold text-neutral-950">
          Assigned work orders
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          This placeholder will be expanded in Phase 2 when contractor assignment
          workflows are integrated more deeply.
        </p>
      </section>
    </section>
  );
}

function toEditableLinks(contractor: Pick<Contractor, "linkedContacts">): ContactLinkInput[] {
  return (
    contractor.linkedContacts?.map((link) => ({
      contactId: link.contactId,
      relationshipType: link.relationshipType,
      notes: link.notes ?? null,
    })) ?? []
  );
}

function toContractorRoleSlots(
  contractor: Pick<
    Contractor,
    "primaryContactId" | "billingContactId" | "dispatchContactId"
  >,
): ContactRoleSlotAssignment<
  "primaryContactId" | "billingContactId" | "dispatchContactId"
>[] {
  return [
    {
      key: "primaryContactId",
      label: "Primary",
      relationshipType: "primary",
      contactId: contractor.primaryContactId ?? null,
      isPrimary: true,
    },
    {
      key: "billingContactId",
      label: "Billing",
      relationshipType: "billing",
      contactId: contractor.billingContactId ?? null,
    },
    {
      key: "dispatchContactId",
      label: "Dispatch",
      relationshipType: "dispatch",
      contactId: contractor.dispatchContactId ?? null,
    },
  ];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLinkedContact(contact: ContactSummary | undefined): string {
  if (!contact) {
    return "Not linked";
  }

  return [
    contact.displayName,
    contact.email,
    contact.primaryPhone,
    contact.preferredLanguage ? `Preferred language: ${contact.preferredLanguage}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

function formatTradeLabel(value: string): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
