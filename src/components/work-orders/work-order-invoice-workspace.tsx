"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InvoiceDetailCard } from "@/components/invoices/invoice-detail-card";
import { InvoiceHistoryList } from "./invoice-history-list";
import type { WorkOrderFinancialSummary } from "./work-order-financial-model";
import { formatDateTime } from "./formatting";
import type { ClientInvoice } from "@/types/invoice";

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

type FinanceWorkOrderStatus =
  | "new"
  | "triage"
  | "assigned"
  | "awaiting_contractor_response"
  | "quote_required"
  | "contractor_quote_received"
  | "quote_under_review"
  | "client_approval_requested"
  | "client_approved"
  | "contractor_scheduled"
  | "in_progress"
  | "work_completed"
  | "completion_review"
  | "ready_for_invoicing"
  | "invoiced"
  | "paid"
  | "closed"
  | "on_hold"
  | "escalated"
  | "cancelled";

interface WorkOrderInvoiceWorkspaceProps {
  errorMessage: string | null;
  invoices: ClientInvoice[];
  isLoading: boolean;
  onFinanceUpdated: () => Promise<void>;
  onRefreshInvoices: () => Promise<void>;
  workOrderId: string;
  workOrderStatus: FinanceWorkOrderStatus;
  summary: WorkOrderFinancialSummary;
}

export function WorkOrderInvoiceWorkspace({
  errorMessage,
  invoices,
  isLoading,
  onFinanceUpdated,
  onRefreshInvoices,
  summary,
  workOrderId,
  workOrderStatus,
}: WorkOrderInvoiceWorkspaceProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState(
    invoices.find((invoice) => invoice.status !== "void")?.paymentReference ?? "",
  );
  const [tone, setTone] = useState<"error" | "success">("success");
  const currentInvoice = invoices.find((invoice) => invoice.status !== "void") ?? null;

  useEffect(() => {
    setPaymentReference(currentInvoice?.paymentReference ?? "");
  }, [currentInvoice?.id, currentInvoice?.paymentReference]);

  async function handleTransition(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    if (!currentInvoice || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/work-orders/${workOrderId}/invoices/${currentInvoice.id}/transition`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Unable to update invoice status.");
      }

      setTone("success");
      setMessage(successMessage);
      await Promise.all([onRefreshInvoices(), onFinanceUpdated()]);
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to update invoice status.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm"
      id="finance-workflow"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">Invoice workspace</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Invoice readiness, finance actions, and recent billing state for this work order.
          </p>
        </div>
        {summary.invoiceReadiness.eligible ? (
          <Link
            className="inline-flex rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            href={`/dashboard/work-orders/${workOrderId}/invoice/new`}
          >
            Create invoice
          </Link>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <SummaryCard
          description={summary.invoiceReadiness.detail}
          label="Invoice readiness"
          value={summary.invoiceReadiness.label}
        />
        <SummaryCard
          description={`Invoices may be created when the work order is ${summary.invoiceReadiness.eligibleStatuses.map((status) => status.replaceAll("_", " ")).join(", ")}.`}
          label="Eligible statuses"
          value={workOrderStatus.replaceAll("_", " ")}
        />
        <SummaryCard
          description={summary.invoiceStatus.qboDetail ?? summary.invoiceStatus.detail}
          label="Current invoice"
          value={summary.invoiceStatus.label}
        />
      </div>

      {message || errorMessage ? (
        <div
          className={
            (message && tone === "success")
              ? "mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          }
        >
          {message ?? errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 h-40 animate-pulse rounded-2xl bg-neutral-100" />
      ) : !currentInvoice ? (
        <div className="mt-5 rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-5">
          <p className="text-sm font-semibold text-neutral-950">No invoice yet</p>
          <p className="mt-2 text-sm text-neutral-600">{summary.nextAction.detail}</p>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <InvoiceDetailCard invoice={currentInvoice} />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
              href={`/dashboard/work-orders/${workOrderId}/invoice/${currentInvoice.id}`}
            >
              View invoice
            </Link>
            {currentInvoice.status === "draft" ? (
              <Link
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
                href={`/dashboard/work-orders/${workOrderId}/invoice/${currentInvoice.id}/edit`}
              >
                Edit draft
              </Link>
            ) : null}
            {currentInvoice.status === "draft" ? (
              <ActionButton
                disabled={isSubmitting}
                label="Send invoice"
                onClick={() =>
                  void handleTransition(
                    { toStatus: "sent" },
                    "Invoice sent and finance state refreshed.",
                  )
                }
                tone="primary"
              />
            ) : null}
            {currentInvoice.status === "sent" || currentInvoice.status === "viewed" ? (
              <ActionButton
                disabled={isSubmitting}
                label="Mark overdue"
                onClick={() =>
                  void handleTransition({ toStatus: "overdue" }, "Invoice marked overdue.")
                }
                tone="warning"
              />
            ) : null}
            {currentInvoice.status !== "paid" && currentInvoice.status !== "void" ? (
              <ActionButton
                disabled={isSubmitting}
                label="Void invoice"
                onClick={() =>
                  void handleTransition(
                    { toStatus: "void" },
                    "Invoice voided and finance state refreshed.",
                  )
                }
                tone="danger"
              />
            ) : null}
          </div>

          {currentInvoice.status === "sent" ||
          currentInvoice.status === "viewed" ||
          currentInvoice.status === "overdue" ? (
            <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
              <label className="block text-sm font-medium text-neutral-700">
                Payment reference
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
                  onChange={(event) => setPaymentReference(event.target.value)}
                  value={paymentReference}
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">
                  Last invoice update {formatDateTime(currentInvoice.updatedAt)}
                </p>
                <ActionButton
                  disabled={isSubmitting}
                  label="Mark paid"
                  onClick={() =>
                    void handleTransition(
                      {
                        toStatus: "paid",
                        paymentReference: paymentReference.trim() || null,
                      },
                      "Invoice marked paid and finance state refreshed.",
                    )
                  }
                  tone="primary"
                />
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
          Invoice history
        </h3>
        <div className="mt-3">
          <InvoiceHistoryList
            buildInvoiceHref={(invoice) => `/dashboard/work-orders/${workOrderId}/invoice/${invoice.id}`}
            invoices={invoices}
          />
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  description,
  label,
  value,
}: {
  description: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-sm font-semibold text-neutral-950">{value}</p>
      <p className="mt-2 text-sm text-neutral-600">{description}</p>
    </div>
  );
}

function ActionButton({
  disabled,
  label,
  onClick,
  tone = "secondary",
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  tone?: "danger" | "primary" | "secondary" | "warning";
}) {
  const className =
    tone === "primary"
      ? "bg-neutral-950 text-white hover:bg-neutral-800"
      : tone === "danger"
        ? "border border-rose-300 bg-rose-50 text-rose-800 hover:border-rose-400"
        : tone === "warning"
          ? "border border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400"
          : "border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500";

  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${className}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
