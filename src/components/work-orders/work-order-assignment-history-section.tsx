"use client";

import { AssignmentHistory, type AssignmentHistoryItem } from "./assignment-history";

export function WorkOrderAssignmentHistorySection({
  assignments,
}: {
  assignments: AssignmentHistoryItem[];
}) {
  return (
    <section
      aria-labelledby="history-audit-assignment-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-neutral-950" id="history-audit-assignment-heading">
          Assignment History
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Contractor and internal assignment changes, timing, and dispatch notes.
        </p>
      </div>
      <AssignmentHistory assignments={assignments} title={null} />
    </section>
  );
}
