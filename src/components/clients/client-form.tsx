"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ClientOrganization } from "@/types/client";
import type { InternalUserRole } from "@/types/permissions";
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from "@/lib/clients/actions";
import { FormSubmitButton } from "@/components/work-orders/form-submit-button";

const emptyState: ClientFormState = { ok: false };

export function ClientForm({
  mode,
  role,
  client,
}: {
  mode: "create" | "edit";
  role: InternalUserRole;
  client?: ClientOrganization;
}) {
  const action = mode === "create" ? createClientAction : updateClientAction;
  const [state, formAction] = useActionState(action, emptyState);

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
      <input type="hidden" name="actorRole" value={role} />
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      {state.message ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.message}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Client name" name="name" defaultValue={client?.name} error={state.errors?.name} required />
        <StatusField defaultValue={client?.status ?? "active"} error={state.errors?.status} />
        <TextField label="Primary contact name" name="primaryContactName" defaultValue={client?.primaryContactName} error={state.errors?.primaryContactName} required />
        <TextField label="Primary contact phone" name="primaryContactPhone" defaultValue={client?.primaryContactPhone} error={state.errors?.primaryContactPhone} required />
        <TextField label="Primary contact email" name="primaryContactEmail" type="email" defaultValue={client?.primaryContactEmail} error={state.errors?.primaryContactEmail} />
        <TextareaField label="Notes" name="notes" defaultValue={client?.notes} error={state.errors?.notes} />
      </div>
      <div className="flex flex-wrap gap-3">
        <FormSubmitButton pendingLabel={mode === "create" ? "Creating..." : "Saving..."}>
          {mode === "create" ? "Create client" : "Save changes"}
        </FormSubmitButton>
        <Link
          href={client ? `/clients/${client.id}?role=${role}` : `/clients?role=${role}`}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  error,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      {required ? <span className="text-rose-700"> *</span> : null}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      />
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700 md:col-span-2">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={4}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      />
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

function StatusField({
  defaultValue,
  error,
}: {
  defaultValue: string;
  error?: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      Status
      <select
        name="status"
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}
