import type { ReactNode } from "react";

interface WorkOrderSidebarGridProps {
  children: ReactNode;
}

export function WorkOrderSidebarGrid({ children }: WorkOrderSidebarGridProps) {
  return (
    <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-1">
      {children}
    </dl>
  );
}
