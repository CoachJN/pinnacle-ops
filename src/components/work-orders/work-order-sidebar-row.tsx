import type { ReactNode } from "react";

interface WorkOrderSidebarRowProps {
  label: string;
  value: ReactNode;
}

export function WorkOrderSidebarRow({
  label,
  value,
}: WorkOrderSidebarRowProps) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 py-1.5 text-sm">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium leading-5 text-neutral-950">
        {value}
      </dd>
    </div>
  );
}
