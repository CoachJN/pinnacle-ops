import type { ReactNode } from "react";

interface WorkOrderEmptyStateProps {
  actions?: ReactNode;
  message: string;
  title: string;
}

export function WorkOrderEmptyState({
  actions,
  message,
  title,
}: WorkOrderEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5">
      <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-neutral-600">{message}</p>
      {actions ? (
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
