"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ContractorPortalWorkOrderDetail } from "@/modules/work-orders/contractor-portal";
import {
  submitContractorQuoteAction,
  type ContractorPortalFormState,
} from "@/modules/contractors/server/contractor-portal-actions";
import { formatCurrency } from "@/lib/quotes/money";
import { FormSubmitButton } from "@/components/work-orders/form-submit-button";

const emptyState: ContractorPortalFormState = { ok: false };

interface EditableLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

function emptyLineItem(): EditableLineItem {
  return {
    description: "",
    quantity: "1",
    unitPrice: "0",
  };
}

export function ContractorQuoteForm({
  workOrder,
}: {
  workOrder: ContractorPortalWorkOrderDetail;
}) {
  const [state, formAction] = useActionState(
    submitContractorQuoteAction,
    emptyState,
  );
  const [lineItems, setLineItems] = useState<EditableLineItem[]>(
    workOrder.quote?.lineItems.map((lineItem) => ({
      description: lineItem.description,
      quantity: String(lineItem.quantity),
      unitPrice: String(lineItem.unitPrice),
    })) ?? [emptyLineItem()],
  );
  const [taxAmount, setTaxAmount] = useState(String(workOrder.quote?.taxAmount ?? 0));
  const [notes, setNotes] = useState(workOrder.quote?.notes ?? "");

  const computedLineItems = lineItems.map((lineItem) => ({
    description: lineItem.description.trim(),
    quantity: readAmount(lineItem.quantity),
    unitPrice: readAmount(lineItem.unitPrice),
  }));
  const subtotal = roundMoney(
    computedLineItems.reduce(
      (sum, lineItem) => sum + roundMoney(lineItem.quantity * lineItem.unitPrice),
      0,
    ),
  );
  const totalAmount = roundMoney(subtotal + readAmount(taxAmount));

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
      <input type="hidden" name="workOrderId" value={workOrder.id} />
      <input type="hidden" name="lineItemsJson" value={JSON.stringify(computedLineItems)} />

      {state.message ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Subtotal" value={formatCurrency(subtotal)} />
        <SummaryCard label="Tax" value={formatCurrency(readAmount(taxAmount))} />
        <SummaryCard label="Total" value={formatCurrency(totalAmount)} />
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:col-span-3">
          <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
            Assignment
          </p>
          <p className="mt-2 text-sm font-semibold text-neutral-950">
            {workOrder.assignment.status}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">Line items</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Submit the contractor-side estimate as itemized scope, labor, and materials.
            </p>
          </div>
          <button
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
            onClick={() => setLineItems((current) => [...current, emptyLineItem()])}
            type="button"
          >
            Add line
          </button>
        </div>

        {lineItems.map((lineItem, index) => (
          <div
            key={`line-item-${index}`}
            className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-[1fr_8rem_10rem_10rem_auto]"
          >
            <TextField
              label="Description"
              onChange={(value) =>
                updateLineItem(setLineItems, index, "description", value)
              }
              value={lineItem.description}
            />
            <TextField
              label="Qty"
              onChange={(value) => updateLineItem(setLineItems, index, "quantity", value)}
              type="number"
              value={lineItem.quantity}
            />
            <TextField
              label="Unit price"
              onChange={(value) =>
                updateLineItem(setLineItems, index, "unitPrice", value)
              }
              type="number"
              value={lineItem.unitPrice}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
                Line total
              </p>
              <p className="mt-2 text-sm font-semibold text-neutral-950">
                {formatCurrency(
                  roundMoney(
                    readAmount(lineItem.quantity) * readAmount(lineItem.unitPrice),
                  ),
                )}
              </p>
            </div>
            <button
              className="self-end rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500 disabled:opacity-60"
              disabled={lineItems.length === 1}
              onClick={() =>
                setLineItems((current) =>
                  current.length === 1
                    ? current
                    : current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              type="button"
            >
              Remove
            </button>
          </div>
        ))}

        {state.errors?.lineItems ? (
          <p className="text-xs text-rose-700">{state.errors.lineItems}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Tax amount"
          name="taxAmount"
          onChange={setTaxAmount}
          type="number"
          value={taxAmount}
          error={state.errors?.taxAmount}
        />
        <TextareaField
          label="Contractor notes"
          name="notes"
          onChange={setNotes}
          value={notes}
          fullWidth
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <FormSubmitButton pendingLabel="Submitting...">
          Submit quote
        </FormSubmitButton>
        <Link href={`/contractor/work-orders/${workOrder.id}`} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "number" | "text";
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      <span className="text-rose-700"> *</span>
      <input
        name={name}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      />
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

function TextareaField({
  label,
  name,
  value,
  onChange,
  fullWidth = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <label className={fullWidth ? "text-sm font-medium text-neutral-700 md:col-span-2" : "text-sm font-medium text-neutral-700"}>
      {label}
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
      />
    </label>
  );
}

function readAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function updateLineItem(
  setLineItems: Dispatch<SetStateAction<EditableLineItem[]>>,
  index: number,
  field: keyof EditableLineItem,
  value: string,
) {
  setLineItems((current) =>
    current.map((lineItem, itemIndex) =>
      itemIndex === index ? { ...lineItem, [field]: value } : lineItem,
    ),
  );
}
