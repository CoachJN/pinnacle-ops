import type { ContactStatus } from "@/types/contact";

const STATUS_CLASS_NAMES: Record<ContactStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  inactive: "border-neutral-200 bg-neutral-100 text-neutral-700",
  archived: "border-amber-200 bg-amber-50 text-amber-800",
};

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_CLASS_NAMES[status]}`}
    >
      {status}
    </span>
  );
}
