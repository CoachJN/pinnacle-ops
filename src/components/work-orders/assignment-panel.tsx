"use client";

import { ActionFeedback } from "@/components/shared/action-feedback";
import {
  AssignmentHistory,
  type AssignmentHistoryItem,
} from "./assignment-history";
import { formatDate, formatDateTime } from "./formatting";
import { WorkOrderCompactRow } from "./work-order-compact-row";
import { WorkOrderEmptyState } from "./work-order-empty-state";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";

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
  showHistory?: boolean;
}

export function AssignmentPanel(props: AssignmentPanelProps) {
  const selectedContractor = props.assignableContractors.find(
    (contractor) => contractor.id === props.contractorOrganizationId,
  );
  const canEditDispatch =
    props.allowedActions.canAssign || props.allowedActions.canReassign;
  const hasAssignmentResponseActions =
    props.allowedActions.canAcceptAssignment ||
    props.allowedActions.canDeclineAssignment ||
    props.allowedActions.canCompleteAssignment;

  return (
    <WorkOrderSection id="workflow-assignment-dispatch">
      <WorkOrderSectionHeader
        description="Internal ownership, contractor dispatch, and field execution handoff stay aligned in one workspace."
        title="Assignment & Dispatch"
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="border border-neutral-200 bg-neutral-50/70 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Internal owners
              </h3>
            </div>
          </div>

          <dl className="mt-2 divide-y divide-neutral-200">
            <WorkOrderCompactRow
              label="Coordinator"
              value={props.internalAssignees.coordinator?.label ?? "Unassigned"}
            />
            <WorkOrderCompactRow
              label="Manager"
              value={props.internalAssignees.manager?.label ?? "Unassigned"}
            />
          </dl>

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
        </section>

        <section className="border border-neutral-200 bg-neutral-50/70 px-3 py-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Active contractor assignment
          </h3>

          {props.activeAssignment ? (
            <div className="mt-4 grid gap-3">
              <div className="border border-neutral-200 bg-white px-3 py-3">
                <p className="text-base font-semibold text-neutral-950">
                  {props.activeAssignment.assigneeDisplayName}
                </p>
                <dl className="mt-3 grid gap-x-5 gap-y-1 border-t border-neutral-200 pt-3 sm:grid-cols-2">
                  <Metric
                    label="Status"
                    value={toLabel(props.activeAssignment.status)}
                  />
                  <Metric
                    label="Assigned"
                    value={formatDateTime(props.activeAssignment.assignedAt)}
                  />
                  <Metric
                    label="Assigned by"
                    value={props.activeAssignment.assignedByDisplayName}
                  />
                  <Metric
                    label="Scheduled date"
                    value={
                      props.activeAssignment.scheduledDate
                        ? formatDate(props.activeAssignment.scheduledDate)
                        : "Not scheduled yet"
                    }
                  />
                  <Metric
                    label="Window start"
                    value={
                      props.activeAssignment.timeWindowStart
                        ? formatDateTime(props.activeAssignment.timeWindowStart)
                        : "Not scheduled yet"
                    }
                  />
                  <Metric
                    label="Window end"
                    value={
                      props.activeAssignment.timeWindowEnd
                        ? formatDateTime(props.activeAssignment.timeWindowEnd)
                        : "Not scheduled yet"
                    }
                  />
                </dl>
                <div className="mt-3 border-l-2 border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                  Dispatch notes:{" "}
                  {props.activeAssignment.notes ?? "No notes provided."}
                </div>
              </div>

              {hasAssignmentResponseActions ? (
                <div className="flex flex-wrap gap-3">
                  {props.allowedActions.canAcceptAssignment ? (
                    <button
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                      disabled={props.isMutatingAssignment}
                      onClick={props.onAcceptAssignment}
                      type="button"
                    >
                      Accept assignment
                    </button>
                  ) : null}

                  {props.allowedActions.canCompleteAssignment ? (
                    <button
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                      disabled={props.isMutatingAssignment}
                      onClick={props.onCompleteAssignment}
                      type="button"
                    >
                      Complete assignment
                    </button>
                  ) : null}

                  {props.allowedActions.canDeclineAssignment ? (
                    <button
                      className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:border-rose-200 disabled:text-rose-300"
                      disabled={props.isMutatingAssignment}
                      onClick={props.onDeclineAssignment}
                      type="button"
                    >
                      Decline assignment
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4">
              <WorkOrderEmptyState
                message={`Current contractor reference: ${props.assignedContractorLabel}`}
                title="No active contractor assignment yet"
              />
            </div>
          )}
        </section>
      </div>

      <div className="mt-4">
        <ActionFeedback
          message={props.assignmentMessage}
          tone={props.assignmentTone}
        />
      </div>

      {canEditDispatch ? (
        <section className="mt-4 border-t border-neutral-200 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Contractor dispatch
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Choose the active contractor, schedule, and dispatch notes
                without changing the existing assignment mutation flow.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                    disabled={!contractor.isAssignable}
                    key={contractor.id}
                    value={contractor.id}
                  >
                    {contractor.label}
                    {contractor.isAssignable ? "" : " - not assignable"}
                  </option>
                ))}
              </select>
              {selectedContractor?.reason ? (
                <p className="text-xs text-amber-700">
                  {selectedContractor.reason}
                </p>
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
                onChange={(event) =>
                  props.onScheduledDateChange(event.target.value)
                }
                type="date"
                value={props.scheduledDate}
              />
            </label>

            <label className="space-y-2 text-sm text-neutral-700">
              <span className="font-medium">Window start</span>
              <input
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={props.isMutatingAssignment}
                onChange={(event) =>
                  props.onTimeWindowStartChange(event.target.value)
                }
                type="datetime-local"
                value={props.timeWindowStart}
              />
            </label>

            <label className="space-y-2 text-sm text-neutral-700">
              <span className="font-medium">Window end</span>
              <input
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={props.isMutatingAssignment}
                onChange={(event) =>
                  props.onTimeWindowEndChange(event.target.value)
                }
                type="datetime-local"
                value={props.timeWindowEnd}
              />
            </label>

            <label className="space-y-2 text-sm text-neutral-700 md:col-span-2">
              <span className="font-medium">Dispatch notes</span>
              <textarea
                className="min-h-24 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={props.isMutatingAssignment}
                onChange={(event) =>
                  props.onAssignmentNotesChange(event.target.value)
                }
                value={props.assignmentNotes}
              />
            </label>
          </div>

          <div className="mt-4">
            <button
              className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
              disabled={props.isMutatingAssignment}
              onClick={props.onSaveContractorAssignment}
              type="button"
            >
              {props.activeAssignment
                ? "Save reassignment"
                : "Create assignment"}
            </button>
          </div>
        </section>
      ) : null}

      {props.showHistory ? (
        <AssignmentHistory assignments={props.assignments} />
      ) : null}
    </WorkOrderSection>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <WorkOrderCompactRow label={label} value={value} />;
}

function toLabel(value: string): string {
  return value.replaceAll("_", " ");
}
