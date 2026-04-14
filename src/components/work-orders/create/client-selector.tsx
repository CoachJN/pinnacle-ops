"use client";

import type { ClientOrganizationSummary } from "@/components/client-organizations/types";

interface ClientSelectorProps {
  clients: ClientOrganizationSummary[];
  error?: string;
  onChange: (value: string) => void;
  value: string;
}

export function ClientSelector({
  clients,
  error,
  onChange,
  value,
}: ClientSelectorProps) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      Client organization<span className="text-rose-700"> *</span>
      <select
        className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        name="clientOrganizationId"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">
          {clients.length === 0
            ? "No active client organizations available"
            : "Select a client organization"}
        </option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.displayName ?? client.name}
          </option>
        ))}
      </select>
      {error ? (
        <span className="mt-1 block text-xs text-rose-700">{error}</span>
      ) : null}
    </label>
  );
}
