import type { InvoiceFormInput, InvoiceLineItem } from "@/types/invoice";
import {
  calculateInvoiceLineTotal,
  calculateInvoiceSubtotal,
  calculateInvoiceTotal,
  roundCurrency,
} from "@/lib/invoices/money";

export interface InvoiceFormErrors {
  dueDate?: string;
  currency?: string;
  taxAmount?: string;
  lineItems?: string;
  form?: string;
}

export type InvoiceFormValidationResult =
  | {
      ok: true;
      data: InvoiceFormInput & {
        subtotalAmount: number;
        totalAmount: number;
      };
      errors?: never;
    }
  | { ok: false; data?: never; errors: InvoiceFormErrors };

export function validateInvoiceForm(
  formData: FormData,
): InvoiceFormValidationResult {
  const dueDate = readTrimmedString(formData, "dueDate");
  const currency = readTrimmedString(formData, "currency");
  const taxAmount = readMoney(formData, "taxAmount");
  const internalFinanceNotes = readNullableTrimmedString(
    formData,
    "internalFinanceNotes",
  );
  const paymentReference = readNullableTrimmedString(
    formData,
    "paymentReference",
  );
  const lineItems = readLineItems(formData);
  const errors: InvoiceFormErrors = {};

  if (!dueDate || Number.isNaN(Date.parse(dueDate))) {
    errors.dueDate = "Due date is required.";
  }

  if (currency !== "CAD" && currency !== "USD") {
    errors.currency = "Currency is required.";
  }

  if (taxAmount === null) {
    errors.taxAmount = "Tax amount must be a number greater than or equal to 0.";
  }

  if (lineItems.length === 0) {
    errors.lineItems = "At least one valid line item is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const validCurrency = currency === "USD" ? "USD" : "CAD";
  const validTaxAmount = taxAmount ?? 0;
  const subtotalAmount = calculateInvoiceSubtotal(lineItems);
  const totalAmount = calculateInvoiceTotal(subtotalAmount, validTaxAmount);

  return {
    ok: true,
    data: {
      dueDate,
      currency: validCurrency,
      lineItems,
      taxAmount: validTaxAmount,
      subtotalAmount,
      totalAmount,
      internalFinanceNotes,
      paymentReference,
    },
  };
}

function readLineItems(formData: FormData): InvoiceLineItem[] {
  const count = Number(readTrimmedString(formData, "lineItemCount"));
  const rowCount = Number.isInteger(count) && count > 0 ? count : 0;
  const lineItems: InvoiceLineItem[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const description = readTrimmedString(formData, `lineItemDescription-${index}`);
    const quantity = readPositiveNumber(formData, `lineItemQuantity-${index}`);
    const unitPrice = readMoney(formData, `lineItemUnitPrice-${index}`);

    if (!description && quantity === null && unitPrice === null) {
      continue;
    }

    if (!description || quantity === null || unitPrice === null) {
      return [];
    }

    lineItems.push({
      id: readTrimmedString(formData, `lineItemId-${index}`) || `line-${index}`,
      description,
      quantity,
      unitPrice,
      lineTotal: calculateInvoiceLineTotal(quantity, unitPrice),
    });
  }

  return lineItems;
}

function readTrimmedString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableTrimmedString(
  formData: FormData,
  field: string,
): string | null {
  const value = readTrimmedString(formData, field);
  return value ? value : null;
}

function readMoney(formData: FormData, field: string): number | null {
  const value = readTrimmedString(formData, field);
  if (!value) {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return roundCurrency(amount);
}

function readPositiveNumber(formData: FormData, field: string): number | null {
  const value = readTrimmedString(formData, field);
  if (!value) {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return roundCurrency(amount);
}
