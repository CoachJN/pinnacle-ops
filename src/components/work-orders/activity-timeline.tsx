import type { ActivityEntry } from "@/types/work-order";
import { formatDateTime } from "./formatting";

export function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600">
        No activity yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-neutral-950">{entry.message}</p>
            <time className="text-xs text-neutral-500" dateTime={entry.createdAt}>
              {formatDateTime(entry.createdAt)}
            </time>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {entry.actorName} · {entry.actorRole}
          </p>
        </li>
      ))}
    </ol>
  );
}
