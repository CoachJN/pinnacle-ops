"use client";

import type { FormEvent } from "react";
import { useId, useState } from "react";
import { formatDateTime } from "./formatting";
import { WorkOrderEmptyState } from "./work-order-empty-state";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";

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
    const payload = (await response.json()) as
      | WorkOrderNotesResponse
      | ApiErrorResponse;

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

  const recentNotes = [...notes].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

  return (
    <WorkOrderSection id="workflow-operational-notes">
      <WorkOrderSectionHeader
        description="Internal-only notes for dispatch context, handoff details, and operator follow-up. Communications is the canonical review workspace for the full note and message history."
        title="Operational Notes"
      />

      {canAddNote ? (
        <form
          className="mt-4 border-t border-neutral-200 pt-4"
          onSubmit={handleSubmit}
        >
          <label
            className="mb-2 block text-sm font-medium text-neutral-900"
            htmlFor={textareaId}
          >
            Add internal note
          </label>
          <textarea
            className="min-h-24 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
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
            placeholder="Capture a blocker, scheduling update, or execution handoff note."
            value={draftBody}
          />
          {formError ? (
            <p className="mt-2 text-sm text-rose-700">{formError}</p>
          ) : null}
          {submitError ? (
            <p className="mt-2 text-sm text-rose-700">{submitError}</p>
          ) : null}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-500">
              Notes stay internal in this phase and do not appear in client or
              contractor views.
            </p>
            <button
              className="inline-flex items-center justify-center rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Add note"}
            </button>
          </div>
        </form>
      ) : null}

      {recentNotes.length === 0 ? (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <WorkOrderEmptyState
            message="Capture blockers, scheduling updates, and internal handoff details here."
            title="No operational notes have been added yet"
          />
        </div>
      ) : (
        <div className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200">
          {recentNotes.map((note) => (
            <article className="py-3" key={note.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-neutral-900">
                  Added by {note.authorDisplayName}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatDateTime(note.updatedAt)}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                {note.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </WorkOrderSection>
  );
}

function getApiErrorMessage(
  payload:
    | WorkOrderNotesResponse
    | WorkOrderNoteCreateResponse
    | ApiErrorResponse,
  fallback: string,
): string {
  if ("error" in payload && payload.error?.message) {
    return payload.error.message;
  }

  return fallback;
}
