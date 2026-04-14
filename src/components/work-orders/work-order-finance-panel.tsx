"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Invoice } from "@/types/invoice";
import { buildInvoiceCreationEligibility } from "@/modules/finance";
import { InvoiceDetailCard } from "@/components/invoices/invoice-detail-card";
import { InvoiceHistoryList } from "./invoice-history-list";

type FinanceWorkOrderStatus = "NEW" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "READY_FOR_INVOICING" | "CANCELLED" | "CLOSED";

interface WorkOrderFinancePanelProps {
  onFinanceUpdated: () => Promise<void>;
  workOrderId: string;
  workOrderStatus: FinanceWorkOrderStatus;
}

interface InvoiceListResponse {
  invoices?: Invoice[];
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function WorkOrderFinancePanel({
  onFinanceUpdated,
  workOrderId,
  workOrderStatus,
}: WorkOrderFinancePanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentReference, setPaymentReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"error" | "success">("success");

  const currentInvoice = invoices.find((invoice) => invoice.status !== "void") ?? null;
  const invoiceCreation = buildInvoiceCreationEligibility({
    workOrderStatus: mapFinanceStatusToCanonical(workOrderStatus),
    hasActiveInvoice: currentInvoice !== null,
  });

  useEffect(() => {
    void refreshInvoices();
  }, [workOrderId]);

  async function refreshInvoices() {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/invoices`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as InvoiceListResponse | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          (payload as ApiErrorResponse).error?.message ?? "Unable to load invoice history.",
        );
      }

      const nextInvoices = (payload as InvoiceListResponse).invoices ?? [];
      setInvoices(nextInvoices);
      setPaymentReference(
        nextInvoices.find((invoice) => invoice.status !== "void")?.paymentReference ?? "",
      );
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to load invoice history.",
      );
    } finally {
      setIsLoading(false);
    }
  }

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
      await Promise.all([refreshInvoices(), onFinanceUpdated()]);
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
    <section className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-950">
            Finance
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Internal invoice creation, lifecycle control, and billing history for this work order.
          </p>
        </div>
        {invoiceCreation.eligible ? (
          <Link
            className="inline-flex rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            href={`/dashboard/work-orders/${workOrderId}/invoice/new`}
          >
            Create invoice
          </Link>
        ) : null}
      </div>

      {message ? (
        <div
          className={
            tone === "success"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          }
        >
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />
      ) : !currentInvoice ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5">
          <p className="text-sm font-semibold text-neutral-950">No invoice yet</p>
          <p className="mt-2 text-sm text-neutral-600">
            {invoiceCreation.reason ??
              "This work order will move into the finance queue once it is operationally ready."}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            MVP duplicate policy: single active invoice per work order.
          </p>
        </div>
      ) : (
        <>
          <InvoiceDetailCard invoice={currentInvoice} />

          <div className="flex flex-wrap gap-3">
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
              <button
                className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() =>
                  void handleTransition(
                    { toStatus: "sent" },
                    "Invoice sent and work order finance state refreshed.",
                  )
                }
                type="button"
              >
                Send invoice
              </button>
            ) : null}
            {currentInvoice.status === "sent" || currentInvoice.status === "viewed" ? (
              <button
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:border-amber-400 disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() =>
                  void handleTransition(
                    { toStatus: "overdue" },
                    "Invoice marked overdue.",
                  )
                }
                type="button"
              >
                Mark overdue
              </button>
            ) : null}
            {currentInvoice.status !== "paid" && currentInvoice.status !== "void" ? (
              <button
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:border-rose-400 disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() =>
                  void handleTransition(
                    { toStatus: "void" },
                    "Invoice voided and the work order finance state refreshed.",
                  )
                }
                type="button"
              >
                Void invoice
              </button>
            ) : null}
          </div>

          {currentInvoice.status === "sent" ||
          currentInvoice.status === "viewed" ||
          currentInvoice.status === "overdue" ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <label className="block text-sm font-medium text-neutral-700">
                Payment reference
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-600 focus:outline-none"
                  onChange={(event) => setPaymentReference(event.target.value)}
                  value={paymentReference}
                />
              </label>
              <button
                className="mt-3 rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() =>
                  void handleTransition(
                    {
                      toStatus: "paid",
                      paymentReference: paymentReference.trim() || null,
                    },
                    "Invoice marked paid and work order finance state refreshed.",
                  )
                }
                type="button"
              >
                Mark paid
              </button>
            </div>
          ) : null}
        </>
      )}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
          Invoice history
        </h3>
        <div className="mt-3">
          <InvoiceHistoryList
            buildInvoiceHref={(invoice) =>
              `/dashboard/work-orders/${workOrderId}/invoice/${invoice.id}`
            }
            invoices={invoices}
          />
        </div>
      </div>
    </section>
  );
}

function mapFinanceStatusToCanonical(status: FinanceWorkOrderStatus) {
  switch (status) {
    case "COMPLETED":
      return "completed" as const;
    case "READY_FOR_INVOICING":
      return "ready_for_invoicing" as const;
    case "CANCELLED":
      return "cancelled" as const;
    case "CLOSED":
      return "closed" as const;
    default:
      return "in_progress" as const;
  }
}
