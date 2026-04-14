"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { Invoice, InvoiceCurrency, InvoiceLineItem } from "@/types/invoice";
import {
  calculateInvoiceLineTotal,
  calculateInvoiceSubtotal,
  calculateInvoiceTotal,
  formatInvoiceCurrency,
} from "@/lib/invoices/money";

interface InvoiceEditorWorkOrder {
  id: string;
  workOrderNumber: string;
  title: string;
}

interface EditableLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

const BLANK_LINE_ITEM: EditableLineItem = {
  id: "",
  description: "",
  quantity: "1",
  unitPrice: "0",
};

export function InvoiceEditorForm({
  cancelHref,
  invoice,
  method,
  submitHref,
  successHref,
  workOrder,
}: {
  cancelHref: string;
  invoice?: Invoice;
  method: "POST" | "PATCH";
  submitHref: string;
  successHref: string;
  workOrder: InvoiceEditorWorkOrder;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<EditableLineItem[]>(
    invoice?.lineItems.map(toEditableLineItem) ?? [
      {
        ...BLANK_LINE_ITEM,
        description: workOrder.title,
      },
    ],
  );
  const [currency, setCurrency] = useState<InvoiceCurrency>(invoice?.currency ?? "CAD");
  const [dueDate, setDueDate] = useState(invoice?.dueDate.slice(0, 10) ?? "");
  const [taxAmount, setTaxAmount] = useState(String(invoice?.taxAmount ?? 0));
  const [notes, setNotes] = useState(invoice?.notes ?? "");

  const computedLineItems = lineItems.map((lineItem, index) => ({
    id: lineItem.id || `line-${index + 1}`,
    description: lineItem.description.trim(),
    quantity: readAmount(lineItem.quantity),
    unitPrice: readAmount(lineItem.unitPrice),
  }));
  const subtotal = calculateInvoiceSubtotal(
    computedLineItems.map((lineItem) => ({
      lineTotal: calculateInvoiceLineTotal(lineItem.quantity, lineItem.unitPrice),
    })),
  );
  const totalAmount = calculateInvoiceTotal(subtotal, readAmount(taxAmount));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(submitHref, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dueDate,
          currency,
          lineItems: computedLineItems,
          subtotal,
          taxAmount: readAmount(taxAmount),
          totalAmount,
          notes: notes.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Unable to save the invoice draft.",
        );
      }

      router.push(successHref);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the invoice draft.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div>
        <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
          {workOrder.workOrderNumber}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          {invoice ? `Edit ${invoice.invoiceNumber}` : "Create invoice draft"}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Draft invoices stay internal until finance explicitly sends them.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-neutral-700">
          Due date
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
            onChange={(event) => setDueDate(event.target.value)}
            required
            type="date"
            value={dueDate}
          />
        </label>

        <label className="text-sm font-medium text-neutral-700">
          Currency
          <select
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
            onChange={(event) => setCurrency(event.target.value as InvoiceCurrency)}
            value={currency}
          >
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
            Computed total
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-950">
            {formatInvoiceCurrency(totalAmount, currency)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">Line items</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Finance totals are derived from quantity, unit price, and tax.
            </p>
          </div>
          <button
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
            onClick={() => setLineItems((current) => [...current, BLANK_LINE_ITEM])}
            type="button"
          >
            Add line
          </button>
        </div>

        {lineItems.map((lineItem, index) => (
          <div
            key={`${lineItem.id || "line"}-${index}`}
            className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-[1fr_8rem_10rem_10rem_auto]"
          >
            <TextInput
              label="Description"
              onChange={(value) => updateLineItem(setLineItems, index, "description", value)}
              value={lineItem.description}
            />
            <TextInput
              label="Quantity"
              onChange={(value) => updateLineItem(setLineItems, index, "quantity", value)}
              type="number"
              value={lineItem.quantity}
            />
            <TextInput
              label="Unit price"
              onChange={(value) => updateLineItem(setLineItems, index, "unitPrice", value)}
              type="number"
              value={lineItem.unitPrice}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
                Line total
              </p>
              <p className="mt-2 text-sm font-semibold text-neutral-950">
                {formatInvoiceCurrency(
                  calculateInvoiceLineTotal(
                    readAmount(lineItem.quantity),
                    readAmount(lineItem.unitPrice),
                  ),
                  currency,
                )}
              </p>
            </div>
            <button
              className="self-end rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
              onClick={() =>
                setLineItems((current) =>
                  current.length === 1
                    ? [BLANK_LINE_ITEM]
                    : current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-neutral-700">
          Tax amount
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
            min="0"
            onChange={(event) => setTaxAmount(event.target.value)}
            required
            step="0.01"
            type="number"
            value={taxAmount}
          />
        </label>
        <SummaryTile label="Subtotal" value={formatInvoiceCurrency(subtotal, currency)} />
        <SummaryTile label="Total" value={formatInvoiceCurrency(totalAmount, currency)} />
      </div>

      <label className="block text-sm font-medium text-neutral-700">
        Notes
        <textarea
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          value={notes}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : invoice ? "Save draft changes" : "Save invoice draft"}
        </button>
        <Link
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
          href={cancelHref}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function TextInput({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  value: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        step={type === "number" ? "0.01" : undefined}
        type={type}
        value={value}
      />
    </label>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function toEditableLineItem(lineItem: InvoiceLineItem): EditableLineItem {
  return {
    id: lineItem.id,
    description: lineItem.description,
    quantity: String(lineItem.quantity),
    unitPrice: String(lineItem.unitPrice),
  };
}

function updateLineItem(
  setLineItems: Dispatch<SetStateAction<EditableLineItem[]>>,
  index: number,
  field: keyof EditableLineItem,
  value: string,
) {
  setLineItems((current) =>
    current.map((lineItem, lineIndex) =>
      lineIndex === index ? { ...lineItem, [field]: value } : lineItem,
    ),
  );
}

function readAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}
