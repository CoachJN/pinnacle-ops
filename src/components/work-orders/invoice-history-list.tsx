import type { Invoice } from "@/types/invoice";
import { formatDate, formatDateTime } from "@/components/work-orders/formatting";
import { formatInvoiceCurrency } from "@/lib/invoices/money";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";

export function InvoiceHistoryList({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <p className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        No invoice history is attached to this work order yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
          <tr>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 bg-white">
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="px-4 py-3 font-semibold text-neutral-950">
                {invoice.invoiceNumber}
              </td>
              <td className="px-4 py-3">
                <InvoiceStatusBadge status={invoice.status} />
              </td>
              <td className="px-4 py-3 text-neutral-700">
                {formatDate(invoice.dueDate)}
              </td>
              <td className="px-4 py-3 text-neutral-700">
                {formatInvoiceCurrency(invoice.totalAmount, invoice.currency)}
              </td>
              <td className="px-4 py-3 text-neutral-700">
                {formatDateTime(invoice.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
