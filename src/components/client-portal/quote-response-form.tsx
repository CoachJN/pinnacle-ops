"use client";

import { startTransition, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface QuoteResponseFormProps {
  quoteId: string;
  workOrderId: string;
}

export function QuoteResponseForm({
  quoteId,
  workOrderId,
}: QuoteResponseFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [rejectionReason, setRejectionReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/quote-workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: mode === "approve" ? "approve_client_quote" : "reject_client_quote",
          clientQuoteId: quoteId,
          rejectionReason: mode === "reject" ? rejectionReason : undefined,
        }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Unable to submit quote response.");
      }

      startTransition(() => {
        router.push(`/portal/quotes/${quoteId}`);
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit quote response.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Response
        </p>
        <div className="mt-4 grid gap-3">
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
            <input
              checked={mode === "approve"}
              name="decision"
              onChange={() => setMode("approve")}
              type="radio"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-950">
                Approve quote
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                Confirm the quoted work can move forward.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
            <input
              checked={mode === "reject"}
              name="decision"
              onChange={() => setMode("reject")}
              type="radio"
            />
            <span className="w-full">
              <span className="block text-sm font-semibold text-slate-950">
                Reject quote
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                Let the team know why this quote needs revision.
              </span>
              {mode === "reject" ? (
                <textarea
                  className="mt-3 min-h-28 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500"
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Provide the reason this quote should be revised."
                  required
                  value={rejectionReason}
                />
              ) : null}
            </span>
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Submitting..." : mode === "approve" ? "Approve quote" : "Reject quote"}
        </button>
      </div>
    </form>
  );
}
