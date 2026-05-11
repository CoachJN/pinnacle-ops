import type { ReactNode } from "react";

interface WorkOrderSectionHeaderProps {
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}

export function WorkOrderSectionHeader({
  action,
  description,
  eyebrow,
  title,
}: WorkOrderSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-5 text-neutral-600">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
