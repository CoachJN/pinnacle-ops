interface WorkOrderOverviewPanelProps {
  description: string;
  statusLabel: string;
  priorityLabel: string;
  categoryLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  dueDateLabel: string;
  closedAtLabel: string;
}

export function WorkOrderOverviewPanel({
  description,
  statusLabel,
  priorityLabel,
  categoryLabel,
  createdAtLabel,
  updatedAtLabel,
  dueDateLabel,
  closedAtLabel,
}: WorkOrderOverviewPanelProps) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-950">Overview</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
        {description}
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <DetailItem label="Status" value={statusLabel} />
        <DetailItem label="Priority" value={priorityLabel} />
        <DetailItem label="Category" value={categoryLabel} />
        <DetailItem label="Due date" value={dueDateLabel} />
        <DetailItem label="Created at" value={createdAtLabel} />
        <DetailItem label="Updated at" value={updatedAtLabel} />
        <DetailItem label="Closed at" value={closedAtLabel} />
      </dl>
    </section>
  );
}

function DetailItem({
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
      <dd className="mt-2 text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  );
}
