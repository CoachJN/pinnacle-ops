"use client";

import type { FormEvent } from "react";
import { useId, useState } from "react";

type ComposerMode = "internal" | "client" | "contractor";

interface WorkOrderAddCommunicationPanelProps {
  canAddNote: boolean;
  hasAssignedContractor: boolean;
  onCreateClientCommunication: (input: { body: string; subject: string | null }) => Promise<void>;
  onCreateContractorCommunication: (input: {
    body: string;
    subject: string | null;
  }) => Promise<void>;
  onCreateInternalNote: (body: string) => Promise<void>;
}

export function WorkOrderAddCommunicationPanel({
  canAddNote,
  hasAssignedContractor,
  onCreateClientCommunication,
  onCreateContractorCommunication,
  onCreateInternalNote,
}: WorkOrderAddCommunicationPanelProps) {
  const bodyId = useId();
  const subjectId = useId();
  const [mode, setMode] = useState<ComposerMode>("internal");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedBody = body.trim();
    const normalizedSubject = subject.trim() || null;

    if (!normalizedBody) {
      setErrorMessage("Enter a note or message before submitting.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "internal") {
        await onCreateInternalNote(normalizedBody);
      } else if (mode === "client") {
        await onCreateClientCommunication({
          body: normalizedBody,
          subject: normalizedSubject,
        });
      } else {
        await onCreateContractorCommunication({
          body: normalizedBody,
          subject: normalizedSubject,
        });
      }

      setBody("");
      setSubject("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save communication.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const contractorDisabled = !hasAssignedContractor;
  const showSubject = mode !== "internal";

  return (
    <section
      aria-labelledby="work-order-add-communication-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className="text-lg font-semibold text-neutral-950"
            id="work-order-add-communication-heading"
          >
            Add Communication / Note
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Capture an internal note or send a supported client or contractor update.
          </p>
        </div>
        {!canAddNote ? (
          <span className="inline-flex rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
            Read only
          </span>
        ) : null}
      </div>

      <div
        aria-label="Communication visibility"
        className="mt-5 flex flex-wrap gap-2"
        role="tablist"
      >
        <ComposerButton
          active={mode === "internal"}
          label="Internal note"
          onClick={() => setMode("internal")}
        />
        <ComposerButton
          active={mode === "client"}
          label="Client update"
          onClick={() => setMode("client")}
        />
        <ComposerButton
          active={mode === "contractor"}
          disabled={contractorDisabled}
          label="Contractor update"
          onClick={() => setMode("contractor")}
        />
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        {showSubject ? (
          <div>
            <label
              className="mb-2 block text-sm font-medium text-neutral-900"
              htmlFor={subjectId}
            >
              Subject
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
              disabled={!canAddNote || isSubmitting}
              id={subjectId}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={
                mode === "client"
                  ? "Client update summary"
                  : "Contractor dispatch or follow-up summary"
              }
              value={subject}
            />
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-900" htmlFor={bodyId}>
            {mode === "internal" ? "Internal note" : "Message body"}
          </label>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
            disabled={!canAddNote || isSubmitting}
            id={bodyId}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              mode === "internal"
                ? "Capture a blocker, call summary, or handoff note."
                : "Write the message exactly as it should be recorded."
            }
            value={body}
          />
        </div>

        <p className="text-xs text-neutral-500">
          {mode === "internal"
            ? "Internal note"
            : mode === "client"
              ? "This uses the existing client-visible communication endpoint."
              : contractorDisabled
                ? "A contractor-visible message requires an assigned contractor."
                : "This uses the existing contractor-visible communication endpoint."}
        </p>

        {errorMessage ? (
          <p className="text-sm text-rose-700">{errorMessage}</p>
        ) : null}

        <div className="flex justify-end">
          <button
            className="inline-flex items-center justify-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={!canAddNote || isSubmitting || (mode === "contractor" && contractorDisabled)}
            type="submit"
          >
            {isSubmitting
              ? "Saving..."
              : mode === "internal"
                ? "Add note"
                : "Send communication"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ComposerButton({
  active,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "inline-flex rounded-full border border-neutral-900 bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white"
          : "inline-flex rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
      }
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
