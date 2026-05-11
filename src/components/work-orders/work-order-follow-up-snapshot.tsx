import { formatDateTime } from "./formatting";
import type { DerivedWorkOrderFollowUpSnapshot } from "./work-order-communication-model";

interface WorkOrderFollowUpSnapshotProps {
  snapshot: DerivedWorkOrderFollowUpSnapshot;
}

export function WorkOrderFollowUpSnapshot({
  snapshot,
}: WorkOrderFollowUpSnapshotProps) {
  return (
    <section
      aria-labelledby="work-order-follow-up-snapshot-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className="text-lg font-semibold text-neutral-950"
            id="work-order-follow-up-snapshot-heading"
          >
            Follow-up Snapshot
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Display-only guidance based on recorded activity, not reminder or scheduling state.
          </p>
        </div>
        <span
          className={
            snapshot.status === "Follow-up stale"
              ? "inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
              : "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
          }
        >
          {snapshot.status}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <Metric label="Last recorded activity" value={formatDateTime(snapshot.lastActivityAt)} />
        <Metric
          label="Days since activity"
          value={snapshot.lastActivityDays === null ? "Not set" : String(snapshot.lastActivityDays)}
        />
      </dl>

      <ul className="mt-4 space-y-2">
        {snapshot.guidance.map((item) => (
          <li
            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
            key={item}
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-medium text-neutral-950">{value}</dd>
    </div>
  );
}
