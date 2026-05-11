import type { ReactNode } from "react";

interface WorkOrderCompactRowProps {
  label: string;
  value: ReactNode;
}

export function WorkOrderCompactRow({
  label,
  value,
}: WorkOrderCompactRowProps) {
  return (
    <div className="min-w-0 py-2">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm font-medium leading-5 text-neutral-950">
        {value}
      </dd>
    </div>
  );
}
