"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { Invoice, InvoiceLineItem } from "@/types/invoice";
import type { InternalUserRole } from "@/types/permissions";
import type { PhaseOneWorkOrder } from "@/types/work-order";
import {
  createInvoiceAction,
  updateInvoiceAction,
  type InvoiceActionState,
} from "@/lib/invoices/actions";
import {
  calculateInvoiceLineTotal,
  calculateInvoiceSubtotal,
  calculateInvoiceTotal,
  formatInvoiceCurrency,
} from "@/lib/invoices/money";
import { FormSubmitButton } from "@/components/work-orders/form-submit-button";

const emptyState: InvoiceActionState = {
  ok: false,
};

const blankLineItem = {
  id: "",
  description: "",
  quantity: "1",
  unitPrice: "0",
};

interface EditableLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export function InvoiceForm({
  mode,
  role,
  workOrder,
  invoice,
}: {
  mode: "create" | "edit";
  role: InternalUserRole;
  workOrder: PhaseOneWorkOrder;
  invoice?: Invoice;
}) {
  const action = mode === "create" ? createInvoiceAction : updateInvoiceAction;
  const [state, formAction] = useActionState(action, emptyState);
  const [lineItems, setLineItems] = useState<EditableLineItem[]>(
    invoice?.lineItems.map(toEditableLineItem) ?? [
      {
        ...blankLineItem,
        description: workOrder.title,
      },
    ],
  );
  const [taxAmount, setTaxAmount] = useState(String(invoice?.taxAmount ?? "0"));
  const [currency, setCurrency] = useState(invoice?.currency ?? "CAD");

  const totals = useMemo(() => {
    const computedLines = lineItems.map((lineItem) => ({
      lineTotal: calculateInvoiceLineTotal(
        readAmount(lineItem.quantity),
        readAmount(lineItem.unitPrice),
      ),
    }));
    const subtotalAmount = calculateInvoiceSubtotal(computedLines);
    const totalAmount = calculateInvoiceTotal(subtotalAmount, readAmount(taxAmount));

    return { subtotalAmount, totalAmount };
  }, [lineItems, taxAmount]);

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-lg border border-neutral-200 bg-white p-5"
    >
      <input type="hidden" name="actorRole" value={role} />
      <input type="hidden" name="workOrderId" value={workOrder.id} />
      <input type="hidden" name="lineItemCount" value={lineItems.length} />
      {invoice ? <input type="hidden" name="invoiceId" value={invoice.id} /> : null}

      {state.message ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-neutral-700">
          Due date <span className="text-rose-700">*</span>
          <input
            name="dueDate"
            type="date"
            defaultValue={invoice?.dueDate ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
          />
          {state.errors?.dueDate ? (
            <span className="mt-1 block text-xs text-rose-700">
              {state.errors.dueDate}
            </span>
          ) : null}
        </label>

        <label className="text-sm font-medium text-neutral-700">
          Currency <span className="text-rose-700">*</span>
          <select
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as "CAD" | "USD")}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
          >
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
          </select>
          {state.errors?.currency ? (
            <span className="mt-1 block text-xs text-rose-700">
              {state.errors.currency}
            </span>
          ) : null}
        </label>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
            Computed total
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-950">
            {formatInvoiceCurrency(totals.totalAmount, currency)}
          </p>
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">
              Line items
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Quantity and unit price compute each line total.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLineItems((items) => [...items, blankLineItem])}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
          >
            Add line
          </button>
        </div>
        {state.errors?.lineItems ? (
          <p className="mt-2 text-xs text-rose-700">{state.errors.lineItems}</p>
        ) : null}
        <div className="mt-4 space-y-3">
          {lineItems.map((lineItem, index) => (
            <div
              key={`${lineItem.id}-${index}`}
              className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-[1fr_8rem_10rem_10rem_auto]"
            >
              <input
                type="hidden"
                name={`lineItemId-${index}`}
                value={lineItem.id}
              />
              <TextInput
                label="Description"
                name={`lineItemDescription-${index}`}
                value={lineItem.description}
                onChange={(value) => updateLineItem(index, "description", value)}
              />
              <TextInput
                label="Quantity"
                name={`lineItemQuantity-${index}`}
                type="number"
                value={lineItem.quantity}
                onChange={(value) => updateLineItem(index, "quantity", value)}
              />
              <TextInput
                label="Unit price"
                name={`lineItemUnitPrice-${index}`}
                type="number"
                value={lineItem.unitPrice}
                onChange={(value) => updateLineItem(index, "unitPrice", value)}
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
                type="button"
                onClick={() =>
                  setLineItems((items) =>
                    items.length === 1
                      ? [blankLineItem]
                      : items.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                className="self-end rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-neutral-700">
          Tax amount <span className="text-rose-700">*</span>
          <input
            name="taxAmount"
            type="number"
            min="0"
            step="0.01"
            value={taxAmount}
            onChange={(event) => setTaxAmount(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
          />
          {state.errors?.taxAmount ? (
            <span className="mt-1 block text-xs text-rose-700">
              {state.errors.taxAmount}
            </span>
          ) : null}
        </label>
        <SummaryTotal
          label="Subtotal"
          value={formatInvoiceCurrency(totals.subtotalAmount, currency)}
        />
        <SummaryTotal
          label="Total"
          value={formatInvoiceCurrency(totals.totalAmount, currency)}
        />
      </div>

      <label className="block text-sm font-medium text-neutral-700">
        Internal finance notes
        <textarea
          name="internalFinanceNotes"
          defaultValue={invoice?.internalFinanceNotes ?? ""}
          rows={4}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <FormSubmitButton pendingLabel="Saving...">
          {mode === "create" ? "Save invoice draft" : "Save draft changes"}
        </FormSubmitButton>
        <Link
          href={`/work-orders/${workOrder.id}?role=${role}`}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
        >
          Cancel
        </Link>
      </div>
    </form>
  );

  function updateLineItem(
    index: number,
    field: keyof EditableLineItem,
    value: string,
  ) {
    setLineItems((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }
}

function TextInput({
  label,
  name,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      <input
        name={name}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      />
    </label>
  );
}

function SummaryTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
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

function readAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}
