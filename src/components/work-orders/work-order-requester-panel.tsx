interface WorkOrderRequesterPanelProps {
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
}

export function WorkOrderRequesterPanel({
  requesterName,
  requesterEmail,
  requesterPhone,
}: WorkOrderRequesterPanelProps) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-950">Requester</h2>
      <dl className="mt-5 space-y-4">
        <DetailRow label="Name" value={requesterName} />
        <DetailRow label="Email" value={requesterEmail ?? "Not provided"} />
        <DetailRow label="Phone" value={requesterPhone ?? "Not provided"} />
      </dl>
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm text-neutral-900">{value}</dd>
    </div>
  );
}
