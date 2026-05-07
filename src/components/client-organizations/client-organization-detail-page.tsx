"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import {
  ContactLinkManager,
  formatRelationshipTypeLabel,
} from "@/components/shared/contact-link-manager";
import { ClientOrganizationStatusBadge } from "@/components/client-organizations/client-organization-status-badge";
import type { ClientOrganizationDetail } from "@/components/client-organizations/types";
import { LocationStatusBadge } from "@/components/locations/location-status-badge";
import type { LocationSummary } from "@/components/locations/types";
import type { ContactLinkInput, ContactSummary } from "@/types/contact";
import type { ContactRoleSlotAssignment } from "@/lib/contact-linking";

interface ClientOrganizationDetailPageProps {
  clientOrganizationId: string;
}

interface ClientOrganizationResponse {
  clientOrganization: ClientOrganizationDetail;
}

interface LocationsResponse {
  locations: LocationSummary[];
}

interface ContactsResponse {
  contacts: ContactSummary[];
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function ClientOrganizationDetailPage({
  clientOrganizationId,
}: ClientOrganizationDetailPageProps) {
  const [organization, setOrganization] =
    useState<ClientOrganizationDetail | null>(null);
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [editableLinks, setEditableLinks] = useState<ContactLinkInput[]>([]);
  const [roleSlots, setRoleSlots] = useState<
    ContactRoleSlotAssignment<"primaryContactId" | "billingContactId">[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingContacts, setIsSavingContacts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadClientOrganization() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [organizationResponse, locationsResponse, contactsResponse] =
          await Promise.all([
            fetch(`/api/client-organizations/${clientOrganizationId}`, {
              cache: "no-store",
            }),
            fetch(
              `/api/locations?clientOrganizationId=${encodeURIComponent(clientOrganizationId)}&limit=100`,
              { cache: "no-store" },
            ),
            fetch("/api/contacts", { cache: "no-store" }),
          ]);

        const organizationPayload = (await organizationResponse.json()) as
          | ClientOrganizationResponse
          | ApiErrorResponse;
        const locationsPayload = (await locationsResponse.json()) as
          | LocationsResponse
          | ApiErrorResponse;
        const contactsPayload = (await contactsResponse.json()) as
          | ContactsResponse
          | ApiErrorResponse;

        if (!organizationResponse.ok) {
          throw new Error(
            getApiErrorMessage(
              organizationPayload as ApiErrorResponse,
              "Unable to load the client organization.",
            ),
          );
        }

        if (!locationsResponse.ok) {
          throw new Error(
            getApiErrorMessage(
              locationsPayload as ApiErrorResponse,
              "Unable to load associated locations.",
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

        if (!isCancelled) {
          const nextOrganization =
            (organizationPayload as ClientOrganizationResponse).clientOrganization;
          setOrganization(nextOrganization);
          setLocations((locationsPayload as LocationsResponse).locations);
          setContacts((contactsPayload as ContactsResponse).contacts);
          setEditableLinks(toEditableLinks(nextOrganization));
          setRoleSlots(toClientRoleSlots(nextOrganization));
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the client organization.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadClientOrganization();

    return () => {
      isCancelled = true;
    };
  }, [clientOrganizationId]);

  async function handleSaveContacts() {
    if (!organization) {
      return;
    }

    setIsSavingContacts(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/client-organizations/${organization.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryContactId:
            roleSlots.find((slot) => slot.key === "primaryContactId")?.contactId ?? null,
          billingContactId:
            roleSlots.find((slot) => slot.key === "billingContactId")?.contactId ?? null,
          linkedContacts: editableLinks,
        }),
      });

      const payload = (await response.json()) as
        | ClientOrganizationResponse
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(
            payload as ApiErrorResponse,
            "Unable to update linked contacts.",
          ),
        );
      }

      const nextOrganization = (payload as ClientOrganizationResponse).clientOrganization;
      setOrganization(nextOrganization);
      setEditableLinks(toEditableLinks(nextOrganization));
      setRoleSlots(toClientRoleSlots(nextOrganization));
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
        <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
      </section>
    );
  }

  if (errorMessage || !organization) {
    return (
      <section className="space-y-4">
        <Link
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
          href="/client-organizations"
        >
          Back to client organizations
        </Link>
        <ActionFeedback
          message={errorMessage ?? "Client organization could not be loaded."}
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href="/client-organizations"
      >
        Back to client organizations
      </Link>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Client Organization
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
                {organization.displayName ?? organization.name}
              </h1>
              <ClientOrganizationStatusBadge status={organization.status} />
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Legal name: {organization.name}
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Created {formatDate(organization.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
              href={`/client-organizations/${organization.id}/edit`}
            >
              Edit client
            </Link>
            <Link
              className="inline-flex rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
              href={`/locations/new?clientOrganizationId=${organization.id}`}
            >
              Create location
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">
            Organization summary
          </h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailItem
              label="Primary contact slot"
              value={organization.primaryContact?.displayName ?? organization.primaryContactId}
            />
            <DetailItem
              label="Billing contact slot"
              value={organization.billingContact?.displayName ?? organization.billingContactId}
            />
          </dl>
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Linked contacts
            </p>
            <div className="mt-3 space-y-3">
              {(organization.linkedContacts ?? []).length > 0 ? (
                organization.linkedContacts?.map((linkedContact) => (
                  <div
                    className="rounded-2xl border border-neutral-200 bg-white p-4"
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
                    <p className="mt-1 text-sm text-neutral-600">
                      Preferred language:{" "}
                      {linkedContact.contact.preferredLanguage ?? "unknown"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-600">
                  No normalized contacts are linked yet.
                </p>
              )}
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Notes
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              {organization.notes ?? "No organization notes available."}
            </p>
          </div>
        </section>

        <aside className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">
            Coverage snapshot
          </h2>
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Associated locations
            </p>
            <p className="mt-2 text-3xl font-semibold text-neutral-950">
              {locations.length}
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Active and inactive sites linked to this client organization.
            </p>
          </div>
        </aside>
      </div>

      <ContactLinkManager
        contacts={contacts}
        description="Manage linked client contacts directly here. Unlinking a role-assigned contact clears that role in the same change."
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

      <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-neutral-950">
            Associated locations
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Navigate to each site to review contacts, access details, and current
            activity.
          </p>
        </div>

        {locations.length === 0 ? (
          <div className="p-6">
            <h3 className="text-base font-semibold text-neutral-950">
              No locations yet
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Create the first location for this organization to start tracking
              operational sites.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {locations.map((location) => (
              <article
                className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between"
                key={location.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      className="text-base font-semibold text-neutral-950 underline-offset-4 hover:underline"
                      href={`/locations/${location.id}`}
                    >
                      {location.name}
                    </Link>
                    <LocationStatusBadge status={location.status} />
                  </div>
                  <p className="mt-2 text-sm text-neutral-600">
                    {formatLocationLine(location)}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    className="inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
                    href={`/locations/${location.id}`}
                  >
                    View
                  </Link>
                  <Link
                    className="inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
                    href={`/locations/${location.id}/edit`}
                  >
                    Edit
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm text-neutral-700">{value ?? "Not provided"}</dd>
    </div>
  );
}

function toEditableLinks(
  organization: Pick<ClientOrganizationDetail, "linkedContacts">,
): ContactLinkInput[] {
  return (
    organization.linkedContacts?.map((link) => ({
      contactId: link.contactId,
      relationshipType: link.relationshipType,
      notes: link.notes ?? null,
    })) ?? []
  );
}

function toClientRoleSlots(
  organization: Pick<ClientOrganizationDetail, "primaryContactId" | "billingContactId">,
): ContactRoleSlotAssignment<"primaryContactId" | "billingContactId">[] {
  return [
    {
      key: "primaryContactId",
      label: "Primary",
      relationshipType: "primary",
      contactId: organization.primaryContactId ?? null,
      isPrimary: true,
    },
    {
      key: "billingContactId",
      label: "Billing",
      relationshipType: "billing",
      contactId: organization.billingContactId ?? null,
    },
  ];
}

function formatLocationLine(location: LocationSummary): string {
  return [location.city, location.region, location.countryCode]
    .filter((value): value is string => Boolean(value))
    .join(", ") || "Address details not provided";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getApiErrorMessage(
  payload: ApiErrorResponse,
  fallback: string,
): string {
  return payload.error?.message ?? fallback;
}
