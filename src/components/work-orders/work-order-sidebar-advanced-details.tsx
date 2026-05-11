import type { ReactNode } from "react";

interface WorkOrderSidebarAdvancedDetailsProps {
  children: ReactNode;
}

export function WorkOrderSidebarAdvancedDetails({
  children,
}: WorkOrderSidebarAdvancedDetailsProps) {
  return (
    <details className="rounded-xl border border-neutral-200 bg-neutral-50/80">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-neutral-700 marker:hidden">
        Technical metadata
      </summary>
      <div className="border-t border-neutral-200 px-3 py-2">{children}</div>
    </details>
  );
}
