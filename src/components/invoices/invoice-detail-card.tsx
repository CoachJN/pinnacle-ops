import type { Invoice } from "@/types/invoice";
import { formatInvoiceCurrency } from "@/lib/invoices/money";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatDate, formatDateTime } from "@/components/work-orders/formatting";

export function InvoiceDetailCard({ invoice }: { invoice: Invoice }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            Invoice
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            {invoice.invoiceNumber}
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Due {formatDate(invoice.dueDate)}. Last updated {formatDateTime(invoice.updatedAt)}.
          </p>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <SummaryField label="Issued" value={invoice.issuedDate ? formatDateTime(invoice.issuedDate) : "Not issued"} />
        <SummaryField label="Sent" value={invoice.sentAt ? formatDateTime(invoice.sentAt) : "Not sent"} />
        <SummaryField label="Viewed" value={invoice.viewedAt ? formatDateTime(invoice.viewedAt) : "Not viewed"} />
        <SummaryField label="Paid" value={invoice.paidAt ? formatDateTime(invoice.paidAt) : "Not paid"} />
        <SummaryField label="Currency" value={invoice.currency} />
        <SummaryField label="Payment reference" value={invoice.paymentReference ?? "Not recorded"} />
        <SummaryField
          label="Subtotal"
          value={formatInvoiceCurrency(invoice.subtotal ?? 0, invoice.currency)}
        />
        <SummaryField
          label="Tax"
          value={formatInvoiceCurrency(invoice.taxAmount, invoice.currency)}
        />
        <SummaryField
          label="Total"
          value={formatInvoiceCurrency(invoice.totalAmount, invoice.currency)}
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
            <tr>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {invoice.lineItems.map((lineItem) => (
              <tr key={lineItem.id}>
                <td className="px-4 py-3 text-neutral-900">{lineItem.description}</td>
                <td className="px-4 py-3 text-neutral-700">{lineItem.quantity}</td>
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

      {invoice.notes ? (
        <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {invoice.notes}
        </div>
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
