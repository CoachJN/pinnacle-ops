"use client";

import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@/modules/work-orders";

interface FilterOption {
  id: string;
  label: string;
}

interface WorkOrderFiltersProps {
  clientOrganizations: FilterOption[];
  isLoading: boolean;
  locations: FilterOption[];
  onClientOrganizationChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onPriorityChange: (value: "" | WorkOrderPriority) => void;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: "" | WorkOrderStatus) => void;
  search: string;
  selectedClientOrganizationId: string;
  selectedLocationId: string;
  selectedPriority: "" | WorkOrderPriority;
  selectedStatus: "" | WorkOrderStatus;
}

export function WorkOrderFilters({
  clientOrganizations,
  isLoading,
  locations,
  onClientOrganizationChange,
  onLocationChange,
  onPriorityChange,
  onReset,
  onSearchChange,
  onStatusChange,
  search,
  selectedClientOrganizationId,
  selectedLocationId,
  selectedPriority,
  selectedStatus,
}: WorkOrderFiltersProps) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))]">
        <label className="text-sm font-medium text-neutral-700">
          Search
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search work order number or title"
            type="search"
            value={search}
          />
        </label>

        <label className="text-sm font-medium text-neutral-700">
          Status
          <select
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
            onChange={(event) =>
              onStatusChange(event.target.value as "" | WorkOrderStatus)
            }
            value={selectedStatus}
          >
            <option value="">All statuses</option>
            {WORK_ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {WORK_ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-neutral-700">
          Priority
          <select
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
            onChange={(event) =>
              onPriorityChange(event.target.value as "" | WorkOrderPriority)
            }
            value={selectedPriority}
          >
            <option value="">All priorities</option>
            {WORK_ORDER_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {WORK_ORDER_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-neutral-700">
          Client organization
          <select
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
            disabled={isLoading}
            onChange={(event) => onClientOrganizationChange(event.target.value)}
            value={selectedClientOrganizationId}
          >
            <option value="">All clients</option>
            {clientOrganizations.map((clientOrganization) => (
              <option key={clientOrganization.id} value={clientOrganization.id}>
                {clientOrganization.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-neutral-700">
          Location
          <select
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500 disabled:cursor-not-allowed disabled:bg-neutral-100"
            disabled={isLoading}
            onChange={(event) => onLocationChange(event.target.value)}
            value={selectedLocationId}
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
          onClick={onReset}
          type="button"
        >
          Clear filters
        </button>
        <p className="text-sm text-neutral-500">
          Filters sync with the URL and preserve state on refresh.
        </p>
      </div>
    </section>
  );
}
