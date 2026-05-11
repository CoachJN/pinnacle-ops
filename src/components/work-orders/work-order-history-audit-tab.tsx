"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkOrderAssignmentHistorySection } from "./work-order-assignment-history-section";
import {
  deriveWorkOrderAuditModel,
  type WorkOrderAuditAssignmentItem,
} from "./work-order-audit-model";
import { WorkOrderAuditSummaryPanel } from "./work-order-audit-summary-panel";
import { WorkOrderAuditTimeline } from "./work-order-audit-timeline";
import { WorkOrderCommunicationHistorySection } from "./work-order-communication-history-section";
import type { WorkOrderCommunicationMessageItem } from "./work-order-communication-model";
import { WorkOrderFinancialHistorySection } from "./work-order-financial-history-section";
import type {
  WorkOrderAttachmentSnapshot,
  WorkOrderNoteSnapshot,
  WorkOrderTimelineEntry,
} from "./work-order-display-model";
import type { QuoteWorkflowResponse } from "./work-order-financial-model";
import { WorkOrderStatusHistorySection } from "./work-order-status-history-section";
import { WorkOrderSystemEventsSection } from "./work-order-system-events-section";
import { useWorkOrderInvoices } from "./use-work-order-invoices";
import type { WorkOrderStatus } from "@/modules/work-orders";

interface WorkOrderHistoryAuditTabProps {
  assignments: WorkOrderAuditAssignmentItem[];
  attachments: WorkOrderAttachmentSnapshot[];
  currentStatus: WorkOrderStatus;
  notes: WorkOrderNoteSnapshot[];
  timeline: WorkOrderTimelineEntry[];
  updatedAt: string;
  workOrderId: string;
}

interface WorkOrderCommunicationsResponse {
  data?: {
    communications?: WorkOrderCommunicationMessageItem[];
  };
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function WorkOrderHistoryAuditTab({
  assignments,
  attachments,
  currentStatus,
  notes,
  timeline,
  updatedAt,
  workOrderId,
}: WorkOrderHistoryAuditTabProps) {
  const [communications, setCommunications] = useState<WorkOrderCommunicationMessageItem[]>([]);
  const [communicationsError, setCommunicationsError] = useState<string | null>(null);
  const [isLoadingCommunications, setIsLoadingCommunications] = useState(true);
  const [quoteData, setQuoteData] = useState<QuoteWorkflowResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(true);
  const {
    errorMessage: invoiceError,
    invoices,
    isLoading: isLoadingInvoices,
  } = useWorkOrderInvoices(workOrderId);

  useEffect(() => {
    let cancelled = false;

    async function loadCommunications() {
      setIsLoadingCommunications(true);
      setCommunicationsError(null);

      try {
        const response = await fetch(`/api/work-orders/${workOrderId}/communications`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | WorkOrderCommunicationsResponse
          | ApiErrorResponse;

        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Unable to load communication history."));
        }

        if (!cancelled) {
          setCommunications(
            (payload as WorkOrderCommunicationsResponse).data?.communications ?? [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setCommunicationsError(
            error instanceof Error
              ? error.message
              : "Unable to load communication history.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCommunications(false);
        }
      }
    }

    async function loadQuoteWorkflow() {
      setIsLoadingQuotes(true);
      setQuoteError(null);

      try {
        const response = await fetch(`/api/work-orders/${workOrderId}/quote-workflow`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as QuoteWorkflowResponse & ApiErrorResponse;

        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Unable to load financial history."));
        }

        if (!cancelled) {
          setQuoteData(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setQuoteError(
            error instanceof Error ? error.message : "Unable to load financial history.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQuotes(false);
        }
      }
    }

    void Promise.all([loadCommunications(), loadQuoteWorkflow()]);

    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  const auditModel = useMemo(
    () =>
      deriveWorkOrderAuditModel({
        assignments,
        attachments,
        clientQuotes: quoteData?.clientQuotes ?? [],
        communications,
        contractorQuotes: quoteData?.contractorQuotes ?? [],
        currentStatus,
        invoices,
        notes,
        timeline,
        updatedAt,
      }),
    [
      assignments,
      attachments,
      communications,
      currentStatus,
      invoices,
      notes,
      quoteData,
      timeline,
      updatedAt,
    ],
  );

  return (
    <section
      aria-labelledby="work-order-tab-history-audit"
      className="space-y-4"
      id="work-order-panel-history-audit"
      role="tabpanel"
    >
      <WorkOrderAuditSummaryPanel summary={auditModel.summary} />

      {quoteError || invoiceError || communicationsError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {[quoteError, invoiceError, communicationsError].filter(Boolean).join(" ")}
        </div>
      ) : null}

      <WorkOrderAuditTimeline items={auditModel.unifiedTimeline} />

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkOrderStatusHistorySection items={auditModel.statusHistory} />
        <WorkOrderAssignmentHistorySection assignments={auditModel.assignmentHistory} />
      </div>

      {isLoadingQuotes || isLoadingInvoices ? (
        <div className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
      ) : (
        <WorkOrderFinancialHistorySection items={auditModel.financialHistory} />
      )}

      {isLoadingCommunications ? (
        <div className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
      ) : (
        <WorkOrderCommunicationHistorySection items={auditModel.communicationHistory} />
      )}

      <WorkOrderSystemEventsSection items={auditModel.systemEvents} />
    </section>
  );
}

function getApiErrorMessage(
  payload: QuoteWorkflowResponse | WorkOrderCommunicationsResponse | ApiErrorResponse,
  fallback: string,
) {
  if ("error" in payload && payload.error?.message) {
    return payload.error.message;
  }

  return fallback;
}
