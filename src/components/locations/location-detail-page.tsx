"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import {
  ContactLinkManager,
  formatRelationshipTypeLabel,
} from "@/components/shared/contact-link-manager";
import type { ClientOrganizationDetail } from "@/components/client-organizations/types";
import { ClientOrganizationStatusBadge } from "@/components/client-organizations/client-organization-status-badge";
import { LocationStatusBadge } from "@/components/locations/location-status-badge";
import type { LocationDetail } from "@/components/locations/types";
import type { ContactLinkInput, ContactSummary } from "@/types/contact";
import type { ContactRoleSlotAssignment } from "@/lib/contact-linking";

interface LocationDetailPageProps {
  locationId: string;
}

interface LocationResponse {
  location: LocationDetail;
}

interface ClientOrganizationResponse {
  clientOrganization: ClientOrganizationDetail;
}

interface ContactsResponse {
  contacts: ContactSummary[];
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

interface LocationDetailPageVariantProps extends LocationDetailPageProps {
  portalMode?: boolean;
}

export function LocationDetailPage({
  locationId,
  portalMode = false,
}: LocationDetailPageVariantProps) {
  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [clientOrganization, setClientOrganization] =
    useState<ClientOrganizationDetail | null>(null);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [contactsById, setContactsById] = useState<Record<string, ContactSummary>>(
    {},
  );
  const [editableLinks, setEditableLinks] = useState<ContactLinkInput[]>([]);
  const [roleSlots, setRoleSlots] = useState<
    ContactRoleSlotAssignment<"primaryContactId" | "siteContactId">[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingContacts, setIsSavingContacts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadLocation() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [locationResponse, contactsResponse] = await Promise.all([
          fetch(`/api/locations/${locationId}`, {
            cache: "no-store",
          }),
          fetch("/api/contacts", { cache: "no-store" }),
        ]);
        const locationPayload = (await locationResponse.json()) as
          | LocationResponse
          | ApiErrorResponse;
        const contactsPayload = (await contactsResponse.json()) as
          | ContactsResponse
          | ApiErrorResponse;

        if (!locationResponse.ok) {
          throw new Error(
            getApiErrorMessage(
              locationPayload as ApiErrorResponse,
              "Unable to load location details.",
            ),
          );
        }

        if (!contactsResponse.ok) {
          throw new Error(
            getApiErrorMessage(
              contactsPayload as ApiErrorResponse,
              "Unable to load contacts.",
            ),
          );
        }

        const nextLocation = (locationPayload as LocationResponse).location;

        if (!isCancelled) {
          setLocation(nextLocation);
          setContacts((contactsPayload as ContactsResponse).contacts);
          setContactsById(
            Object.fromEntries(
              (nextLocation.linkedContacts ?? []).map((linkedContact) => [
                linkedContact.contact.id,
                linkedContact.contact,
              ]),
            ),
          );
          setEditableLinks(toEditableLinks(nextLocation));
          setRoleSlots(toLocationRoleSlots(nextLocation));
        }

        if (portalMode) {
          return;
        }

        const clientResponse = await fetch(
          `/api/client-organizations/${nextLocation.clientOrganizationId}`,
          { cache: "no-store" },
        );
        const clientPayload = (await clientResponse.json()) as
          | ClientOrganizationResponse
          | ApiErrorResponse;

        if (!clientResponse.ok) {
          throw new Error(
            getApiErrorMessage(
              clientPayload as ApiErrorResponse,
              "Unable to load the related client organization.",
            ),
          );
        }

        if (!isCancelled) {
          setClientOrganization(
            (clientPayload as ClientOrganizationResponse).clientOrganization,
          );
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load location details.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLocation();

    return () => {
      isCancelled = true;
    };
  }, [locationId, portalMode]);

  async function handleSaveContacts() {
    if (!location) {
      return;
    }

    setIsSavingContacts(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/locations/${location.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryContactId:
            roleSlots.find((slot) => slot.key === "primaryContactId")?.contactId ?? null,
          siteContactId:
            roleSlots.find((slot) => slot.key === "siteContactId")?.contactId ?? null,
          linkedContacts: editableLinks,
        }),
      });

      const payload = (await response.json()) as LocationResponse | ApiErrorResponse;
      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(
            payload as ApiErrorResponse,
            "Unable to update linked contacts.",
          ),
        );
      }

      const nextLocation = (payload as LocationResponse).location;
      setLocation(nextLocation);
      setContactsById(
        Object.fromEntries(
          (nextLocation.linkedContacts ?? []).map((linkedContact) => [
            linkedContact.contact.id,
            linkedContact.contact,
          ]),
        ),
      );
      setEditableLinks(toEditableLinks(nextLocation));
      setRoleSlots(toLocationRoleSlots(nextLocation));
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
      <section className="space-y-4">
        <div className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-72 animate-pulse rounded-3xl bg-neutral-100" />
      </section>
    );
  }

  if (errorMessage || !location) {
    return (
      <section className="space-y-4">
        <Link
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
          href={portalMode ? "/portal/locations" : "/locations"}
        >
          Back to locations
        </Link>
        <ActionFeedback
          message={errorMessage ?? "Location details could not be loaded."}
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href={portalMode ? "/portal/locations" : "/locations"}
      >
        Back to locations
      </Link>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Location
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
                {location.name}
              </h1>
              <LocationStatusBadge status={location.status} />
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              {location.code ? `Location code: ${location.code}` : "No location code"}
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Updated {formatDate(location.updatedAt)}
            </p>
          </div>
          <Link
            className="inline-flex rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            href={
              portalMode
                ? `/portal/locations/${location.id}/edit`
                : `/locations/${location.id}/edit`
            }
          >
            Edit location
          </Link>
        </div>
      </section>

      <div
        className={
          portalMode
            ? "grid gap-6"
            : "grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]"
        }
      >
        <section className="space-y-6">
          <DetailCard
            items={[
              { label: "Address line 1", value: location.addressLine1 },
              { label: "Address line 2", value: location.addressLine2 },
              { label: "City", value: location.city },
              { label: "Province", value: location.region },
              { label: "Postal code", value: location.postalCode },
              { label: "Country", value: location.countryCode },
            ]}
            title="Address"
          />

          <DetailCard
            items={[
              {
                label: "Primary contact slot",
                value: formatLinkedContact(contactsById[location.primaryContactId ?? ""]),
              },
              {
                label: "Site contact slot",
                value: formatLinkedContact(contactsById[location.siteContactId ?? ""]),
              },
            ]}
            title="Role slots"
          />

          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-950">Linked contacts</h2>
            <div className="mt-4 space-y-3">
              {(location.linkedContacts ?? []).length > 0 ? (
                location.linkedContacts?.map((linkedContact) => (
                  <article
                    className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                    key={`${linkedContact.contactId}-${linkedContact.relationshipType}`}
                  >
                    <p className="text-sm font-semibold text-neutral-950">
                      {linkedContact.contact.displayName}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-500">
                      {formatRelationshipTypeLabel(linkedContact.relationshipType)}
                      {linkedContact.isPrimary ? " • primary slot" : ""}
                    </p>
                    <p className="mt-2 text-sm text-neutral-600">
                      {linkedContact.contact.email ?? "No email"} •{" "}
                      {linkedContact.contact.primaryPhone ?? "No phone"}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-neutral-600">
                  No normalized contacts are linked yet.
                </p>
              )}
            </div>
          </section>

          <TextCard
            body={location.accessNotes ?? "No access instructions provided."}
            title="Access instructions"
          />
          <TextCard
            body={location.serviceNotes ?? "No service notes provided."}
            title="Service notes"
          />
          {portalMode ? null : (
            <TextCard
              body={location.notes ?? "No internal notes provided."}
              title="Notes"
            />
          )}
        </section>

        <aside className="space-y-6">
          {portalMode ? null : (
            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-neutral-950">
                  Organization summary
                </h2>
                {clientOrganization ? (
                  <ClientOrganizationStatusBadge
                    status={clientOrganization.status}
                  />
                ) : null}
              </div>
              {clientOrganization ? (
                <>
                  <p className="mt-3 text-base font-semibold text-neutral-950">
                    {clientOrganization.displayName ?? clientOrganization.name}
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">
                    Primary contact:{" "}
                    {clientOrganization.primaryContact?.displayName ??
                      clientOrganization.primaryContactId ??
                      "Not provided"}
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">
                    Billing contact:{" "}
                    {clientOrganization.billingContact?.displayName ??
                      clientOrganization.billingContactId ??
                      "Not provided"}
                  </p>
                  <Link
                    className="mt-4 inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
                    href={`/client-organizations/${clientOrganization.id}`}
                  >
                    View organization
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm text-neutral-600">
                  Organization details are unavailable.
                </p>
              )}
            </section>
          )}

          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-950">
              Record state
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              This location is currently{" "}
              <span className="font-semibold text-neutral-950">
                {location.status === "active" ? "active" : "inactive"}
              </span>
              .
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Created {formatDate(location.createdAt)}
            </p>
          </section>
        </aside>
      </div>

      <ContactLinkManager
        contacts={contacts}
        description="Manage site-linked contacts directly here. Removing a role-assigned contact clears that slot in the same change."
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
    </section>
  );
}

function DetailCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value?: string }>;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4" key={item.label}>
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              {item.label}
            </dt>
            <dd className="mt-2 text-sm text-neutral-700">
              {item.value ?? "Not provided"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TextCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
        {body}
      </p>
    </section>
  );
}

function toEditableLinks(location: Pick<LocationDetail, "linkedContacts">): ContactLinkInput[] {
  return (
    location.linkedContacts?.map((link) => ({
      contactId: link.contactId,
      relationshipType: link.relationshipType,
      notes: link.notes ?? null,
    })) ?? []
  );
}

function toLocationRoleSlots(
  location: Pick<LocationDetail, "primaryContactId" | "siteContactId">,
): ContactRoleSlotAssignment<"primaryContactId" | "siteContactId">[] {
  return [
    {
      key: "primaryContactId",
      label: "Primary",
      relationshipType: "primary",
      contactId: location.primaryContactId ?? null,
      isPrimary: true,
    },
    {
      key: "siteContactId",
      label: "Site",
      relationshipType: "site",
      contactId: location.siteContactId ?? null,
    },
  ];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLinkedContact(contact: ContactSummary | undefined): string {
  if (!contact) {
    return "Not linked";
  }

  return [contact.displayName, contact.email, contact.primaryPhone]
    .filter(Boolean)
    .join(" • ");
}

function getApiErrorMessage(
  payload: ApiErrorResponse,
  fallback: string,
): string {
  return payload.error?.message ?? fallback;
}
