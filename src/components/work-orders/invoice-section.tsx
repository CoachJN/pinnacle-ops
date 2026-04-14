"use client";

import Link from "next/link";
import type { InternalUserRole } from "@/types/permissions";
import type { Invoice } from "@/types/invoice";
import type { PhaseOneWorkOrder } from "@/types/work-order";
import {
  canClosePaidWorkOrder,
  canCreateInvoice,
  canEditInvoice,
  canIssueInvoice,
  canMarkInvoiceOverdue,
  canMarkInvoicePaid,
  canVoidInvoice,
  canViewInvoice,
} from "@/lib/permissions/invoice-permissions";
import {
  closePaidWorkOrderFormAction,
  issueInvoiceFormAction,
  markInvoiceOverdueFormAction,
  markInvoicePaidFormAction,
  voidInvoiceFormAction,
} from "@/lib/invoices/actions";
import { formatInvoiceCurrency } from "@/lib/invoices/money";
import { getDisplayInvoiceStatus } from "@/lib/invoices/status";
import { formatDate, formatDateTime } from "@/components/work-orders/formatting";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { InvoiceHistoryList } from "./invoice-history-list";

export function InvoiceSection({
  workOrder,
  invoices,
  currentInvoice,
  role,
}: {
  workOrder: PhaseOneWorkOrder;
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  role: InternalUserRole;
}) {
  if (!canViewInvoice(role, workOrder, currentInvoice)) {
    return null;
  }

  const currentInvoiceMissing =
    Boolean(workOrder.currentInvoiceId) && !currentInvoice;
  const historicalInvoices = invoices.filter(
    (invoice) => invoice.id !== currentInvoice?.id,
  );
  const displayStatus = currentInvoice
    ? getDisplayInvoiceStatus(currentInvoice.status, currentInvoice.dueDate)
    : null;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">
            Invoice workflow
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {getInvoiceStateMessage(workOrder, currentInvoice)}
          </p>
        </div>
        {displayStatus ? <InvoiceStatusBadge status={displayStatus} /> : null}
      </div>

      {currentInvoiceMissing ? (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          This work order references a current invoice that was not found.
          Finance actions are blocked until the reference is corrected.
        </div>
      ) : null}

      <div className="mt-5">
        {currentInvoice ? (
          <InvoiceSummary invoice={currentInvoice} />
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-5">
            <p className="text-sm font-semibold text-neutral-950">No invoice yet</p>
            <p className="mt-1 text-sm text-neutral-600">
              Completed work remains open until finance creates and issues an
              invoice, records payment, and closes the work order.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {canCreateInvoice(role, workOrder) ? (
          <Link
            className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            href={`/work-orders/${workOrder.id}/invoice/new?role=${role}`}
          >
            Create invoice
          </Link>
        ) : null}

        {currentInvoice && canEditInvoice(role, workOrder, currentInvoice) ? (
          <Link
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
            href={`/work-orders/${workOrder.id}/invoice/${currentInvoice.id}/edit?role=${role}`}
          >
            Edit draft invoice
          </Link>
        ) : null}

        {currentInvoice && canIssueInvoice(role, workOrder, currentInvoice) ? (
          <InvoiceActionForm
            action={issueInvoiceFormAction}
            role={role}
            workOrderId={workOrder.id}
            invoiceId={currentInvoice.id}
            label="Issue invoice"
          />
        ) : null}

        {currentInvoice &&
        canMarkInvoiceOverdue(role, workOrder, currentInvoice) ? (
          <InvoiceActionForm
            action={markInvoiceOverdueFormAction}
            role={role}
            workOrderId={workOrder.id}
            invoiceId={currentInvoice.id}
            label="Mark overdue"
          />
        ) : null}

        {currentInvoice && canVoidInvoice(role, workOrder, currentInvoice) ? (
          <InvoiceActionForm
            action={voidInvoiceFormAction}
            role={role}
            workOrderId={workOrder.id}
            invoiceId={currentInvoice.id}
            label="Void invoice"
            danger
            confirmMessage="Void this invoice? The work order will return to completed if no replacement invoice exists."
          />
        ) : null}

        {currentInvoice && canClosePaidWorkOrder(role, workOrder, currentInvoice) ? (
          <InvoiceActionForm
            action={closePaidWorkOrderFormAction}
            role={role}
            workOrderId={workOrder.id}
            label="Close work order"
            confirmMessage="Close this paid work order? This is a terminal internal action."
          />
        ) : null}
      </div>

      {currentInvoice && canMarkInvoicePaid(role, workOrder, currentInvoice) ? (
        <form action={markInvoicePaidFormAction} className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <input type="hidden" name="actorRole" value={role} />
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <input type="hidden" name="invoiceId" value={currentInvoice.id} />
          <label className="block text-sm font-medium text-neutral-700">
            Payment reference
            <input
              name="paymentReference"
              defaultValue={currentInvoice.paymentReference ?? ""}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="mt-3 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Mark paid
          </button>
        </form>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-neutral-950">
          Invoice history
        </h3>
        <p className="mt-1 text-sm text-neutral-600">
          Voided invoices remain attached to the work order for traceability.
        </p>
        <div className="mt-3">
          <InvoiceHistoryList invoices={currentInvoice ? [currentInvoice, ...historicalInvoices] : invoices} />
        </div>
      </div>
    </section>
  );
}

function InvoiceSummary({ invoice }: { invoice: Invoice }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryField label="Invoice number" value={invoice.invoiceNumber} />
        <SummaryField
          label="Issue date"
          value={invoice.issueDate ? formatDateTime(invoice.issueDate) : "Not issued"}
        />
        <SummaryField label="Due date" value={formatDate(invoice.dueDate)} />
        <SummaryField
          label="Paid date"
          value={invoice.paidDate ? formatDateTime(invoice.paidDate) : "Not paid"}
        />
        <SummaryField
          label="Subtotal"
          value={formatInvoiceCurrency(invoice.subtotalAmount, invoice.currency)}
        />
        <SummaryField
          label="Tax"
          value={formatInvoiceCurrency(invoice.taxAmount, invoice.currency)}
        />
        <SummaryField
          label="Total"
          value={formatInvoiceCurrency(invoice.totalAmount, invoice.currency)}
        />
        <SummaryField
          label="Payment reference"
          value={invoice.paymentReference ?? "Not recorded"}
        />
        <SummaryField
          label="Last updated"
          value={formatDateTime(invoice.updatedAt)}
        />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
            <tr>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {invoice.lineItems.map((lineItem) => (
              <tr key={lineItem.id}>
                <td className="px-4 py-3 text-neutral-900">
                  {lineItem.description}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {lineItem.quantity}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {formatInvoiceCurrency(lineItem.unitPrice, invoice.currency)}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {formatInvoiceCurrency(lineItem.lineTotal, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invoice.internalFinanceNotes ? (
        <p className="mt-4 text-sm text-neutral-700">
          {invoice.internalFinanceNotes}
        </p>
      ) : null}
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function InvoiceActionForm({
  action,
  role,
  workOrderId,
  invoiceId,
  label,
  danger = false,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  role: InternalUserRole;
  workOrderId: string;
  invoiceId?: string;
  label: string;
  danger?: boolean;
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
      {invoiceId ? <input type="hidden" name="invoiceId" value={invoiceId} /> : null}
      <button
        type="submit"
        className={
          danger
            ? "rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
            : "rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        }
      >
        {label}
      </button>
    </form>
  );
}

function getInvoiceStateMessage(
  workOrder: PhaseOneWorkOrder,
  currentInvoice: Invoice | null,
): string {
  if (!currentInvoice && workOrder.status === "completed") {
    return "This completed work order is ready for an invoice draft.";
  }

  if (currentInvoice?.status === "draft") {
    return "Draft invoices keep the work order completed until issuance.";
  }

  if (currentInvoice?.status === "issued") {
    return "The invoice is issued; the work order remains invoiced until payment is recorded.";
  }

  if (currentInvoice?.status === "overdue") {
    return "The invoice is overdue; the work order remains invoiced until payment is recorded.";
  }

  if (currentInvoice?.status === "paid") {
    return "Payment is recorded and the work order can be closed internally.";
  }

  if (currentInvoice?.status === "void") {
    return "This invoice is void and remains attached as history.";
  }

  return "Invoice workflow is available after operational completion.";
}
