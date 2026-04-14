"use client";

import type { FormEvent } from "react";
import { useId, useState } from "react";
import { formatDateTime } from "./formatting";

interface WorkOrderNoteItem {
  id: string;
  workOrderId: string;
  body: string;
  createdByUserId: string;
  authorDisplayName: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkOrderNotesPanelProps {
  workOrderId: string;
  notes: WorkOrderNoteItem[];
  canAddNote: boolean;
  onNotesChange: (notes: WorkOrderNoteItem[]) => void;
}

interface WorkOrderNotesResponse {
  data?: {
    notes?: WorkOrderNoteItem[];
  };
}

interface WorkOrderNoteCreateResponse {
  data?: {
    note?: WorkOrderNoteItem;
  };
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

const MIN_NOTE_LENGTH = 1;

export function WorkOrderNotesPanel({
  workOrderId,
  notes,
  canAddNote,
  onNotesChange,
}: WorkOrderNotesPanelProps) {
  const textareaId = useId();
  const [draftBody, setDraftBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refreshNotes() {
    const response = await fetch(`/api/work-orders/${workOrderId}/notes`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as WorkOrderNotesResponse | ApiErrorResponse;

    if (!response.ok) {
      throw new Error(getApiErrorMessage(payload, "Unable to refresh notes."));
    }

    onNotesChange((payload as WorkOrderNotesResponse).data?.notes ?? []);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedBody = draftBody.trim();
    if (normalizedBody.length < MIN_NOTE_LENGTH) {
      setFormError("Enter a note before submitting.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: normalizedBody,
        }),
      });
      const payload = (await response.json()) as
        | WorkOrderNoteCreateResponse
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Unable to add note."));
      }

      setDraftBody("");
      await refreshNotes();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to add note.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-neutral-950">Notes</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Working notes captured against this work order.
        </p>
      </div>

      {canAddNote ? (
        <form className="border-b border-neutral-200 px-6 py-5" onSubmit={handleSubmit}>
          <label
            className="mb-2 block text-sm font-medium text-neutral-900"
            htmlFor={textareaId}
          >
            Add internal note
          </label>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
            disabled={isSubmitting}
            id={textareaId}
            name="body"
            onChange={(event) => {
              setDraftBody(event.target.value);
              if (formError) {
                setFormError(null);
              }
              if (submitError) {
                setSubmitError(null);
              }
            }}
            placeholder="Add an internal note for this work order."
            value={draftBody}
          />
          {formError ? (
            <p className="mt-2 text-sm text-rose-700">{formError}</p>
          ) : null}
          {submitError ? (
            <p className="mt-2 text-sm text-rose-700">{submitError}</p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              Notes are internal-only for this phase.
            </p>
            <button
              className="inline-flex items-center justify-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Add note"}
            </button>
          </div>
        </form>
      ) : null}

      {notes.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-neutral-600">No notes have been added yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200">
          {notes.map((note) => (
            <article className="p-6" key={note.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-neutral-900">
                  Added by {note.authorDisplayName}
                </p>
                <p className="text-xs text-neutral-500">{formatDateTime(note.createdAt)}</p>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                {note.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function getApiErrorMessage(
  payload: WorkOrderNotesResponse | WorkOrderNoteCreateResponse | ApiErrorResponse,
  fallback: string,
): string {
  if ("error" in payload && payload.error?.message) {
    return payload.error.message;
  }

  return fallback;
}
