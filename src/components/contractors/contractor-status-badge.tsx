import { CONTRACTOR_STATUS_LABELS, type ContractorStatus } from "@/types/contractor";

const toneByStatus: Record<ContractorStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  inactive: "border-neutral-200 bg-neutral-100 text-neutral-700",
  onboarding: "border-amber-200 bg-amber-50 text-amber-800",
  suspended: "border-rose-200 bg-rose-50 text-rose-800",
};

export function ContractorStatusBadge({
  status,
}: {
  status: ContractorStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneByStatus[status]}`}
    >
      {CONTRACTOR_STATUS_LABELS[status]}
    </span>
  );
}
