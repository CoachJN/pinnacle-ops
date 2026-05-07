"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { ClientOrganizationStatusBadge } from "@/components/client-organizations/client-organization-status-badge";
import type { ClientOrganizationSummary } from "@/components/client-organizations/types";

interface ClientOrganizationsResponse {
  clientOrganizations: ClientOrganizationSummary[];
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function ClientOrganizationListPage() {
  const [organizations, setOrganizations] = useState<ClientOrganizationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let isCancelled = false;

    async function loadClientOrganizations() {
      setIsLoading(true);
      setErrorMessage(null);

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
          setOrganizations(successPayload.clientOrganizations);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load client organizations.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadClientOrganizations();

    return () => {
      isCancelled = true;
    };
  }, []);

  const filteredOrganizations = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return organizations;
    }

    return organizations.filter((organization) =>
      [
        organization.name,
        organization.displayName,
        organization.primaryContact?.displayName,
        organization.primaryContact?.email,
        organization.billingContact?.displayName,
        organization.billingContact?.email,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [deferredSearch, organizations]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Client Organizations
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
              Browse client organizations
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Search account records, review key contacts, and jump into each
              organization&apos;s location footprint.
            </p>
          </div>
          <label className="block w-full max-w-md text-sm font-medium text-neutral-700">
            Search organizations
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or contact"
              type="search"
              value={search}
            />
          </label>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            href="/client-organizations/new"
          >
            Create client
          </Link>
        </div>
      </div>

      {errorMessage ? <ActionFeedback message={errorMessage} /> : null}

      <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <p className="text-sm text-neutral-600">Loading organizations...</p>
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-neutral-950">
              No client organizations found
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Try a broader search to see more organizations.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {filteredOrganizations.map((organization) => (
              <article
                className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between"
                key={organization.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      className="text-lg font-semibold text-neutral-950 underline-offset-4 hover:underline"
                      href={`/client-organizations/${organization.id}`}
                    >
                      {organization.displayName ?? organization.name}
                    </Link>
                    <ClientOrganizationStatusBadge status={organization.status} />
                  </div>
                  <p className="mt-2 text-sm text-neutral-600">
                    Legal name: {organization.name}
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-neutral-600 sm:grid-cols-2">
                    <p>
                      Primary contact:{" "}
                      {organization.primaryContact?.displayName ??
                        organization.primaryContactId ??
                        "Not provided"}
                    </p>
                    <p>
                      Contact email:{" "}
                      {organization.primaryContact?.email ?? "Not provided"}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-neutral-600 lg:text-right">
                  <p>Updated {formatDate(organization.updatedAt)}</p>
                  <Link
                    className="mt-3 inline-flex rounded-full border border-neutral-300 px-4 py-2 font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
                    href={`/client-organizations/${organization.id}`}
                  >
                    View details
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
