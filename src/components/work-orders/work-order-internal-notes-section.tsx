import { formatDateTime } from "./formatting";
import type { WorkOrderNoteSnapshot } from "./work-order-display-model";

interface WorkOrderInternalNotesSectionProps {
  notes: WorkOrderNoteSnapshot[];
}

export function WorkOrderInternalNotesSection({
  notes,
}: WorkOrderInternalNotesSectionProps) {
  const recentNotes = [...notes].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

  return (
    <section
      aria-labelledby="work-order-internal-notes-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2
        className="text-lg font-semibold text-neutral-950"
        id="work-order-internal-notes-heading"
      >
        Internal Notes
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Internal-only operational context stays editable from the workflow note flow and readable
        here as the deeper communication record.
      </p>

      {recentNotes.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
          No internal notes recorded yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {recentNotes.map((note) => (
            <article
              className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-4"
              key={note.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-950">
                    {note.authorDisplayName}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                    {note.body}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-neutral-500">
                  {formatDateTime(note.updatedAt)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
