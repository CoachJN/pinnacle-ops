"use client";

import { ActionFeedback } from "@/components/shared/action-feedback";
import { AssignmentHistory, type AssignmentHistoryItem } from "./assignment-history";
import { formatDate, formatDateTime } from "./formatting";

interface InternalAssigneeOption {
  id: string;
  label: string;
  role: string;
}

interface AssignableContractorOption {
  id: string;
  label: string;
  status: string;
  parentContractorId: string | null;
  trades: string[];
  isAssignable: boolean;
  reason: string | null;
}

interface ActiveAssignment {
  id: string;
  assigneeDisplayName: string;
  assignedByDisplayName: string;
  status: "assigned" | "accepted" | "declined" | "completed" | "cancelled";
  scheduledDate: string | null;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  assignedAt: string;
  notes: string | null;
}

interface InternalAssignees {
  coordinator: InternalAssigneeOption | null;
  manager: InternalAssigneeOption | null;
}

interface AllowedAssignmentActions {
  canAssign: boolean;
  canReassign: boolean;
  canAcceptAssignment: boolean;
  canDeclineAssignment: boolean;
  canCompleteAssignment: boolean;
}

interface AssignmentPanelProps {
  activeAssignment: ActiveAssignment | null;
  assignments: AssignmentHistoryItem[];
  assignedContractorLabel: string;
  assignableContractors: AssignableContractorOption[];
  assignableInternalUsers: InternalAssigneeOption[];
  assignmentMessage: string | null;
  assignmentTone: "success" | "error" | "info";
  internalAssignees: InternalAssignees;
  internalAssignmentMessage: string | null;
  internalAssignmentTone: "success" | "error" | "info";
  isMutatingAssignment: boolean;
  isSavingInternalAssignment: boolean;
  allowedActions: AllowedAssignmentActions;
  contractorOrganizationId: string;
  scheduledDate: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  assignmentNotes: string;
  selectedCoordinatorUserId: string;
  selectedManagerUserId: string;
  onAssignmentNotesChange: (value: string) => void;
  onContractorOrganizationIdChange: (value: string) => void;
  onScheduledDateChange: (value: string) => void;
  onTimeWindowStartChange: (value: string) => void;
  onTimeWindowEndChange: (value: string) => void;
  onSelectedCoordinatorUserIdChange: (value: string) => void;
  onSelectedManagerUserIdChange: (value: string) => void;
  onSaveContractorAssignment: () => void;
  onSaveInternalAssignment: () => void;
  onAcceptAssignment: () => void;
  onDeclineAssignment: () => void;
  onCompleteAssignment: () => void;
}

export function AssignmentPanel(props: AssignmentPanelProps) {
  const selectedContractor = props.assignableContractors.find(
    (contractor) => contractor.id === props.contractorOrganizationId,
  );

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
            Assignment
          </h2>
          <p className="text-sm text-neutral-600">
            Internal ownership and contractor dispatch are enforced by the server workflow rules.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Internal owners
          </p>
          <div className="mt-3 space-y-2 text-sm text-neutral-600">
            <p>
              Coordinator: {props.internalAssignees.coordinator?.label ?? "Unassigned"}
            </p>
            <p>
              Manager: {props.internalAssignees.manager?.label ?? "Unassigned"}
            </p>
          </div>
          <div className="mt-4">
            <ActionFeedback
              message={props.internalAssignmentMessage}
              tone={props.internalAssignmentTone}
            />
          </div>
          <div className="mt-4 grid gap-3">
            <label className="space-y-2 text-sm text-neutral-700">
              <span className="font-medium">Coordinator</span>
              <select
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={props.isSavingInternalAssignment}
                onChange={(event) =>
                  props.onSelectedCoordinatorUserIdChange(event.target.value)
                }
                value={props.selectedCoordinatorUserId}
              >
                <option value="">Unassigned</option>
                {props.assignableInternalUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.label} ({user.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-neutral-700">
              <span className="font-medium">Manager</span>
              <select
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={props.isSavingInternalAssignment}
                onChange={(event) =>
                  props.onSelectedManagerUserIdChange(event.target.value)
                }
                value={props.selectedManagerUserId}
              >
                <option value="">Unassigned</option>
                {props.assignableInternalUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.label} ({user.role})
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button
                className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
                disabled={props.isSavingInternalAssignment}
                onClick={props.onSaveInternalAssignment}
                type="button"
              >
                Save internal owners
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Active contractor assignment
          </p>
          {props.activeAssignment ? (
            <div className="mt-3 grid gap-3 text-sm text-neutral-600">
            <p className="font-semibold text-neutral-950">
              {props.activeAssignment.assigneeDisplayName}
            </p>
              <p>Status: {props.activeAssignment.status.replaceAll("_", " ")}</p>
              <p>Assigned: {formatDateTime(props.activeAssignment.assignedAt)}</p>
              <p>Assigned by: {props.activeAssignment.assignedByDisplayName}</p>
              <p>Scheduled: {formatDate(props.activeAssignment.scheduledDate)}</p>
              <p>
                Window: {formatDateTime(props.activeAssignment.timeWindowStart)} to{" "}
                {formatDateTime(props.activeAssignment.timeWindowEnd)}
              </p>
              <p>Notes: {props.activeAssignment.notes ?? "No notes provided."}</p>
            </div>
          ) : (
            <div className="mt-3 grid gap-2 text-sm text-neutral-600">
              <p>No active contractor assignment yet.</p>
              <p>Current contractor reference: {props.assignedContractorLabel}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <ActionFeedback message={props.assignmentMessage} tone={props.assignmentTone} />
      </div>

      {(props.allowedActions.canAssign || props.allowedActions.canReassign) && (
        <div className="mt-5 grid gap-4 rounded-2xl border border-neutral-200 p-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-neutral-700 md:col-span-2">
            <span className="font-medium">Contractor</span>
            <select
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              disabled={props.isMutatingAssignment}
              onChange={(event) =>
                props.onContractorOrganizationIdChange(event.target.value)
              }
              value={props.contractorOrganizationId}
            >
              <option value="">Select a contractor</option>
              {props.assignableContractors.map((contractor) => (
                <option
                  key={contractor.id}
                  disabled={!contractor.isAssignable}
                  value={contractor.id}
                >
                  {contractor.label}
                  {contractor.isAssignable ? "" : " - not assignable"}
                </option>
              ))}
            </select>
            {selectedContractor?.reason ? (
              <p className="text-xs text-amber-700">{selectedContractor.reason}</p>
            ) : selectedContractor ? (
              <p className="text-xs text-neutral-500">
                Trades:{" "}
                {selectedContractor.trades.length > 0
                  ? selectedContractor.trades.join(", ")
                  : "None"}
              </p>
            ) : null}
          </label>
          <label className="space-y-2 text-sm text-neutral-700">
            <span className="font-medium">Scheduled date</span>
            <input
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              disabled={props.isMutatingAssignment}
              onChange={(event) => props.onScheduledDateChange(event.target.value)}
              type="date"
              value={props.scheduledDate}
            />
          </label>
          <label className="space-y-2 text-sm text-neutral-700">
            <span className="font-medium">Window start</span>
            <input
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              disabled={props.isMutatingAssignment}
              onChange={(event) => props.onTimeWindowStartChange(event.target.value)}
              type="datetime-local"
              value={props.timeWindowStart}
            />
          </label>
          <label className="space-y-2 text-sm text-neutral-700">
            <span className="font-medium">Window end</span>
            <input
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              disabled={props.isMutatingAssignment}
              onChange={(event) => props.onTimeWindowEndChange(event.target.value)}
              type="datetime-local"
              value={props.timeWindowEnd}
            />
          </label>
          <label className="space-y-2 text-sm text-neutral-700 md:col-span-2">
            <span className="font-medium">Dispatch notes</span>
            <textarea
              className="min-h-24 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              disabled={props.isMutatingAssignment}
              onChange={(event) => props.onAssignmentNotesChange(event.target.value)}
              value={props.assignmentNotes}
            />
          </label>
          <div className="md:col-span-2">
            <button
              className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
              disabled={props.isMutatingAssignment}
              onClick={props.onSaveContractorAssignment}
              type="button"
            >
              {props.activeAssignment ? "Save reassignment" : "Create assignment"}
            </button>
          </div>
        </div>
      )}

      {(props.allowedActions.canAcceptAssignment ||
        props.allowedActions.canDeclineAssignment ||
        props.allowedActions.canCompleteAssignment) &&
        props.activeAssignment && (
          <div className="mt-5 flex flex-wrap gap-3">
            {props.allowedActions.canAcceptAssignment && (
              <button
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                disabled={props.isMutatingAssignment}
                onClick={props.onAcceptAssignment}
                type="button"
              >
                Accept assignment
              </button>
            )}
            {props.allowedActions.canDeclineAssignment && (
              <button
                className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:border-rose-200 disabled:text-rose-300"
                disabled={props.isMutatingAssignment}
                onClick={props.onDeclineAssignment}
                type="button"
              >
                Decline assignment
              </button>
            )}
            {props.allowedActions.canCompleteAssignment && (
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                disabled={props.isMutatingAssignment}
                onClick={props.onCompleteAssignment}
                type="button"
              >
                Complete assignment
              </button>
            )}
          </div>
        )}

      <AssignmentHistory assignments={props.assignments} />
    </section>
  );
}
