"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import type { ClientOrganizationDetail } from "@/components/client-organizations/types";
import { ClientOrganizationStatusBadge } from "@/components/client-organizations/client-organization-status-badge";
import { LocationStatusBadge } from "@/components/locations/location-status-badge";
import type { LocationDetail } from "@/components/locations/types";

interface LocationDetailPageProps {
  locationId: string;
}

interface LocationResponse {
  location: LocationDetail;
}

interface ClientOrganizationResponse {
  clientOrganization: ClientOrganizationDetail;
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadLocation() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const locationResponse = await fetch(`/api/locations/${locationId}`, {
          cache: "no-store",
        });
        const locationPayload = (await locationResponse.json()) as
          | LocationResponse
          | ApiErrorResponse;

        if (!locationResponse.ok) {
          const errorPayload = locationPayload as ApiErrorResponse;
          throw new Error(
            getApiErrorMessage(
              errorPayload,
              "Unable to load location details.",
            ),
          );
        }

        const locationSuccessPayload = locationPayload as LocationResponse;

        if (!isCancelled) {
          setLocation(locationSuccessPayload.location);
        }

        if (portalMode) {
          return;
        }

        const clientResponse = await fetch(
          `/api/client-organizations/${locationSuccessPayload.location.clientOrganizationId}`,
          { cache: "no-store" },
        );
        const clientPayload = (await clientResponse.json()) as
          | ClientOrganizationResponse
          | ApiErrorResponse;

        if (!clientResponse.ok) {
          const errorPayload = clientPayload as ApiErrorResponse;
          throw new Error(
            getApiErrorMessage(
              errorPayload,
              "Unable to load the related client organization.",
            ),
          );
        }

        if (!isCancelled) {
          const clientSuccessPayload = clientPayload as ClientOrganizationResponse;
          setClientOrganization(clientSuccessPayload.clientOrganization);
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
              { label: "Contact name", value: location.locationContactName },
              { label: "Contact email", value: location.locationContactEmail },
              { label: "Contact phone", value: location.locationContactPhone },
            ]}
            title="Contact information"
          />

          <TextCard
            body={location.accessNotes ?? "No access instructions provided."}
            title="Access instructions"
          />
          <TextCard body={location.notes ?? "No internal notes provided."} title="Notes" />
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
                    {clientOrganization.primaryContactName ?? "Not provided"}
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">
                    Billing email: {clientOrganization.billingEmail ?? "Not provided"}
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getApiErrorMessage(
  payload: ApiErrorResponse,
  fallback: string,
): string {
  return payload.error?.message ?? fallback;
}
