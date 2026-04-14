"use client";

import { ActionFeedback } from "@/components/shared/action-feedback";
import { type WorkOrderStatus, WORK_ORDER_STATUS_LABELS } from "@/modules/work-orders";

interface WorkOrderDetailHeaderProps {
  workOrderNumber: string;
  workOrderTitle: string;
  status: WorkOrderStatus;
  statusLabel: string;
  priorityLabel: string;
  categoryLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  dueDateLabel: string;
  allowedTransitions: readonly WorkOrderStatus[];
  statusActionEnabled: boolean;
  isUpdatingStatus: boolean;
  pendingStatus: WorkOrderStatus | null;
  statusMessage: string | null;
  statusTone: "success" | "error" | "info";
  onStatusChange: (nextStatus: WorkOrderStatus) => void;
}

const statusBadgeClassNames = {
  NEW: "border-sky-200 bg-sky-50 text-sky-800",
  OPEN: "border-cyan-200 bg-cyan-50 text-cyan-800",
  ASSIGNED: "border-violet-200 bg-violet-50 text-violet-800",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-900",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  READY_FOR_INVOICING: "border-blue-200 bg-blue-50 text-blue-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800",
  CLOSED: "border-neutral-300 bg-neutral-100 text-neutral-700",
} as const satisfies Record<WorkOrderStatus, string>;

const priorityBadgeClassNames: Record<string, string> = {
  Low: "border-neutral-300 bg-white text-neutral-700",
  Medium: "border-sky-200 bg-sky-50 text-sky-800",
  High: "border-amber-200 bg-amber-50 text-amber-900",
  Urgent: "border-rose-200 bg-rose-50 text-rose-800",
};

export function WorkOrderDetailHeader({
  workOrderNumber,
  workOrderTitle,
  status,
  statusLabel,
  priorityLabel,
  categoryLabel,
  createdAtLabel,
  updatedAtLabel,
  dueDateLabel,
  allowedTransitions,
  statusActionEnabled,
  isUpdatingStatus,
  pendingStatus,
  statusMessage,
  statusTone,
  onStatusChange,
}: WorkOrderDetailHeaderProps) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            {workOrderNumber}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            {workOrderTitle}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClassNames[status]}`}
            >
              {statusLabel}
            </span>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClassNames[priorityLabel] ?? priorityBadgeClassNames.Low}`}
            >
              {priorityLabel} priority
            </span>
            <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
              {categoryLabel}
            </span>
          </div>
          <dl className="mt-6 grid gap-4 text-sm text-neutral-600 sm:grid-cols-3">
            <div>
              <dt className="font-medium text-neutral-500">Created</dt>
              <dd className="mt-1 text-neutral-900">{createdAtLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Updated</dt>
              <dd className="mt-1 text-neutral-900">{updatedAtLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Due date</dt>
              <dd className="mt-1 text-neutral-900">{dueDateLabel}</dd>
            </div>
          </dl>
        </div>

        <section className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-5 xl:max-w-sm">
          <h2 className="text-base font-semibold text-neutral-950">Status actions</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Available actions are provided by the backend for this work order and
            your current access scope.
          </p>

          {statusMessage ? (
            <div className="mt-4">
              <ActionFeedback message={statusMessage} tone={statusTone} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            {statusActionEnabled && allowedTransitions.length > 0 ? (
              allowedTransitions.map((transition) => (
                <button
                  className="inline-flex rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-500 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isUpdatingStatus}
                  aria-busy={pendingStatus === transition}
                  key={transition}
                  onClick={() => onStatusChange(transition)}
                  type="button"
                >
                  {pendingStatus === transition
                    ? "Updating..."
                    : transition === "CLOSED"
                      ? "Close work order"
                      : transition === "CANCELLED"
                        ? "Cancel work order"
                        : `Move to ${WORK_ORDER_STATUS_LABELS[transition]}`}
                </button>
              ))
            ) : (
              <p className="text-sm text-neutral-600">
                No status changes are available right now.
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
