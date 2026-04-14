"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { ClientOrganization, Location } from "@/types/client";
import type { InternalUserRole } from "@/types/permissions";
import type { PhaseOneWorkOrder } from "@/types/work-order";
import { WORK_ORDER_PRIORITIES, WORK_ORDER_PRIORITY_LABELS } from "@/lib/work-orders/constants";
import {
  createWorkOrderAction,
  updateWorkOrderAction,
  type WorkOrderFormState,
} from "@/lib/work-orders/actions";
import { toDateInputValue } from "./formatting";
import { FormSubmitButton } from "./form-submit-button";

const emptyState: WorkOrderFormState = {
  ok: false,
};

export function WorkOrderForm({
  mode,
  role,
  workOrder,
  clients,
  locations,
}: {
  mode: "create" | "edit";
  role: InternalUserRole;
  workOrder?: PhaseOneWorkOrder;
  clients: ClientOrganization[];
  locations: Location[];
}) {
  const action = mode === "create" ? createWorkOrderAction : updateWorkOrderAction;
  const [state, formAction] = useActionState(action, emptyState);
  const initialClientId = workOrder?.clientId ?? clients[0]?.id ?? "";
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const selectedClientLocations = useMemo(
    () => locations.filter((location) => location.clientId === selectedClientId),
    [locations, selectedClientId],
  );
  const hasClients = clients.length > 0;
  const hasLocationsForClient = selectedClientLocations.length > 0;

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
      <input type="hidden" name="actorRole" value={role} />
      {workOrder ? <input type="hidden" name="id" value={workOrder.id} /> : null}
      {state.message ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Title" name="title" defaultValue={workOrder?.title} error={state.errors?.title} required />
        <SelectField label="Priority" name="priority" defaultValue={workOrder?.priority ?? "medium"} error={state.errors?.priority} />
        <TextareaField label="Description" name="description" defaultValue={workOrder?.description} error={state.errors?.description} required fullWidth />
        <ClientSelectField
          clients={clients}
          defaultValue={initialClientId}
          error={state.errors?.clientId}
          role={role}
          onClientChange={setSelectedClientId}
        />
        <LocationSelectField
          locations={selectedClientLocations}
          defaultValue={
            workOrder?.locationId &&
            selectedClientLocations.some((location) => location.id === workOrder.locationId)
              ? workOrder.locationId
              : selectedClientLocations[0]?.id ?? ""
          }
          error={state.errors?.locationId}
          role={role}
          selectedClientId={selectedClientId}
        />
        {!hasClients ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:col-span-2">
            Create a client before opening a new work order.
            <Link className="ml-2 font-semibold underline" href={`/clients/new?role=${role}`}>
              Create client
            </Link>
          </div>
        ) : null}
        {hasClients && !hasLocationsForClient ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:col-span-2">
            This client has no locations yet.
            <Link
              className="ml-2 font-semibold underline"
              href={`/locations/new?clientId=${selectedClientId}&role=${role}`}
            >
              Create location
            </Link>
          </div>
        ) : null}
        <TextField label="Requested service date" name="requestedServiceDate" type="date" defaultValue={toDateInputValue(workOrder?.requestedServiceDate ?? null)} error={state.errors?.requestedServiceDate} />
        <TextField label="Category" name="category" defaultValue={workOrder?.category ?? ""} error={state.errors?.category} />
        <TextField label="Assigned coordinator" name="assignedCoordinatorName" defaultValue={workOrder?.assignedCoordinatorName ?? ""} error={state.errors?.assignedCoordinatorName} />
        <TextField label="Assigned manager" name="assignedManagerName" defaultValue={workOrder?.assignedManagerName ?? ""} error={state.errors?.assignedManagerName} />
        <TextareaField label="Internal notes" name="internalNotes" defaultValue={workOrder?.internalNotes ?? ""} error={state.errors?.internalNotes} fullWidth />
        {mode === "edit" ? (
          <TextareaField label="Completion notes" name="completionNotes" defaultValue={workOrder?.completionNotes ?? ""} error={state.errors?.completionNotes} fullWidth />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <FormSubmitButton pendingLabel={mode === "create" ? "Creating..." : "Saving..."}>
          {mode === "create" ? "Create work order" : "Save changes"}
        </FormSubmitButton>
        <Link
          href={workOrder ? `/work-orders/${workOrder.id}?role=${role}` : `/work-orders?role=${role}`}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function ClientSelectField({
  clients,
  defaultValue,
  error,
  role,
  onClientChange,
}: {
  clients: ClientOrganization[];
  defaultValue: string;
  error?: string;
  role: InternalUserRole;
  onClientChange: (clientId: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      Client<span className="text-rose-700"> *</span>
      <select
        name="clientId"
        defaultValue={defaultValue}
        onChange={(event) => onClientChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      >
        {clients.length === 0 ? <option value="">No clients available</option> : null}
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
      {clients.length === 0 ? (
        <Link href={`/clients/new?role=${role}`} className="mt-1 block text-xs font-semibold text-neutral-700 underline">
          Create a client
        </Link>
      ) : null}
    </label>
  );
}

function LocationSelectField({
  locations,
  defaultValue,
  error,
  role,
  selectedClientId,
}: {
  locations: Location[];
  defaultValue: string;
  error?: string;
  role: InternalUserRole;
  selectedClientId: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      Location<span className="text-rose-700"> *</span>
      <select
        key={selectedClientId}
        name="locationId"
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      >
        {locations.length === 0 ? <option value="">No locations for this client</option> : null}
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
      {selectedClientId && locations.length === 0 ? (
        <Link
          href={`/locations/new?clientId=${selectedClientId}&role=${role}`}
          className="mt-1 block text-xs font-semibold text-neutral-700 underline"
        >
          Create a location
        </Link>
      ) : null}
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
  required = false,
  fullWidth = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <label className={fullWidth ? "text-sm font-medium text-neutral-700 md:col-span-2" : "text-sm font-medium text-neutral-700"}>
      {label}
      {required ? <span className="text-rose-700"> *</span> : null}
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

function SelectField({
  label,
  name,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}<span className="text-rose-700"> *</span>
      <select
        name={name}
        defaultValue={defaultValue ?? "medium"}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      >
        {WORK_ORDER_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {WORK_ORDER_PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}
