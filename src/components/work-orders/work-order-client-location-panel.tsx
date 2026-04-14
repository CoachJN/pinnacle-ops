interface WorkOrderClientLocationPanelProps {
  clientDisplayName: string;
  clientId: string;
  locationName: string;
  locationId: string;
  locationCode?: string;
}

export function WorkOrderClientLocationPanel({
  clientDisplayName,
  clientId,
  locationName,
  locationId,
  locationCode,
}: WorkOrderClientLocationPanelProps) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-950">Client and location</h2>
      <dl className="mt-5 space-y-4">
        <DetailRow label="Client" value={clientDisplayName} />
        <DetailRow label="Client ID" value={clientId} />
        <DetailRow label="Location" value={locationName} />
        <DetailRow label="Location ID" value={locationId} />
        <DetailRow label="Location code" value={locationCode ?? "Not set"} />
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
