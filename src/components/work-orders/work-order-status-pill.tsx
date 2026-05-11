interface WorkOrderStatusPillProps {
  children: string;
  tone?: "default" | "critical" | "muted" | "positive" | "warning";
}

const toneClassNames: Record<
  NonNullable<WorkOrderStatusPillProps["tone"]>,
  string
> = {
  default: "border-neutral-300 bg-white text-neutral-700",
  critical: "border-rose-200 bg-rose-50 text-rose-800",
  muted: "border-neutral-200 bg-neutral-100 text-neutral-600",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

export function WorkOrderStatusPill({
  children,
  tone = "default",
}: WorkOrderStatusPillProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClassNames[tone]}`}
    >
      {children}
    </span>
  );
}
