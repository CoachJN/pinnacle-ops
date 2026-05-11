import type { ReactNode } from "react";

interface WorkOrderSidebarSectionProps {
  children: ReactNode;
  title: string;
}

export function WorkOrderSidebarSection({
  children,
  title,
}: WorkOrderSidebarSectionProps) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {title}
      </h2>
      {children}
    </section>
  );
}
