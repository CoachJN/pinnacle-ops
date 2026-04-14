import type { InvoiceLineItem } from "@/types/invoice";

export function calculateInvoiceLineTotal(
  quantity: number,
  unitPrice: number,
): number {
  return roundCurrency(quantity * unitPrice);
}

export function calculateInvoiceSubtotal(
  lineItems: readonly Pick<InvoiceLineItem, "lineTotal">[],
): number {
  return roundCurrency(
    lineItems.reduce((subtotal, lineItem) => subtotal + lineItem.lineTotal, 0),
  );
}

export function calculateInvoiceTotal(
  subtotalAmount: number,
  taxAmount: number,
): number {
  return roundCurrency(subtotalAmount + taxAmount);
}

export function formatInvoiceCurrency(
  amount: number,
  currency = "CAD",
): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amount);
}

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}
