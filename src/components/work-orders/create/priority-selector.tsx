"use client";

import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_LABELS,
  type WorkOrderPriority,
} from "@/modules/work-orders";

interface PrioritySelectorProps {
  error?: string;
  onChange: (value: WorkOrderPriority) => void;
  value: WorkOrderPriority;
}

export function PrioritySelector({
  error,
  onChange,
  value,
}: PrioritySelectorProps) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      Priority<span className="text-rose-700"> *</span>
      <select
        className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        name="priority"
        onChange={(event) => onChange(event.target.value as WorkOrderPriority)}
        value={value}
      >
        {WORK_ORDER_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {WORK_ORDER_PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>
      {error ? (
        <span className="mt-1 block text-xs text-rose-700">{error}</span>
      ) : null}
    </label>
  );
}
