"use client";

import {
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_CATEGORY_LABELS,
  type WorkOrderCategory,
} from "@/modules/work-orders";

interface CategorySelectorProps {
  error?: string;
  onChange: (value: WorkOrderCategory) => void;
  value: WorkOrderCategory;
}

export function CategorySelector({
  error,
  onChange,
  value,
}: CategorySelectorProps) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      Category<span className="text-rose-700"> *</span>
      <select
        className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        name="category"
        onChange={(event) => onChange(event.target.value as WorkOrderCategory)}
        value={value}
      >
        {WORK_ORDER_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {WORK_ORDER_CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>
      {error ? (
        <span className="mt-1 block text-xs text-rose-700">{error}</span>
      ) : null}
    </label>
  );
}
