"use client";

import type { LocationSummary } from "@/components/locations/types";

interface LocationSelectorProps {
  disabled?: boolean;
  error?: string;
  locations: LocationSummary[];
  onChange: (value: string) => void;
  selectedClientOrganizationId: string;
  value: string;
}

export function LocationSelector({
  disabled = false,
  error,
  locations,
  onChange,
  selectedClientOrganizationId,
  value,
}: LocationSelectorProps) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      Location<span className="text-rose-700"> *</span>
      <select
        className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
        disabled={disabled}
        name="locationId"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">
          {!selectedClientOrganizationId
            ? "Choose a client organization first"
            : locations.length === 0
              ? "No active locations available for this client"
              : "Select a location"}
        </option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.code ? `${location.name} (${location.code})` : location.name}
          </option>
        ))}
      </select>
      {error ? (
        <span className="mt-1 block text-xs text-rose-700">{error}</span>
      ) : null}
    </label>
  );
}
