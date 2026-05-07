"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { ContactStatusBadge } from "@/components/contacts/contact-status-badge";
import { filterContacts } from "@/components/contacts/contact-form";
import type {
  ContactApiErrorResponse,
  ContactListResponse,
} from "@/components/contacts/types";
import type { Contact, ContactSummary } from "@/types/contact";

export function ContactListPage() {
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | Contact["status"]>("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let isCancelled = false;

    async function loadContacts() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/contacts?limit=100", {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | ContactListResponse
          | ContactApiErrorResponse;

        if (!response.ok) {
          const errorPayload = payload as ContactApiErrorResponse;
          throw new Error(
            errorPayload.error?.message ?? "Unable to load contacts.",
          );
        }

        if (!isCancelled) {
          setContacts((payload as ContactListResponse).contacts);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load contacts.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContacts();

    return () => {
      isCancelled = true;
    };
  }, []);

  const filteredContacts = useMemo(
    () => filterContacts(contacts, { search: deferredSearch, status }),
    [contacts, deferredSearch, status],
  );

  return (
    <section className="space-y-6">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Contacts
        </p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
              Manage contact records
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Keep operational contacts current so locations, clients, and
              work-order workflows all reference the same persisted people.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[32rem]">
            <label className="text-sm font-medium text-neutral-700">
              Search contacts
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, phone, or title"
                type="search"
                value={search}
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              Status
              <select
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
                onChange={(event) =>
                  setStatus(event.target.value as "" | Contact["status"])
                }
                value={status}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            href="/contacts/new"
          >
            Create contact
          </Link>
        </div>
      </section>

      {errorMessage ? <ActionFeedback message={errorMessage} /> : null}

      <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <p className="text-sm text-neutral-600">Loading contacts...</p>
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-neutral-950">
              No contacts found
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Adjust the filters or create a new contact to build your directory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Primary phone</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Language</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Updated</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredContacts.map((contact) => (
                  <tr className="hover:bg-neutral-50" key={contact.id}>
                    <td className="px-6 py-4 align-top">
                      <p className="font-semibold text-neutral-950">
                        {contact.displayName}
                      </p>
                    </td>
                    <td className="px-6 py-4 align-top text-neutral-700">
                      {contact.email || "Not set"}
                    </td>
                    <td className="px-6 py-4 align-top text-neutral-700">
                      {contact.primaryPhone || "Not set"}
                    </td>
                    <td className="px-6 py-4 align-top text-neutral-700">
                      {contact.roleTitle || "Not set"}
                    </td>
                    <td className="px-6 py-4 align-top text-neutral-700 uppercase">
                      {contact.preferredLanguage}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <ContactStatusBadge status={contact.status} />
                    </td>
                    <td className="px-6 py-4 align-top text-neutral-700">
                      {contact.status === "archived" ? "Archived" : "Current"}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <Link
                        className="inline-flex rounded-full border border-neutral-300 px-4 py-2 font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
                        href={`/contacts/${contact.id}/edit`}
                      >
                        Edit
                      </Link>
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
