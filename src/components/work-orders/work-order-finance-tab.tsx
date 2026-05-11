"use client";

import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { validateQuoteWorkflowPayload } from "./quote-workflow-validation";
import {
  deriveWorkOrderFinancialSummary,
  type QuoteWorkflowResponse,
  type QuoteLineItem,
} from "./work-order-financial-model";
import { WorkOrderClientQuotesSection } from "./work-order-client-quotes-section";
import { WorkOrderContractorQuotesSection } from "./work-order-contractor-quotes-section";
import { WorkOrderFinancePanel } from "./work-order-finance-panel";
import { WorkOrderFinancialReadinessPanel } from "./work-order-financial-readiness-panel";
import { WorkOrderQuoteWorkflowSection } from "./work-order-quote-workflow-section";
import { useWorkOrderInvoices } from "./use-work-order-invoices";

interface WorkOrderFinanceTabProps {
  onFinanceUpdated: () => Promise<void>;
  quoteRequiredThresholdCents: number | null;
  requiresQuote: boolean;
  showFinancePanel: boolean;
  workOrderId: string;
  workOrderStatus: ComponentProps<typeof WorkOrderFinancePanel>["workOrderStatus"];
}

export function WorkOrderFinanceTab({
  onFinanceUpdated,
  quoteRequiredThresholdCents,
  requiresQuote,
  showFinancePanel,
  workOrderId,
  workOrderStatus,
}: WorkOrderFinanceTabProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(true);
  const [isSavingQuotes, setIsSavingQuotes] = useState(false);
  const [quoteData, setQuoteData] = useState<QuoteWorkflowResponse | null>(null);
  const {
    errorMessage: invoiceErrorMessage,
    invoices,
    isLoading: isLoadingInvoices,
    refreshInvoices,
  } = useWorkOrderInvoices(workOrderId);

  const loadQuoteWorkflow = useCallback(async () => {
    setIsLoadingQuotes(true);
    setErrorMessage(null);

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

      setQuoteData(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load quote workflow.",
      );
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    void loadQuoteWorkflow();
  }, [loadQuoteWorkflow]);

  const summary = useMemo(
    () =>
      deriveWorkOrderFinancialSummary({
        activeClientQuote: quoteData?.activeClientQuote ?? null,
        clientQuotes: quoteData?.clientQuotes ?? [],
        contractorQuotes: quoteData?.contractorQuotes ?? [],
        invoices,
        requiresQuote,
        workOrderStatus,
      }),
    [invoices, quoteData, requiresQuote, workOrderStatus],
  );

  async function submitQuoteAction(body: Record<string, unknown>) {
    if (body.lineItems) {
      const validation = validateQuoteWorkflowPayload(body.lineItems as QuoteLineItem[]);
      if (!validation.ok) {
        setErrorMessage(validation.message ?? "Quote details are invalid.");
        return;
      }
    }

    setIsSavingQuotes(true);
    setErrorMessage(null);

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

      await Promise.all([loadQuoteWorkflow(), onFinanceUpdated()]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Quote workflow action failed.",
      );
    } finally {
      setIsSavingQuotes(false);
    }
  }

  return (
    <section
      aria-labelledby="work-order-tab-quotes-finance"
      className="space-y-4"
      id="work-order-panel-quotes-finance"
      role="tabpanel"
    >
      <WorkOrderFinancialReadinessPanel summary={summary} />

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {isLoadingQuotes ? (
        <div className="h-40 animate-pulse rounded-[1.5rem] bg-neutral-100" />
      ) : (
        <>
          <WorkOrderQuoteWorkflowSection
            clientQuoteCount={quoteData?.clientQuotes.length ?? 0}
            contractorQuoteCount={quoteData?.contractorQuotes.length ?? 0}
            quoteRequiredThresholdCents={quoteRequiredThresholdCents}
            requiresQuote={requiresQuote}
            summary={summary}
            workOrderStatus={workOrderStatus}
          />

          <WorkOrderContractorQuotesSection
            activeClientQuoteId={quoteData?.activeClientQuote?.id ?? null}
            canCreateClientQuote={quoteData?.capabilities.canCreateClientQuote ?? false}
            canReviewContractorQuote={quoteData?.capabilities.canReviewContractorQuote ?? false}
            canSubmitContractorQuote={quoteData?.capabilities.canSubmitContractorQuote ?? false}
            contractorQuotes={quoteData?.contractorQuotes ?? []}
            isSaving={isSavingQuotes}
            onSubmitAction={submitQuoteAction}
          />

          <WorkOrderClientQuotesSection
            canApproveClientQuote={quoteData?.capabilities.canApproveClientQuote ?? false}
            canCreateClientQuote={quoteData?.capabilities.canCreateClientQuote ?? false}
            canRejectClientQuote={quoteData?.capabilities.canRejectClientQuote ?? false}
            canSendClientQuote={quoteData?.capabilities.canSendClientQuote ?? false}
            clientQuotes={quoteData?.clientQuotes ?? []}
            hasActiveClientQuote={quoteData?.activeClientQuote != null}
            isSaving={isSavingQuotes}
            onSubmitAction={submitQuoteAction}
          />
        </>
      )}

      {showFinancePanel ? (
        <div id="finance-workflow">
          <WorkOrderFinancePanel
            errorMessage={invoiceErrorMessage}
            invoices={invoices}
            isLoading={isLoadingInvoices}
            onFinanceUpdated={onFinanceUpdated}
            onRefreshInvoices={refreshInvoices}
            summary={summary}
            workOrderId={workOrderId}
            workOrderStatus={workOrderStatus}
          />
        </div>
      ) : null}
    </section>
  );
}
