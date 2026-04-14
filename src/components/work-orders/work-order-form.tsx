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
  defaultClientId,
  lockClientSelection = false,
}: {
  mode: "create" | "edit";
  role: InternalUserRole;
  workOrder?: PhaseOneWorkOrder;
  clients: ClientOrganization[];
  locations: Location[];
  defaultClientId?: string;
  lockClientSelection?: boolean;
}) {
  const action = mode === "create" ? createWorkOrderAction : updateWorkOrderAction;
  const [state, formAction] = useActionState(action, emptyState);
  const selectableClients = useMemo(
    () =>
      clients.filter(
        (client) =>
          client.status === "active" || (mode === "edit" && client.id === workOrder?.clientId),
      ),
    [clients, mode, workOrder?.clientId],
  );
  const initialClientId = workOrder?.clientId ?? defaultClientId ?? "";
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const selectedClient = selectableClients.find((client) => client.id === selectedClientId) ?? null;
  const selectableLocations = useMemo(
    () =>
      locations.filter((location) => {
        if (location.clientId !== selectedClientId) {
          return false;
        }

        if (location.status === "active") {
          return true;
        }

        return mode === "edit" && location.id === workOrder?.locationId;
      }),
    [locations, mode, selectedClientId, workOrder?.locationId],
  );
  const initialLocationId = workOrder?.locationId ?? "";
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId);
  const selectedLocation =
    selectableLocations.find((location) => location.id === selectedLocationId) ?? null;
  const hasClients = selectableClients.length > 0;
  const hasLocationsForClient = selectableLocations.length > 0;

  function handleClientChange(nextClientId: string) {
    setSelectedClientId(nextClientId);
    setSelectedLocationId((currentLocationId) => {
      if (!nextClientId) {
        return "";
      }

      const nextLocations = locations.filter((location) => {
        if (location.clientId !== nextClientId) {
          return false;
        }

        if (location.status === "active") {
          return true;
        }

        return mode === "edit" && location.id === workOrder?.locationId;
      });

      if (nextLocations.some((location) => location.id === currentLocationId)) {
        return currentLocationId;
      }

      const preservedLocationId =
        mode === "edit" && nextClientId === workOrder?.clientId ? workOrder.locationId : "";

      return nextLocations.some((location) => location.id === preservedLocationId)
        ? preservedLocationId
        : "";
    });
  }

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
      <input type="hidden" name="actorRole" value={role} />
      {workOrder ? <input type="hidden" name="id" value={workOrder.id} /> : null}
      {mode === "edit" ? (
        <>
          <input type="hidden" name="currentClientId" value={workOrder?.clientId ?? ""} />
          <input type="hidden" name="currentLocationId" value={workOrder?.locationId ?? ""} />
        </>
      ) : null}
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
          clients={selectableClients}
          value={selectedClientId}
          error={state.errors?.clientId}
          role={role}
          disabled={lockClientSelection}
          onClientChange={handleClientChange}
        />
        <LocationSelectField
          locations={selectableLocations}
          value={selectedLocationId}
          error={state.errors?.locationId}
          role={role}
          selectedClientId={selectedClientId}
          onLocationChange={setSelectedLocationId}
        />
        {selectedLocation ? (
          <LocationSummaryCard
            clientName={selectedClient?.name ?? "Unknown client organization"}
            location={selectedLocation}
          />
        ) : null}
        {!hasClients ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:col-span-2">
            Create an active client organization before opening a new work order.
            <Link className="ml-2 font-semibold underline" href={`/clients/new?role=${role}`}>
              Create client
            </Link>
          </div>
        ) : null}
        {hasClients && selectedClientId && !hasLocationsForClient ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:col-span-2">
            This client organization has no active locations available for new work orders.
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
  value,
  error,
  role,
  disabled,
  onClientChange,
}: {
  clients: ClientOrganization[];
  value: string;
  error?: string;
  role: InternalUserRole;
  disabled: boolean;
  onClientChange: (clientId: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      Client organization<span className="text-rose-700"> *</span>
      {disabled ? <input type="hidden" name="clientId" value={value} /> : null}
      <select
        name={disabled ? undefined : "clientId"}
        value={value}
        onChange={(event) => onClientChange(event.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none disabled:bg-neutral-100"
      >
        <option value="">
          {clients.length === 0 ? "No active client organizations available" : "Select a client organization"}
        </option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
            {client.status === "inactive" ? " (inactive)" : ""}
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
  value,
  error,
  role,
  selectedClientId,
  onLocationChange,
}: {
  locations: Location[];
  value: string;
  error?: string;
  role: InternalUserRole;
  selectedClientId: string;
  onLocationChange: (locationId: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      Location<span className="text-rose-700"> *</span>
      <select
        name="locationId"
        value={value}
        onChange={(event) => onLocationChange(event.target.value)}
        disabled={!selectedClientId || locations.length === 0}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      >
        <option value="">
          {!selectedClientId
            ? "Choose a client organization first"
            : locations.length === 0
              ? "No valid locations for this client organization"
              : "Select a location"}
        </option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
            {location.status === "inactive" ? " (inactive)" : ""}
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

function LocationSummaryCard({
  clientName,
  location,
}: {
  clientName: string;
  location: Location;
}) {
  const address = [
    location.addressLine1,
    location.addressLine2,
    location.city,
    location.provinceOrState,
    location.postalCode,
    location.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-lg border border-neutral-200 bg-stone-50 p-4 text-sm text-neutral-700 md:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-neutral-950">{location.name}</p>
        <span
          className={
            location.status === "active"
              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
              : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
          }
        >
          {location.status === "active" ? "Active location" : "Inactive legacy location"}
        </span>
      </div>
      <p className="mt-1 text-neutral-600">{clientName}</p>
      <p className="mt-2">{address}</p>
      <p className="mt-2">
        Contact: {location.locationContactName} {location.locationContactPhone ? `• ${location.locationContactPhone}` : ""}
      </p>
    </div>
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
