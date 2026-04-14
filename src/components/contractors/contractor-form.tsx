"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Contractor } from "@/types/contractor";
import type { InternalUserRole } from "@/types/permissions";
import {
  createContractorAction,
  updateContractorAction,
  type ContractorFormState,
} from "@/lib/contractors/actions";
import { FormSubmitButton } from "@/components/work-orders/form-submit-button";

const emptyState: ContractorFormState = { ok: false };

export function ContractorForm({
  mode,
  role,
  contractor,
}: {
  mode: "create" | "edit";
  role: InternalUserRole;
  contractor?: Contractor;
}) {
  const action =
    mode === "create" ? createContractorAction : updateContractorAction;
  const [state, formAction] = useActionState(action, emptyState);

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
      <input type="hidden" name="actorRole" value={role} />
      {contractor ? <input type="hidden" name="id" value={contractor.id} /> : null}
      {state.message ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.message}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Company name" name="companyName" defaultValue={contractor?.companyName} error={state.errors?.companyName} required />
        <StatusField defaultValue={contractor?.status ?? "active"} error={state.errors?.status} />
        <TextField label="Contact name" name="contactName" defaultValue={contractor?.contactName} error={state.errors?.contactName} required />
        <TextField label="Email" name="email" type="email" defaultValue={contractor?.email} error={state.errors?.email} required />
        <TextField label="Phone" name="phone" defaultValue={contractor?.phone} error={state.errors?.phone} required />
        <TextField label="Service categories" name="serviceCategories" defaultValue={contractor?.serviceCategories.join(", ")} error={state.errors?.serviceCategories} />
        <TextareaField label="Internal notes" name="notes" defaultValue={contractor?.notes} error={state.errors?.notes} />
      </div>
      <div className="flex flex-wrap gap-3">
        <FormSubmitButton pendingLabel={mode === "create" ? "Creating..." : "Saving..."}>
          {mode === "create" ? "Create contractor" : "Save changes"}
        </FormSubmitButton>
        <Link href={contractor ? `/contractors/${contractor.id}?role=${role}` : `/contractors?role=${role}`} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500">
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
      <input name={name} type={type} defaultValue={defaultValue ?? ""} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none" />
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
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={4} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none" />
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
      <select name="status" defaultValue={defaultValue} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none">
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}
