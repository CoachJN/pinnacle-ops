"use client";

import { useCallback, useEffect, useState } from "react";

interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface ContractorQuoteRecord {
  id: string;
  status: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientQuoteRecord {
  id: string;
  status: string;
  sourceContractorQuoteId: string | null;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QuoteWorkflowResponse {
  contractorQuotes: ContractorQuoteRecord[];
  clientQuotes: ClientQuoteRecord[];
  activeClientQuote: ClientQuoteRecord | null;
  visibility: {
    showContractorQuotes: boolean;
    showClientQuotes: boolean;
  };
  capabilities: {
    canSubmitContractorQuote: boolean;
    canReviewContractorQuote: boolean;
    canCreateClientQuote: boolean;
    canSendClientQuote: boolean;
    canApproveClientQuote: boolean;
    canRejectClientQuote: boolean;
  };
}

const emptyLineItem = (): QuoteLineItem => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
  lineTotal: 0,
});

export function WorkOrderQuotePanel({ workOrderId }: { workOrderId: string }) {
  const [data, setData] = useState<QuoteWorkflowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contractorItems, setContractorItems] = useState<QuoteLineItem[]>([emptyLineItem()]);
  const [contractorNotes, setContractorNotes] = useState("");
  const [manualItems, setManualItems] = useState<QuoteLineItem[]>([emptyLineItem()]);
  const [manualNotes, setManualNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/quote-workflow`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as QuoteWorkflowResponse & {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Unable to load quote workflow.");
      }

      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load quote workflow.");
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAction(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/quote-workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Quote workflow action failed.");
      }

      await load();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Quote workflow action failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-950">Quote workflow</h2>
        <p className="mt-2 text-sm text-neutral-600">Loading quote workflow…</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">Quote workflow</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Contractor quotes stay internal. Client-facing quotes are generated and controlled separately.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {data?.capabilities.canSubmitContractorQuote ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="text-sm font-semibold text-neutral-950">Contractor quote submission</h3>
          <LineItemEditor items={contractorItems} onChange={setContractorItems} />
          <label className="mt-4 block text-sm font-medium text-neutral-700">
            Notes
            <textarea
              value={contractorNotes}
              onChange={(event) => setContractorNotes(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
            />
          </label>
          <TotalsSummary items={contractorItems} />
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton
              disabled={saving}
              label="Save draft"
              onClick={() =>
                void submitAction({
                  action: "save_contractor_draft",
                  ...buildQuotePayload(contractorItems, contractorNotes),
                })
              }
            />
            <ActionButton
              disabled={saving}
              label="Submit quote"
              onClick={() =>
                void submitAction({
                  action: "submit_contractor_quote",
                  ...buildQuotePayload(contractorItems, contractorNotes),
                })
              }
            />
          </div>
        </div>
      ) : null}

      {data?.visibility.showContractorQuotes ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-950">Contractor quote history</h3>
          <div className="mt-3 space-y-3">
            {data.contractorQuotes.map((quote) => (
              <div key={quote.id} className="rounded-lg border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">{quote.status}</p>
                    <p className="text-xs text-neutral-500">Created {formatDateTime(quote.createdAt)}</p>
                  </div>
                  <p className="text-sm font-semibold text-neutral-950">
                    {formatCurrency(quote.totalAmount)}
                  </p>
                </div>
                <LineItemReadOnly items={quote.lineItems} />
                {quote.notes ? <p className="mt-3 text-sm text-neutral-700">{quote.notes}</p> : null}
                {quote.rejectionReason ? (
                  <p className="mt-2 text-sm text-rose-700">Rejected: {quote.rejectionReason}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  {data.capabilities.canReviewContractorQuote &&
                  (quote.status === "submitted" || quote.status === "under_review") ? (
                    <>
                      <ActionButton
                        disabled={saving}
                        label="Accept"
                        onClick={() =>
                          void submitAction({
                            action: "review_contractor_quote",
                            contractorQuoteId: quote.id,
                            decision: "accept",
                          })
                        }
                      />
                      <ActionButton
                        disabled={saving}
                        label="Reject"
                        tone="danger"
                        onClick={() =>
                          void submitAction({
                            action: "review_contractor_quote",
                            contractorQuoteId: quote.id,
                            decision: "reject",
                            rejectionReason,
                          })
                        }
                      />
                    </>
                  ) : null}
                  {data.capabilities.canCreateClientQuote &&
                  quote.status === "accepted" &&
                  !data.activeClientQuote ? (
                    <ActionButton
                      disabled={saving}
                      label="Create client quote"
                      onClick={() =>
                        void submitAction({
                          action: "create_client_quote_from_contractor_quote",
                          contractorQuoteId: quote.id,
                        })
                      }
                    />
                  ) : null}
                </div>
              </div>
            ))}
            {data.contractorQuotes.length === 0 ? (
              <p className="text-sm text-neutral-600">No contractor quotes yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {data?.capabilities.canReviewContractorQuote ? (
        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Rejection reason
          <input
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
          />
        </label>
      ) : null}

      {data?.capabilities.canCreateClientQuote && !data.activeClientQuote ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="text-sm font-semibold text-neutral-950">Manual client quote</h3>
          <LineItemEditor items={manualItems} onChange={setManualItems} />
          <label className="mt-4 block text-sm font-medium text-neutral-700">
            Notes
            <textarea
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
            />
          </label>
          <TotalsSummary items={manualItems} />
          <div className="mt-4">
            <ActionButton
              disabled={saving}
              label="Create manual client quote"
              onClick={() =>
                void submitAction({
                  action: "create_manual_client_quote",
                  ...buildQuotePayload(manualItems, manualNotes),
                })
              }
            />
          </div>
        </div>
      ) : null}

      {data?.visibility.showClientQuotes ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-950">Client quote history</h3>
          <div className="mt-3 space-y-3">
            {data.clientQuotes.map((quote) => (
              <div key={quote.id} className="rounded-lg border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">{quote.status}</p>
                    <p className="text-xs text-neutral-500">Created {formatDateTime(quote.createdAt)}</p>
                  </div>
                  <p className="text-sm font-semibold text-neutral-950">
                    {formatCurrency(quote.totalAmount)}
                  </p>
                </div>
                <LineItemReadOnly items={quote.lineItems} />
                {quote.notes ? <p className="mt-3 text-sm text-neutral-700">{quote.notes}</p> : null}
                {quote.rejectionReason ? (
                  <p className="mt-2 text-sm text-rose-700">Rejected: {quote.rejectionReason}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  {data.capabilities.canSendClientQuote && quote.status === "draft" ? (
                    <ActionButton
                      disabled={saving}
                      label="Send client quote"
                      onClick={() =>
                        void submitAction({
                          action: "send_client_quote",
                          clientQuoteId: quote.id,
                        })
                      }
                    />
                  ) : null}
                  {data.capabilities.canApproveClientQuote && quote.status === "sent" ? (
                    <ActionButton
                      disabled={saving}
                      label="Approve"
                      onClick={() =>
                        void submitAction({
                          action: "approve_client_quote",
                          clientQuoteId: quote.id,
                        })
                      }
                    />
                  ) : null}
                  {data.capabilities.canRejectClientQuote && quote.status === "sent" ? (
                    <ActionButton
                      disabled={saving}
                      label="Reject"
                      tone="danger"
                      onClick={() =>
                        void submitAction({
                          action: "reject_client_quote",
                          clientQuoteId: quote.id,
                          rejectionReason,
                        })
                      }
                    />
                  ) : null}
                </div>
              </div>
            ))}
            {data.clientQuotes.length === 0 ? (
              <p className="text-sm text-neutral-600">No client-facing quotes yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
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
      items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const next = {
          ...item,
          ...patch,
        };
        return {
          ...next,
          lineTotal: roundMoney(next.quantity * next.unitPrice),
        };
      }),
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item, index) => (
        <div key={`${index}-${item.description}`} className="grid gap-3 md:grid-cols-4">
          <input
            placeholder="Description"
            value={item.description}
            onChange={(event) => updateItem(index, { description: event.target.value })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 md:col-span-2"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.quantity}
            onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.unitPrice}
            onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, emptyLineItem()])}
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500"
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
        <div key={`${item.description}-${index}`} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-neutral-700">
            {item.description} x {item.quantity}
          </span>
          <span className="font-medium text-neutral-950">{formatCurrency(item.lineTotal)}</span>
        </div>
      ))}
    </div>
  );
}

function TotalsSummary({ items }: { items: QuoteLineItem[] }) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const taxAmount = 0;
  const totalAmount = roundMoney(subtotal + taxAmount);

  return (
    <div className="mt-4 rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
      <div className="flex items-center justify-between">
        <span>Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span>Tax</span>
        <span>{formatCurrency(taxAmount)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between font-semibold text-neutral-950">
        <span>Total</span>
        <span>{formatCurrency(totalAmount)}</span>
      </div>
    </div>
  );
}

function ActionButton({
  disabled,
  label,
  onClick,
  tone = "default",
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        tone === "danger"
          ? "rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
          : "rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
}

function buildQuotePayload(items: QuoteLineItem[], notes: string) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  return {
    lineItems: items,
    subtotal,
    taxAmount: 0,
    totalAmount: subtotal,
    notes,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
