import type { Invoice } from "@/types/invoice";
import type { Quote } from "@/types/quote";
import type { PhaseOneWorkOrder } from "@/types/work-order";
import {
  getInvoiceOperationalFlags,
  getQuoteOperationalFlags,
  getWorkOrderOperationalFlags,
} from "@/lib/flags/operational-flags";

export function DerivedStatusIndicators({
  workOrder,
  currentInvoice,
  currentQuote,
}: {
  workOrder: PhaseOneWorkOrder;
  currentInvoice?: Invoice | null;
  currentQuote?: Quote | null;
}) {
  const workOrderFlags = getWorkOrderOperationalFlags(workOrder, {
    currentInvoice,
    currentQuote,
  });
  const invoiceFlags = currentInvoice
    ? getInvoiceOperationalFlags(currentInvoice)
    : null;
  const quoteFlags = currentQuote
    ? getQuoteOperationalFlags(workOrder, currentQuote)
    : null;

  const labels = [
    workOrderFlags.isTerminal ? "Read-only terminal state" : null,
    workOrderFlags.isStale ? "Stale active work" : null,
    workOrderFlags.isAwaitingQuote ? "Awaiting quote" : null,
    workOrderFlags.isAwaitingClientApproval ? "Awaiting client approval" : null,
    workOrderFlags.isReadyToDispatch ? "Ready to dispatch" : null,
    workOrderFlags.isReadyToInvoice ? "Ready to invoice" : null,
    workOrderFlags.isAwaitingPayment ? "Awaiting payment" : null,
    workOrderFlags.isReadyToClose ? "Ready to close" : null,
    invoiceFlags?.isOverdue ? "Invoice overdue" : null,
    quoteFlags?.needsRevision ? "Quote needs revision" : null,
  ].filter(Boolean);

  if (labels.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

