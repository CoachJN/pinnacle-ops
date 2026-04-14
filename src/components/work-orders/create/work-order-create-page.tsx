"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { WorkOrderForm } from "./work-order-form";
import type {
  ApiErrorResponse,
  ClientOrganizationsResponse,
  LocationsResponse,
} from "./types";

interface WorkOrderCreatePageProps {
  defaultClientOrganizationId?: string;
}

export function WorkOrderCreatePage({
  defaultClientOrganizationId,
}: WorkOrderCreatePageProps) {
  const [clientOrganizations, setClientOrganizations] = useState<
    ClientOrganizationsResponse["clientOrganizations"]
  >([]);
  const [locations, setLocations] = useState<LocationsResponse["locations"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadDependencies() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [clientResponse, locationResponse] = await Promise.all([
          fetch("/api/client-organizations?limit=100", {
            cache: "no-store",
          }),
          fetch("/api/locations?limit=100&isActive=true", {
            cache: "no-store",
          }),
        ]);

        const [clientPayload, locationPayload] = (await Promise.all([
          clientResponse.json(),
          locationResponse.json(),
        ])) as [
          ClientOrganizationsResponse | ApiErrorResponse,
          LocationsResponse | ApiErrorResponse,
        ];

        if (!clientResponse.ok) {
          throw new Error(
            getApiErrorMessage(
              clientPayload,
              "Unable to load client organizations.",
            ),
          );
        }

        if (!locationResponse.ok) {
          throw new Error(
            getApiErrorMessage(locationPayload, "Unable to load locations."),
          );
        }

        if (isCancelled) {
          return;
        }

        const successClientPayload = clientPayload as ClientOrganizationsResponse;
        const successLocationPayload = locationPayload as LocationsResponse;

        setClientOrganizations(successClientPayload.clientOrganizations);
        setLocations(successLocationPayload.locations);
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load work order creation dependencies.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDependencies();

    return () => {
      isCancelled = true;
    };
  }, []);

  const activeClientOrganizations = useMemo(
    () =>
      clientOrganizations.filter(
        (clientOrganization) => clientOrganization.status === "active",
      ),
    [clientOrganizations],
  );

  const visibleLocations = useMemo(
    () => locations.filter((location) => location.status === "active"),
    [locations],
  );

  const selectedClientOrganizationId =
    defaultClientOrganizationId &&
    activeClientOrganizations.some(
      (clientOrganization) => clientOrganization.id === defaultClientOrganizationId,
    )
      ? defaultClientOrganizationId
      : undefined;

  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="h-10 w-40 animate-pulse rounded-2xl bg-neutral-200" />
        <div className="h-40 animate-pulse rounded-3xl bg-neutral-200" />
        <div className="h-[42rem] animate-pulse rounded-3xl bg-neutral-200" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link
        className="inline-flex text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href="/dashboard"
      >
        Back to dashboard
      </Link>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Intake
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          New work order
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
          Create a Phase 3 work order inside the authenticated dashboard using the
          live client, location, and work-order APIs.
        </p>
      </section>

      {errorMessage ? <ActionFeedback message={errorMessage} /> : null}

      {!errorMessage ? (
        <WorkOrderForm
          clients={activeClientOrganizations}
          defaultClientOrganizationId={selectedClientOrganizationId}
          locations={visibleLocations}
        />
      ) : null}
    </section>
  );
}

function getApiErrorMessage(
  payload: ApiErrorResponse | ClientOrganizationsResponse | LocationsResponse,
  fallback: string,
): string {
  if ("error" in payload && payload.error?.message) {
    return payload.error.message;
  }

  return fallback;
}
