"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ContractorPortalWorkOrderDetail } from "@/modules/work-orders/contractor-portal";
import {
  submitContractorQuoteAction,
  type ContractorPortalFormState,
} from "@/modules/contractors/server/contractor-portal-actions";
import { calculateQuoteTotal, formatCurrency } from "@/lib/quotes/money";
import { FormSubmitButton } from "@/components/work-orders/form-submit-button";

const emptyState: ContractorPortalFormState = { ok: false };

export function ContractorQuoteForm({
  workOrder,
}: {
  workOrder: ContractorPortalWorkOrderDetail;
}) {
  const [state, formAction] = useActionState(
    submitContractorQuoteAction,
    emptyState,
  );
  const [laborAmount, setLaborAmount] = useState(
    String(workOrder.quote?.laborAmount ?? "0"),
  );
  const [materialAmount, setMaterialAmount] = useState(
    String(workOrder.quote?.materialAmount ?? "0"),
  );
  const [otherAmount, setOtherAmount] = useState(
    String(workOrder.quote?.otherAmount ?? "0"),
  );
  const totalAmount = calculateQuoteTotal(
    readAmount(laborAmount),
    readAmount(materialAmount),
    readAmount(otherAmount),
  );

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
      <input type="hidden" name="workOrderId" value={workOrder.id} />
      {state.message ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.message}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
            Computed total
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-950">
            {formatCurrency(totalAmount)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
            Assignment
          </p>
          <p className="mt-2 text-sm font-semibold text-neutral-950">
            {workOrder.assignment.status}
          </p>
        </div>
        <MoneyField label="Labor amount" name="laborAmount" value={laborAmount} onChange={setLaborAmount} error={state.errors?.laborAmount} />
        <MoneyField label="Material amount" name="materialAmount" value={materialAmount} onChange={setMaterialAmount} error={state.errors?.materialAmount} />
        <MoneyField label="Other amount" name="otherAmount" value={otherAmount} onChange={setOtherAmount} error={state.errors?.otherAmount} />
        <TextareaField label="Scope summary" name="scopeSummary" defaultValue={workOrder.quote?.scopeSummary ?? ""} error={state.errors?.scopeSummary} required fullWidth />
        <TextareaField label="Contractor notes" name="contractorNotes" defaultValue={workOrder.quote?.contractorNotes ?? ""} fullWidth />
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

function MoneyField({
  label,
  name,
  value,
  onChange,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}<span className="text-rose-700"> *</span>
      <input name={name} type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none" />
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
  error,
  required = false,
  fullWidth = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <label className={fullWidth ? "text-sm font-medium text-neutral-700 md:col-span-2" : "text-sm font-medium text-neutral-700"}>
      {label}
      {required ? <span className="text-rose-700"> *</span> : null}
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={4} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none" />
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

function readAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}
