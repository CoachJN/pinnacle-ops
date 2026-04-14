"use client";

import Link from "next/link";
import type { InternalUserRole } from "@/types/permissions";
import type { Quote } from "@/types/quote";
import type { PhaseOneWorkOrder } from "@/types/work-order";
import {
  canCreateQuote,
  canCreateQuoteRevision,
  canMarkRequiresQuote,
  canRecordClientApproval,
  canRecordClientRejection,
  canRequestQuote,
  canReviewQuote,
  canSendQuoteToClient,
  canSubmitQuote,
  canViewQuoteHistory,
} from "@/lib/permissions/quote-permissions";
import {
  createQuoteRevisionFormAction,
  markQuoteUnderReviewFormAction,
  markRequiresQuoteFormAction,
  recordClientApprovalFormAction,
  recordClientRejectionFormAction,
  requestQuoteFormAction,
  sendQuoteToClientFormAction,
  submitQuoteFormAction,
} from "@/lib/quotes/actions";
import { QuoteHistoryList } from "./quote-history-list";
import { QuoteSummaryCard } from "./quote-summary-card";

export function QuoteSection({
  workOrder,
  quotes,
  currentQuote,
  role,
}: {
  workOrder: PhaseOneWorkOrder;
  quotes: Quote[];
  currentQuote: Quote | null;
  role: InternalUserRole;
}) {
  const currentQuoteMissing =
    Boolean(workOrder.currentQuoteId) && !currentQuote;
  const canViewHistory = canViewQuoteHistory(role, workOrder);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">Quote workflow</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {getQuoteStateMessage(workOrder, currentQuote)}
          </p>
        </div>
        <span className="rounded-md border border-neutral-300 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
          {workOrder.requiresQuote ? "Quote required" : "Quote not required"}
        </span>
      </div>

      {currentQuoteMissing ? (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          This work order references a current quote that was not found. Quote
          actions are blocked until the reference is corrected.
        </div>
      ) : null}

      <div className="mt-5">
        <QuoteSummaryCard quote={currentQuote} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {!workOrder.requiresQuote &&
        canMarkRequiresQuote(role, workOrder) ? (
          <QuoteActionForm
            action={markRequiresQuoteFormAction}
            role={role}
            workOrderId={workOrder.id}
            label="Mark requires quote"
          />
        ) : null}

        {canRequestQuote(role, workOrder) ? (
          <QuoteActionForm
            action={requestQuoteFormAction}
            role={role}
            workOrderId={workOrder.id}
            label="Request quote"
          />
        ) : null}

        {canCreateQuote(role, workOrder) && !currentQuote ? (
          <Link
            className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            href={`/work-orders/${workOrder.id}/quotes/new?role=${role}`}
          >
            Create quote entry
          </Link>
        ) : null}

        {currentQuote && canSubmitQuote(role, workOrder, currentQuote) ? (
          <>
            <Link
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
              href={`/work-orders/${workOrder.id}/quotes/${currentQuote.id}/edit?role=${role}`}
            >
              Edit draft quote
            </Link>
            <QuoteActionForm
              action={submitQuoteFormAction}
              role={role}
              workOrderId={workOrder.id}
              quoteId={currentQuote.id}
              label="Submit quote for review"
            />
          </>
        ) : null}

        {currentQuote &&
        canCreateQuoteRevision(role, workOrder, currentQuote) &&
        currentQuote.status !== "draft" ? (
          <QuoteActionForm
            action={createQuoteRevisionFormAction}
            role={role}
            workOrderId={workOrder.id}
            quoteId={currentQuote.id}
            label="Create revised quote"
            confirmMessage="Create a revised quote? The current active quote will be superseded when the new draft is saved."
          />
        ) : null}
      </div>

      {currentQuote &&
      (canReviewQuote(role, workOrder, currentQuote) ||
        canSendQuoteToClient(role, workOrder, currentQuote)) ? (
        <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="text-sm font-semibold text-neutral-950">
            Internal quote review
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            Review scope and pricing before moving the quote to client approval.
          </p>
          <QuoteNotesForm
            role={role}
            workOrderId={workOrder.id}
            quoteId={currentQuote.id}
            fieldName="internalReviewNotes"
            defaultValue={currentQuote.internalReviewNotes ?? ""}
            primaryLabel={
              currentQuote.status === "submitted"
                ? "Mark under review"
                : "Send to client approval"
            }
            action={
              currentQuote.status === "submitted"
                ? markQuoteUnderReviewFormAction
                : sendQuoteToClientFormAction
            }
            disabled={
              currentQuote.status === "submitted"
                ? !canReviewQuote(role, workOrder, currentQuote)
                : !canSendQuoteToClient(role, workOrder, currentQuote)
            }
          />
        </div>
      ) : null}

      {currentQuote &&
      (canRecordClientApproval(role, workOrder, currentQuote) ||
        canRecordClientRejection(role, workOrder, currentQuote)) ? (
        <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="text-sm font-semibold text-neutral-950">
            Client approval decision
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            Record the client decision internally for this MVP workflow.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <QuoteNotesForm
              role={role}
              workOrderId={workOrder.id}
              quoteId={currentQuote.id}
              fieldName="clientResponseNotes"
              primaryLabel="Record client approval"
              action={recordClientApprovalFormAction}
            />
            <QuoteNotesForm
              role={role}
              workOrderId={workOrder.id}
              quoteId={currentQuote.id}
              fieldName="clientResponseNotes"
              primaryLabel="Record client rejection"
              action={recordClientRejectionFormAction}
              danger
              confirmMessage="Record client rejection and return this work order to quote requested?"
            />
          </div>
        </div>
      ) : null}

      {canViewHistory ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-950">Quote history</h3>
          <div className="mt-3">
            <QuoteHistoryList
              workOrder={workOrder}
              quotes={quotes}
              role={role}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function QuoteActionForm({
  action,
  role,
  workOrderId,
  quoteId,
  label,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  role: InternalUserRole;
  workOrderId: string;
  quoteId?: string;
  label: string;
  confirmMessage?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={
        confirmMessage
          ? (event) => {
              if (!window.confirm(confirmMessage)) {
                event.preventDefault();
              }
            }
          : undefined
      }
    >
      <input type="hidden" name="actorRole" value={role} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      {quoteId ? <input type="hidden" name="quoteId" value={quoteId} /> : null}
      <button
        type="submit"
        className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
      >
        {label}
      </button>
    </form>
  );
}

function QuoteNotesForm({
  action,
  role,
  workOrderId,
  quoteId,
  fieldName,
  primaryLabel,
  defaultValue = "",
  disabled = false,
  danger = false,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  role: InternalUserRole;
  workOrderId: string;
  quoteId: string;
  fieldName: "internalReviewNotes" | "clientResponseNotes";
  primaryLabel: string;
  defaultValue?: string;
  disabled?: boolean;
  danger?: boolean;
  confirmMessage?: string;
}) {
  return (
    <form
      action={action}
      className="mt-4 space-y-3"
      onSubmit={
        confirmMessage
          ? (event) => {
              if (!window.confirm(confirmMessage)) {
                event.preventDefault();
              }
            }
          : undefined
      }
    >
      <input type="hidden" name="actorRole" value={role} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <label className="block text-sm font-medium text-neutral-700">
        Notes
        <textarea
          name={fieldName}
          defaultValue={defaultValue}
          rows={3}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={disabled}
        className={
          disabled
            ? "rounded-md border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-500"
            : danger
            ? "rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
            : "rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        }
      >
        {primaryLabel}
      </button>
    </form>
  );
}

function getQuoteStateMessage(
  workOrder: PhaseOneWorkOrder,
  currentQuote: Quote | null,
): string {
  if (!workOrder.requiresQuote) {
    return "This work order is not blocked by quote approval.";
  }

  if (!currentQuote && workOrder.status === "quote_requested") {
    return "A contractor quote has been requested and a quote entry is needed.";
  }

  if (currentQuote?.status === "client_approved") {
    return "Client approval is recorded and the work order can proceed to dispatch.";
  }

  if (currentQuote?.status === "client_rejected") {
    return "The client rejected the current quote; create a revised quote to continue.";
  }

  if (workOrder.status === "pending_client_approval") {
    return "The quote is ready for the client approval decision to be recorded.";
  }

  if (workOrder.status === "approved_to_proceed") {
    return "Quote approval is complete and operational dispatch is unblocked.";
  }

  return "Quote approval is required before this work order can be dispatched.";
}
