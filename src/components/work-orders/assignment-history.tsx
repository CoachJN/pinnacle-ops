"use client";

import { formatDate, formatDateTime } from "./formatting";

export interface AssignmentHistoryItem {
  id: string;
  assigneeDisplayName: string;
  assignedByDisplayName: string;
  status: "assigned" | "accepted" | "declined" | "completed" | "cancelled";
  notes: string | null;
  scheduledDate: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  completedAt: string | null;
}

export function AssignmentHistory({
  assignments,
}: {
  assignments: AssignmentHistoryItem[];
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
        Assignment history
      </h3>
      {assignments.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">
          No assignment history has been recorded for this work order.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {assignments.map((assignment) => {
            const resolutionLabel =
              assignment.completedAt ??
              assignment.declinedAt ??
              assignment.acceptedAt;

            return (
              <li
                key={assignment.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-neutral-950">
                      {assignment.assigneeDisplayName}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {assignment.status.replaceAll("_", " ")} • assigned by{" "}
                      {assignment.assignedByDisplayName}
                    </p>
                    <p className="text-sm text-neutral-600">
                      Scheduled: {formatDate(assignment.scheduledDate)}
                    </p>
                    <p className="text-sm text-neutral-600">
                      Notes: {assignment.notes ?? "No notes provided."}
                    </p>
                    {resolutionLabel ? (
                      <p className="text-sm text-neutral-600">
                        Last status change: {formatDateTime(resolutionLabel)}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {formatDateTime(assignment.assignedAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
