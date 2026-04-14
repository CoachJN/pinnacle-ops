"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { LocationStatusBadge } from "@/components/locations/location-status-badge";
import type { LocationSummary } from "@/components/locations/types";
import type { ClientOrganizationSummary } from "@/components/client-organizations/types";

interface LocationsResponse {
  locations: LocationSummary[];
}

interface ClientOrganizationsResponse {
  clientOrganizations: ClientOrganizationSummary[];
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

interface LocationListPageProps {
  portalMode?: boolean;
}

export function LocationListPage({
  portalMode = false,
}: LocationListPageProps) {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [clientOrganizations, setClientOrganizations] = useState<
    ClientOrganizationSummary[]
  >([]);
  const [selectedClientOrganizationId, setSelectedClientOrganizationId] =
    useState("");
  const [selectedStatus, setSelectedStatus] = useState<"" | "active" | "inactive">(
    "",
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (portalMode) {
      return;
    }

    let isCancelled = false;

    async function loadClientOrganizations() {
      try {
        const response = await fetch("/api/client-organizations?limit=100", {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | ClientOrganizationsResponse
          | ApiErrorResponse;

        if (!response.ok) {
          const errorPayload = payload as ApiErrorResponse;
          throw new Error(
            getApiErrorMessage(
              errorPayload,
              "Unable to load client organizations.",
            ),
          );
        }

        if (!isCancelled) {
          const successPayload = payload as ClientOrganizationsResponse;
          setClientOrganizations(successPayload.clientOrganizations);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load client organizations.",
          );
        }
      }
    }

    void loadClientOrganizations();

    return () => {
      isCancelled = true;
    };
  }, [portalMode]);

  useEffect(() => {
    let isCancelled = false;

    async function loadLocations() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const params = new URLSearchParams({ limit: "100" });
        if (!portalMode && selectedClientOrganizationId) {
          params.set("clientOrganizationId", selectedClientOrganizationId);
        }
        if (selectedStatus) {
          params.set("isActive", selectedStatus === "active" ? "true" : "false");
        }
        if (deferredSearch.trim()) {
          params.set("search", deferredSearch.trim());
        }

        const response = await fetch(`/api/locations?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | LocationsResponse
          | ApiErrorResponse;

        if (!response.ok) {
          const errorPayload = payload as ApiErrorResponse;
          throw new Error(
            getApiErrorMessage(errorPayload, "Unable to load locations."),
          );
        }

        if (!isCancelled) {
          const successPayload = payload as LocationsResponse;
          setLocations(successPayload.locations);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load locations.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLocations();

    return () => {
      isCancelled = true;
    };
  }, [deferredSearch, portalMode, selectedClientOrganizationId, selectedStatus]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Locations
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              {portalMode ? "Your service locations" : "Manage service locations"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              {portalMode
                ? "Review and manage the locations available to your organization."
                : "Filter locations by organization, search operational sites, and move quickly into detail or edit workflows."}
            </p>
          </div>
          <Link
            className="inline-flex rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            href={portalMode ? "/portal/locations/new" : "/locations/new"}
          >
            Create location
          </Link>
        </div>
      </div>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div
          className={
            portalMode
              ? "grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.8fr)]"
              : "grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)]"
          }
        >
          <label className="text-sm font-medium text-neutral-700">
            Search
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, code, or city"
              type="search"
              value={search}
            />
          </label>
          {portalMode ? null : (
            <label className="text-sm font-medium text-neutral-700">
              Organization
              <select
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
                onChange={(event) =>
                  setSelectedClientOrganizationId(event.target.value)
                }
                value={selectedClientOrganizationId}
              >
                <option value="">All organizations</option>
                {clientOrganizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.displayName ?? organization.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm font-medium text-neutral-700">
            Status
            <select
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
              onChange={(event) =>
                setSelectedStatus(
                  event.target.value as "" | "active" | "inactive",
                )
              }
              value={selectedStatus}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </section>

      {errorMessage ? <ActionFeedback message={errorMessage} /> : null}

      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <p className="text-sm text-neutral-600">Loading locations...</p>
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
          </div>
        ) : locations.length === 0 ? (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-neutral-950">
              No locations found
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              {portalMode
                ? "Create your first location to start managing service sites for your organization."
                : "Adjust filters or create a new location to populate this list."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Location</th>
                  {portalMode ? null : (
                    <th className="px-4 py-3">Organization</th>
                  )}
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {locations.map((location) => (
                  <tr className="align-top" key={location.id}>
                    <td className="px-4 py-4">
                      <Link
                        className="font-semibold text-neutral-950 underline-offset-4 hover:underline"
                        href={
                          portalMode
                            ? `/portal/locations/${location.id}`
                            : `/locations/${location.id}`
                        }
                      >
                        {location.name}
                      </Link>
                      <p className="mt-1 text-neutral-600">
                        {location.code ? `Code: ${location.code}` : "No location code"}
                      </p>
                    </td>
                    {portalMode ? null : (
                      <td className="px-4 py-4 text-neutral-700">
                        {location.clientSnapshot?.name ?? "Unknown organization"}
                      </td>
                    )}
                    <td className="px-4 py-4 text-neutral-700">
                      {formatAddress(location)}
                    </td>
                    <td className="px-4 py-4">
                      <LocationStatusBadge status={location.status} />
                    </td>
                    <td className="px-4 py-4 text-neutral-700">
                      {formatDate(location.updatedAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="inline-flex rounded-full border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
                          href={
                            portalMode
                              ? `/portal/locations/${location.id}`
                              : `/locations/${location.id}`
                          }
                        >
                          Detail
                        </Link>
                        <Link
                          className="inline-flex rounded-full border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
                          href={
                            portalMode
                              ? `/portal/locations/${location.id}/edit`
                              : `/locations/${location.id}/edit`
                          }
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function formatAddress(location: LocationSummary): string {
  return [location.city, location.region, location.countryCode]
    .filter((value): value is string => Boolean(value))
    .join(", ") || "Address details not provided";
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
