import type { ReactNode } from "react";

interface WorkOrderSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function WorkOrderSection({
  children,
  className,
  id,
}: WorkOrderSectionProps) {
  return (
    <section
      className={[
        "rounded-2xl border border-neutral-200/80 bg-white px-4 py-4 sm:px-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      id={id}
    >
      {children}
    </section>
  );
}
