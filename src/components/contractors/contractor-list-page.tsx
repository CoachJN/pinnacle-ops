"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { ContractorStatusBadge } from "@/components/contractors/contractor-status-badge";
import type { Contractor } from "@/types/contractor";
import type {
  ContractorApiErrorResponse,
  ContractorListResponse,
} from "@/components/contractors/types";

export function ContractorListPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let isCancelled = false;

    async function loadContractors() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const params = new URLSearchParams({ limit: "100" });
        if (deferredSearch.trim()) {
          params.set("search", deferredSearch.trim());
        }
        if (status) {
          params.set("status", status);
        }

        const response = await fetch(`/api/contractors?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | ContractorListResponse
          | ContractorApiErrorResponse;

        if (!response.ok) {
          const errorPayload = payload as ContractorApiErrorResponse;
          throw new Error(
            errorPayload.error?.message ?? "Unable to load contractors.",
          );
        }

        if (!isCancelled) {
          setContractors((payload as ContractorListResponse).contractors);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load contractors.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContractors();

    return () => {
      isCancelled = true;
    };
  }, [deferredSearch, status]);

  const counts = useMemo(
    () => ({
      total: contractors.length,
      assignable: contractors.filter((contractor) => contractor.isAssignable).length,
      branches: contractors.filter((contractor) => contractor.parentContractorId).length,
    }),
    [contractors],
  );
  const contractorsById = useMemo(
    () =>
      Object.fromEntries(contractors.map((contractor) => [contractor.id, contractor])),
    [contractors],
  );

  return (
    <section className="space-y-6">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Contractors
        </p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
              Manage contractor coverage
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Track vendor readiness, keep contact details current, and prepare
              assignment-ready contractors for future dispatch workflows.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[32rem]">
            <label className="text-sm font-medium text-neutral-700">
              Search contractors
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, or company"
                type="search"
                value={search}
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              Status
              <select
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="onboarding">Onboarding</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            href="/contractors/new"
          >
            Create contractor
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-neutral-600">
          <span>{counts.total} contractor records</span>
          <span>{counts.assignable} assignment-ready</span>
          <span>{counts.branches} branch records</span>
        </div>
      </section>

      {errorMessage ? <ActionFeedback message={errorMessage} /> : null}

      <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <p className="text-sm text-neutral-600">Loading contractors...</p>
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
          </div>
        ) : contractors.length === 0 ? (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-neutral-950">
              No contractors found
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Try a broader search or add a new contractor record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Hierarchy</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Trades</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {contractors.map((contractor) => (
                  <tr className="hover:bg-neutral-50" key={contractor.id}>
                    <td className="px-6 py-4 align-top">
                      <Link
                        className="font-semibold text-neutral-950 underline-offset-4 hover:underline"
                        href={`/contractors/${contractor.id}`}
                      >
                        {contractor.displayName ?? contractor.legalName}
                      </Link>
                      <p className="mt-1 text-xs text-neutral-500">
                        {contractor.legalName}
                      </p>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <p className="text-neutral-700">
                        {formatHierarchy(contractor, contractorsById)}
                      </p>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-2">
                        <ContractorStatusBadge status={contractor.status} />
                        <p className="text-xs text-neutral-500">
                          {contractor.isAssignable
                            ? "Ready for assignment"
                            : "Needs setup before assignment"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-neutral-700">
                      {contractor.trades.length > 0
                        ? contractor.trades.map(formatTradeLabel).join(", ")
                        : "Not set"}
                    </td>
                    <td className="px-6 py-4 align-top text-neutral-700">
                      <p>{contractor.businessEmail || "No email"}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {contractor.mainPhone || "No phone"}
                      </p>
                    </td>
                    <td className="px-6 py-4 align-top text-neutral-700">
                      {formatDate(contractor.createdAt)}
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatHierarchy(
  contractor: Contractor,
  contractorsById: Record<string, Contractor>,
): string {
  if (!contractor.parentContractorId) {
    return "Parent company";
  }

  const parent = contractorsById[contractor.parentContractorId];
  return parent
    ? `${parent.displayName ?? parent.legalName} > ${contractor.displayName ?? contractor.legalName}`
    : "Branch";
}

function formatTradeLabel(value: string): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
