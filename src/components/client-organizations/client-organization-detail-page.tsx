"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { ClientOrganizationStatusBadge } from "@/components/client-organizations/client-organization-status-badge";
import type { ClientOrganizationDetail } from "@/components/client-organizations/types";
import { LocationStatusBadge } from "@/components/locations/location-status-badge";
import type { LocationSummary } from "@/components/locations/types";

interface ClientOrganizationDetailPageProps {
  clientOrganizationId: string;
}

interface ClientOrganizationResponse {
  clientOrganization: ClientOrganizationDetail;
}

interface LocationsResponse {
  locations: LocationSummary[];
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadClientOrganization() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [organizationResponse, locationsResponse] = await Promise.all([
          fetch(`/api/client-organizations/${clientOrganizationId}`, {
            cache: "no-store",
          }),
          fetch(
            `/api/locations?clientOrganizationId=${encodeURIComponent(clientOrganizationId)}&limit=100`,
            { cache: "no-store" },
          ),
        ]);

        const organizationPayload = (await organizationResponse.json()) as
          | ClientOrganizationResponse
          | ApiErrorResponse;
        const locationsPayload = (await locationsResponse.json()) as
          | LocationsResponse
          | ApiErrorResponse;

        if (!organizationResponse.ok) {
          const errorPayload = organizationPayload as ApiErrorResponse;
          throw new Error(
            getApiErrorMessage(
              errorPayload,
              "Unable to load the client organization.",
            ),
          );
        }

        if (!locationsResponse.ok) {
          const errorPayload = locationsPayload as ApiErrorResponse;
          throw new Error(
            getApiErrorMessage(
              errorPayload,
              "Unable to load associated locations.",
            ),
          );
        }

        if (!isCancelled) {
          const organizationSuccessPayload =
            organizationPayload as ClientOrganizationResponse;
          const locationsSuccessPayload = locationsPayload as LocationsResponse;
          setOrganization(organizationSuccessPayload.clientOrganization);
          setLocations(locationsSuccessPayload.locations);
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

          <Link
            className="inline-flex rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            href={`/locations/new?clientOrganizationId=${organization.id}`}
          >
            Create location
          </Link>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">
            Organization summary
          </h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Primary contact" value={organization.primaryContactName} />
            <DetailItem label="Primary email" value={organization.primaryContactEmail} />
            <DetailItem label="Primary phone" value={organization.primaryContactPhone} />
            <DetailItem label="Billing email" value={organization.billingEmail} />
          </dl>
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
