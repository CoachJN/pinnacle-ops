"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  acceptContractorAssignmentAction,
  completeContractorAssignmentAction,
  declineContractorAssignmentAction,
  type ContractorPortalFormState,
} from "@/modules/contractors/server/contractor-portal-actions";
import type { ContractorPortalWorkOrderDetail } from "@/modules/work-orders/contractor-portal";
import { FormSubmitButton } from "@/components/work-orders/form-submit-button";

const emptyState: ContractorPortalFormState = { ok: false };

export function ContractorActionPanel({
  workOrder,
}: {
  workOrder: ContractorPortalWorkOrderDetail;
}) {
  const [acceptState, acceptAction] = useActionState(
    acceptContractorAssignmentAction,
    emptyState,
  );
  const [declineState, declineAction] = useActionState(
    declineContractorAssignmentAction,
    emptyState,
  );
  const [completeState, completeAction] = useActionState(
    completeContractorAssignmentAction,
    emptyState,
  );
  const stateMessage =
    acceptState.message ?? declineState.message ?? completeState.message;
  const canQuote = workOrder.actionAvailability.canSubmitQuote;
  const canAccept = workOrder.actionAvailability.canAcceptAssignment;
  const canDecline = workOrder.actionAvailability.canDeclineAssignment;
  const canComplete = workOrder.actionAvailability.canCompleteAssignment;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">Next action</h2>
          <p className="mt-1 text-sm text-neutral-600">Respond to the assignment, submit a quote when requested, and mark the assignment complete after the job is done.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
            {formatStatusLabel(workOrder.status)}
          </span>
          <span className="text-sm font-medium text-neutral-600">
            Assignment: {workOrder.assignment.status}
          </span>
        </div>
      </div>

      {stateMessage ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {stateMessage}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-4">
        {canAccept ? (
          <form action={acceptAction}>
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <FormSubmitButton pendingLabel="Accepting...">
              Accept assignment
            </FormSubmitButton>
          </form>
        ) : null}
        {canDecline ? (
          <form action={declineAction} className="space-y-3">
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <label className="block text-sm font-medium text-neutral-700">
              Decline reason
              <textarea name="declineReason" rows={3} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none" />
            </label>
            <FormSubmitButton pendingLabel="Declining...">
              Decline assignment
            </FormSubmitButton>
          </form>
        ) : null}
        {canQuote ? (
          <Link href={`/contractor/work-orders/${workOrder.id}/quote`} className="inline-flex w-fit rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
            Submit quote
          </Link>
        ) : null}
        {canComplete ? (
          <form action={completeAction} className="space-y-3">
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <label className="block text-sm font-medium text-neutral-700">
              Completion notes
              <textarea name="completionNotes" rows={4} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none" />
            </label>
            <FormSubmitButton pendingLabel="Completing...">
              Mark assignment complete
            </FormSubmitButton>
          </form>
        ) : null}
        {!canAccept && !canDecline && !canQuote && !canComplete ? (
          <p className="text-sm text-neutral-600">
            No contractor action is available for this state.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function formatStatusLabel(value: string): string {
  return value.replaceAll("_", " ");
}
