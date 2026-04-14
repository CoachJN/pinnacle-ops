"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { ContractorStatusBadge } from "@/components/contractors/contractor-status-badge";
import type { Contractor } from "@/types/contractor";
import type {
  ContractorApiErrorResponse,
  ContractorDetailResponse,
} from "@/components/contractors/types";
import { DetailField, DetailSection } from "@/components/work-orders/detail-section";

export function ContractorDetailPage({
  contractorId,
}: {
  contractorId: string;
}) {
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadContractor() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/contractors/${contractorId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | ContractorDetailResponse
          | ContractorApiErrorResponse;

        if (!response.ok) {
          const errorPayload = payload as ContractorApiErrorResponse;
          throw new Error(
            errorPayload.error?.message ?? "Unable to load contractor.",
          );
        }

        if (!isCancelled) {
          setContractor((payload as ContractorDetailResponse).contractor);
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
              {contractor.name}
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              {contractor.company ?? "Independent contractor"}
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
          <DetailField label="Name" value={contractor.name} />
          <DetailField label="Company" value={contractor.company} />
          <DetailField label="Email" value={contractor.email} />
          <DetailField label="Phone" value={contractor.phone} />
          <DetailField
            label="Service categories"
            value={contractor.serviceCategories.join(", ")}
            fullWidth
          />
          <DetailField
            label="Service areas"
            value={contractor.serviceAreas.join(", ")}
            fullWidth
          />
          <DetailField label="Notes" value={contractor.notes} fullWidth />
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
