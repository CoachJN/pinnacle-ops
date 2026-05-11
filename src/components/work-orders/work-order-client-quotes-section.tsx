"use client";

import { useState } from "react";
import { formatInvoiceCurrency, roundCurrency } from "@/lib/invoices/money";
import type {
  ClientQuoteRecord,
  QuoteLineItem,
} from "./work-order-financial-model";
import { formatDateTime } from "./formatting";

const emptyLineItem = (): QuoteLineItem => ({
  description: "",
  lineTotal: 0,
  quantity: 1,
  unitPrice: 0,
});

export function WorkOrderClientQuotesSection({
  canApproveClientQuote,
  canCreateClientQuote,
  canRejectClientQuote,
  canSendClientQuote,
  clientQuotes,
  hasActiveClientQuote,
  isSaving,
  onSubmitAction,
}: {
  canApproveClientQuote: boolean;
  canCreateClientQuote: boolean;
  canRejectClientQuote: boolean;
  canSendClientQuote: boolean;
  clientQuotes: ClientQuoteRecord[];
  hasActiveClientQuote: boolean;
  isSaving: boolean;
  onSubmitAction: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [manualItems, setManualItems] = useState<QuoteLineItem[]>([emptyLineItem()]);
  const [manualNotes, setManualNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  return (
    <section className="rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">Client quotes</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Client-facing quote packaging, approval state, and revision follow-up.
          </p>
        </div>
      </div>

      {canCreateClientQuote && !hasActiveClientQuote ? (
        <div className="mt-5 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="text-sm font-semibold text-neutral-950">Manual client quote</h3>
          <LineItemEditor items={manualItems} onChange={setManualItems} />
          <label className="mt-4 block text-sm font-medium text-neutral-700">
            Notes
            <textarea
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
              onChange={(event) => setManualNotes(event.target.value)}
              rows={3}
              value={manualNotes}
            />
          </label>
          <TotalsSummary items={manualItems} />
          <div className="mt-4">
            <ActionButton
              disabled={isSaving}
              label="Create manual client quote"
              onClick={() =>
                void onSubmitAction(
                  buildQuotePayload("create_manual_client_quote", manualItems, manualNotes),
                )
              }
              tone="primary"
            />
          </div>
        </div>
      ) : null}

      {canRejectClientQuote ? (
        <label className="mt-5 block text-sm font-medium text-neutral-700">
          Rejection reason
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
            onChange={(event) => setRejectionReason(event.target.value)}
            value={rejectionReason}
          />
        </label>
      ) : null}

      <div className="mt-5 space-y-3">
        {clientQuotes.length === 0 ? (
          <EmptyState message="No client-facing quote has been created yet." />
        ) : (
          clientQuotes.map((quote) => (
            <article key={quote.id} className="rounded-3xl border border-neutral-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-950">
                    {humanizeStatus(quote.status)}
                  </p>
                  <div className="mt-1 space-y-1 text-xs text-neutral-500">
                    <p>Created {formatDateTime(quote.createdAt)}</p>
                    <p>Sent {formatDateTime(quote.sentAt)}</p>
                    <p>Approved {formatDateTime(quote.approvedAt)}</p>
                    <p>Rejected {formatDateTime(quote.rejectedAt)}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-neutral-950">
                  {formatInvoiceCurrency(quote.totalAmount, "CAD")}
                </p>
              </div>

              <LineItemReadOnly items={quote.lineItems} />

              {quote.notes ? (
                <p className="mt-3 rounded-2xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  {quote.notes}
                </p>
              ) : null}

              {quote.rejectionReason ? (
                <p className="mt-3 text-sm text-rose-700">Rejected: {quote.rejectionReason}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                {canSendClientQuote && quote.status === "draft" ? (
                  <ActionButton
                    disabled={isSaving}
                    label="Send client quote"
                    onClick={() =>
                      void onSubmitAction({
                        action: "send_client_quote",
                        clientQuoteId: quote.id,
                      })
                    }
                    tone="primary"
                  />
                ) : null}
                {canApproveClientQuote && quote.status === "sent" ? (
                  <ActionButton
                    disabled={isSaving}
                    label="Approve"
                    onClick={() =>
                      void onSubmitAction({
                        action: "approve_client_quote",
                        clientQuoteId: quote.id,
                      })
                    }
                  />
                ) : null}
                {canRejectClientQuote && quote.status === "sent" ? (
                  <ActionButton
                    disabled={isSaving}
                    label="Reject"
                    onClick={() =>
                      void onSubmitAction({
                        action: "reject_client_quote",
                        clientQuoteId: quote.id,
                        rejectionReason,
                      })
                    }
                    tone="danger"
                  />
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function buildQuotePayload(
  action: "create_manual_client_quote",
  items: QuoteLineItem[],
  notes: string,
) {
  const normalizedItems = items.map((item) => ({
    ...item,
    description: item.description.trim(),
    lineTotal: roundCurrency(item.quantity * item.unitPrice),
  }));
  const subtotal = roundCurrency(
    normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0),
  );

  return {
    action,
    lineItems: normalizedItems,
    notes: notes.trim() || null,
    subtotal,
    taxAmount: 0,
    totalAmount: subtotal,
  };
}

function LineItemEditor({
  items,
  onChange,
}: {
  items: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
}) {
  function updateItem(index: number, patch: Partial<QuoteLineItem>) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              lineTotal: roundCurrency(
                (patch.quantity ?? item.quantity) * (patch.unitPrice ?? item.unitPrice),
              ),
            }
          : item,
      ),
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item, index) => (
        <div key={`${index}-${item.description}`} className="grid gap-3 md:grid-cols-4">
          <input
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 md:col-span-2"
            onChange={(event) => updateItem(index, { description: event.target.value })}
            placeholder="Description"
            value={item.description}
          />
          <input
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
            min="0"
            onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
            step="0.01"
            type="number"
            value={item.quantity}
          />
          <input
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
            min="0"
            onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })}
            step="0.01"
            type="number"
            value={item.unitPrice}
          />
        </div>
      ))}
      <button
        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500"
        onClick={() => onChange([...items, emptyLineItem()])}
        type="button"
      >
        Add line item
      </button>
    </div>
  );
}

function LineItemReadOnly({ items }: { items: QuoteLineItem[] }) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((item, index) => (
        <div
          key={`${item.description}-${index}`}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-neutral-700">
            {item.description} x {item.quantity}
          </span>
          <span className="font-medium text-neutral-950">
            {formatInvoiceCurrency(item.lineTotal, "CAD")}
          </span>
        </div>
      ))}
    </div>
  );
}

function TotalsSummary({ items }: { items: QuoteLineItem[] }) {
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.lineTotal, 0));

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
      <div className="flex items-center justify-between">
        <span>Subtotal</span>
        <span>{formatInvoiceCurrency(subtotal, "CAD")}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span>Tax</span>
        <span>{formatInvoiceCurrency(0, "CAD")}</span>
      </div>
      <div className="mt-2 flex items-center justify-between font-semibold text-neutral-950">
        <span>Total</span>
        <span>{formatInvoiceCurrency(subtotal, "CAD")}</span>
      </div>
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
  tone?: "danger" | "primary" | "secondary";
}) {
  const className =
    tone === "primary"
      ? "bg-neutral-950 text-white hover:bg-neutral-800"
      : tone === "danger"
        ? "border border-rose-300 bg-rose-50 text-rose-800 hover:border-rose-400"
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm text-neutral-600">
      {message}
    </div>
  );
}

function humanizeStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
