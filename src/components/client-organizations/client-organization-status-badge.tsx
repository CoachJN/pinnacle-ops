export function ClientOrganizationStatusBadge({
  status,
}: {
  status: "active" | "inactive";
}) {
  const className =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-neutral-300 bg-neutral-100 text-neutral-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${className}`}
    >
      {status}
    </span>
  );
}
