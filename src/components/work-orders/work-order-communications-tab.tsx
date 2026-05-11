"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkOrderAddCommunicationPanel } from "./work-order-add-communication-panel";
import {
  buildWorkOrderCommunicationTimeline,
  deriveWorkOrderCommunicationSummary,
  deriveWorkOrderFollowUpSnapshot,
  type WorkOrderCommunicationAssignmentNoteSnapshot,
  type WorkOrderCommunicationMessageItem,
} from "./work-order-communication-model";
import { WorkOrderCommunicationSummaryPanel } from "./work-order-communication-summary-panel";
import { WorkOrderCommunicationTimeline } from "./work-order-communication-timeline";
import { WorkOrderClientCommunications } from "./work-order-client-communications";
import { WorkOrderContractorCommunications } from "./work-order-contractor-communications";
import type {
  WorkOrderNoteSnapshot,
  WorkOrderTimelineEntry,
} from "./work-order-display-model";
import { WorkOrderFollowUpSnapshot } from "./work-order-follow-up-snapshot";
import { WorkOrderInternalNotesSection } from "./work-order-internal-notes-section";

interface WorkOrderCommunicationNoteItem extends WorkOrderNoteSnapshot {
  workOrderId: string;
  createdByUserId: string;
}

interface WorkOrderCommunicationsTabProps {
  assignedContractorLabel: string;
  assignments: WorkOrderCommunicationAssignmentNoteSnapshot[];
  canAddNote: boolean;
  notes: WorkOrderCommunicationNoteItem[];
  onNotesChange: (notes: WorkOrderCommunicationNoteItem[]) => void;
  timeline: WorkOrderTimelineEntry[];
  workOrderId: string;
}

interface WorkOrderCommunicationsResponse {
  data?: {
    communications?: WorkOrderCommunicationMessageItem[];
  };
}

interface WorkOrderNotesResponse {
  data?: {
    notes?: WorkOrderCommunicationNoteItem[];
  };
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function WorkOrderCommunicationsTab({
  assignedContractorLabel,
  assignments,
  canAddNote,
  notes,
  onNotesChange,
  timeline,
  workOrderId,
}: WorkOrderCommunicationsTabProps) {
  const [communications, setCommunications] = useState<WorkOrderCommunicationMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCommunications() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/work-orders/${workOrderId}/communications`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | WorkOrderCommunicationsResponse
          | ApiErrorResponse;

        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Unable to load communications."));
        }

        if (!cancelled) {
          setCommunications(
            (payload as WorkOrderCommunicationsResponse).data?.communications ?? [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load communications.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCommunications();

    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  const timelineItems = useMemo(
    () =>
      buildWorkOrderCommunicationTimeline({
        assignments,
        communications,
        notes,
        timeline,
      }),
    [assignments, communications, notes, timeline],
  );
  const summary = useMemo(
    () =>
      deriveWorkOrderCommunicationSummary({
        assignedContractorLabel,
        assignments,
        communications,
        notes,
        timeline,
      }),
    [assignedContractorLabel, assignments, communications, notes, timeline],
  );
  const followUpSnapshot = useMemo(
    () =>
      deriveWorkOrderFollowUpSnapshot({
        assignedContractorLabel,
        items: timelineItems,
      }),
    [assignedContractorLabel, timelineItems],
  );
  const clientCommunications = timelineItems.filter((item) => item.audience === "client");
  const contractorCommunications = timelineItems.filter(
    (item) => item.audience === "contractor",
  );

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

  async function createInternalNote(body: string) {
    const response = await fetch(`/api/work-orders/${workOrderId}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    });
    const payload = (await response.json()) as WorkOrderNotesResponse | ApiErrorResponse;
    if (!response.ok) {
      throw new Error(getApiErrorMessage(payload, "Unable to add note."));
    }

    await refreshNotes();
    await refreshCommunications();
  }

  async function createAudienceCommunication(
    audience: "client" | "contractor",
    input: { body: string; subject: string | null },
  ) {
    const response = await fetch(`/api/work-orders/${workOrderId}/communications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audience,
        body: input.body,
        subject: input.subject,
      }),
    });
    const payload = (await response.json()) as WorkOrderCommunicationsResponse | ApiErrorResponse;
    if (!response.ok) {
      throw new Error(getApiErrorMessage(payload, `Unable to send ${audience} communication.`));
    }

    await refreshCommunications();
  }

  async function refreshCommunications() {
    const response = await fetch(`/api/work-orders/${workOrderId}/communications`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as
      | WorkOrderCommunicationsResponse
      | ApiErrorResponse;
    if (!response.ok) {
      throw new Error(getApiErrorMessage(payload, "Unable to refresh communications."));
    }
    setCommunications((payload as WorkOrderCommunicationsResponse).data?.communications ?? []);
  }

  return (
    <section
      aria-labelledby="work-order-tab-communications"
      className="space-y-4"
      id="work-order-panel-communications"
      role="tabpanel"
    >
      <WorkOrderCommunicationSummaryPanel summary={summary} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.95fr)]">
        <WorkOrderAddCommunicationPanel
          canAddNote={canAddNote}
          hasAssignedContractor={assignedContractorLabel !== "Unassigned"}
          onCreateClientCommunication={(input) =>
            createAudienceCommunication("client", input)
          }
          onCreateContractorCommunication={(input) =>
            createAudienceCommunication("contractor", input)
          }
          onCreateInternalNote={createInternalNote}
        />
        <WorkOrderFollowUpSnapshot snapshot={followUpSnapshot} />
      </div>

      {loadError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800 shadow-sm">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-neutral-200 bg-white px-5 py-6 text-sm text-neutral-600 shadow-sm">
          Loading communication history...
        </div>
      ) : (
        <>
          <WorkOrderCommunicationTimeline items={timelineItems} />

          <div className="grid gap-4 xl:grid-cols-2">
            <WorkOrderClientCommunications
              items={clientCommunications}
              supported
            />
            <WorkOrderContractorCommunications
              items={contractorCommunications}
              supported
            />
          </div>
        </>
      )}

      <WorkOrderInternalNotesSection notes={notes} />
    </section>
  );
}

function getApiErrorMessage(
  payload: WorkOrderCommunicationsResponse | WorkOrderNotesResponse | ApiErrorResponse,
  fallback: string,
): string {
  if ("error" in payload && payload.error?.message) {
    return payload.error.message;
  }

  return fallback;
}
