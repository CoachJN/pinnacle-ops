import type { ReactNode } from "react";

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-neutral-200 py-6">
      <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function DetailField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <dt className="text-sm font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-neutral-950">
        {value || <span className="text-neutral-400">Not set</span>}
      </dd>
    </div>
  );
}
