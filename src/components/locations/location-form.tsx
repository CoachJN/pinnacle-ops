"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ClientOrganization, Location } from "@/types/client";
import type { InternalUserRole } from "@/types/permissions";
import {
  createLocationAction,
  updateLocationAction,
  type LocationFormState,
} from "@/lib/locations/actions";
import { FormSubmitButton } from "@/components/work-orders/form-submit-button";

const emptyState: LocationFormState = { ok: false };

export function LocationForm({
  mode,
  role,
  clients,
  location,
  defaultClientId,
  canReassignClient,
}: {
  mode: "create" | "edit";
  role: InternalUserRole;
  clients: ClientOrganization[];
  location?: Location;
  defaultClientId?: string;
  canReassignClient?: boolean;
}) {
  const action = mode === "create" ? createLocationAction : updateLocationAction;
  const [state, formAction] = useActionState(action, emptyState);
  const selectedClientId = location?.clientId ?? defaultClientId ?? clients[0]?.id ?? "";
  const clientLocked = mode === "edit" && canReassignClient === false;

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
      <input type="hidden" name="actorRole" value={role} />
      {location ? <input type="hidden" name="id" value={location.id} /> : null}
      {clientLocked ? <input type="hidden" name="clientId" value={selectedClientId} /> : null}
      {state.message ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.message}
        </div>
      ) : null}
      {clientLocked ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Client is read-only because work orders already reference this location.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <ClientSelect clients={clients} defaultValue={selectedClientId} error={state.errors?.clientId} disabled={clientLocked} />
        <StatusField defaultValue={location?.status ?? "active"} error={state.errors?.status} />
        <TextField label="Location name" name="name" defaultValue={location?.name} error={state.errors?.name} required />
        <TextField label="Address line 1" name="addressLine1" defaultValue={location?.addressLine1} error={state.errors?.addressLine1} required />
        <TextField label="Address line 2" name="addressLine2" defaultValue={location?.addressLine2} error={state.errors?.addressLine2} />
        <TextField label="City" name="city" defaultValue={location?.city} error={state.errors?.city} required />
        <TextField label="Province/state" name="provinceOrState" defaultValue={location?.provinceOrState} error={state.errors?.provinceOrState} required />
        <TextField label="Postal code" name="postalCode" defaultValue={location?.postalCode} error={state.errors?.postalCode} required />
        <TextField label="Country" name="country" defaultValue={location?.country ?? "Canada"} error={state.errors?.country} required />
        <TextField label="Location contact name" name="locationContactName" defaultValue={location?.locationContactName} error={state.errors?.locationContactName} required />
        <TextField label="Location contact phone" name="locationContactPhone" defaultValue={location?.locationContactPhone} error={state.errors?.locationContactPhone} required />
        <TextField label="Location contact email" name="locationContactEmail" type="email" defaultValue={location?.locationContactEmail} error={state.errors?.locationContactEmail} />
        <TextareaField label="Access notes" name="accessNotes" defaultValue={location?.accessNotes} error={state.errors?.accessNotes} />
      </div>
      <div className="flex flex-wrap gap-3">
        <FormSubmitButton pendingLabel={mode === "create" ? "Creating..." : "Saving..."}>
          {mode === "create" ? "Create location" : "Save changes"}
        </FormSubmitButton>
        <Link
          href={location ? `/locations/${location.id}?role=${role}` : `/locations?role=${role}`}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function ClientSelect({
  clients,
  defaultValue,
  error,
  disabled,
}: {
  clients: ClientOrganization[];
  defaultValue: string;
  error?: string;
  disabled: boolean;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      Client<span className="text-rose-700"> *</span>
      <select
        name={disabled ? undefined : "clientId"}
        defaultValue={defaultValue}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none disabled:bg-neutral-100"
      >
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
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
