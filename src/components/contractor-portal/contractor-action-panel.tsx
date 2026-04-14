"use client";

import Link from "next/link";
import { useActionState } from "react";
import { StatusBadge } from "@/components/work-orders/badges";
import {
  updateContractorExecutionStatusAction,
  type ContractorStatusFormState,
} from "@/lib/contractors/contractor-actions";
import type { ContractorWorkOrderDetailView } from "@/lib/contractors/projections";
import { FormSubmitButton } from "@/components/work-orders/form-submit-button";

const emptyState: ContractorStatusFormState = { ok: false };

export function ContractorActionPanel({
  workOrder,
  contractorId,
}: {
  workOrder: ContractorWorkOrderDetailView;
  contractorId: string;
}) {
  const [state, formAction] = useActionState(
    updateContractorExecutionStatusAction,
    emptyState,
  );
  const canQuote = workOrder.status === "quote_requested" && workOrder.quoteActionNeeded;
  const canStart =
    workOrder.status === "approved_to_proceed" ||
    workOrder.status === "dispatched";
  const canComplete = workOrder.status === "in_progress";

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">Next action</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Status updates use the Phase 5 MVP direct-completion model.
          </p>
        </div>
        <StatusBadge status={workOrder.status} />
      </div>

      {state.message ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.message}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-4">
        {canQuote ? (
          <Link href={`/contractor/work-orders/${workOrder.id}/quote?contractorId=${contractorId}`} className="inline-flex w-fit rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
            Submit quote
          </Link>
        ) : null}
        {canStart ? (
          <form action={formAction}>
            <input type="hidden" name="contractorId" value={contractorId} />
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <input type="hidden" name="nextStatus" value="in_progress" />
            <FormSubmitButton pendingLabel="Updating...">
              Mark in progress
            </FormSubmitButton>
          </form>
        ) : null}
        {canComplete ? (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="contractorId" value={contractorId} />
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <input type="hidden" name="nextStatus" value="completed" />
            <label className="block text-sm font-medium text-neutral-700">
              Completion notes<span className="text-rose-700"> *</span>
              <textarea name="completionNotes" rows={4} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none" />
            </label>
            <FormSubmitButton pendingLabel="Completing...">
              Mark completed
            </FormSubmitButton>
          </form>
        ) : null}
        {!canQuote && !canStart && !canComplete ? (
          <p className="text-sm text-neutral-600">
            No contractor action is available for this state.
          </p>
        ) : null}
      </div>
    </section>
  );
}
