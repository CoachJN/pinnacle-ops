import { INVOICE_STATUS, WORK_ORDER_STATUS } from "../lifecycle/index.ts";
import { buildAgeSignal, buildSlaPrioritySignals, signal } from "./priority-scoring.ts";
import type {
  OptimizationEntity,
  OptimizationSignal,
  OptimizationSignalSeverity,
  WorkflowOptimizationContext,
  WorkflowRiskSignal,
} from "./types.ts";

export function detectWorkflowRiskSignals(
  entityContext: WorkflowOptimizationContext,
): readonly WorkflowRiskSignal[] {
  const now = new Date(entityContext.now ?? new Date().toISOString());
  const reference = {
    lifecycle: entityContext.lifecycle,
    entityType: entityContext.entityType,
    entityId: entityContext.entityId,
    status: entityContext.status ?? entityContext.entity?.status ?? null,
  };
  const risks: WorkflowRiskSignal[] = [];

  for (const slaSignal of buildSlaPrioritySignals(entityContext, now)) {
    if (slaSignal.code === "sla.breached" || slaSignal.code === "sla.due-now") {
      risks.push({
        type: "SLA_BREACHED",
        severity: slaSignal.severity,
        message: slaSignal.message,
        relatedEntity: reference,
        contributingSignals: [slaSignal],
        details: slaSignal.details,
      });
    } else if (slaSignal.code === "sla.nearing-due") {
      risks.push({
        type: "SLA_NEARING_DUE",
        severity: slaSignal.severity,
        message: slaSignal.message,
        relatedEntity: reference,
        contributingSignals: [slaSignal],
        details: slaSignal.details,
      });
    }
  }

  const retrySignal = buildRetryRiskSignal(entityContext);
  if (retrySignal) {
    risks.push({
      type: "MULTIPLE_RETRIES_FAILED",
      severity: retrySignal.severity,
      message: retrySignal.message,
      relatedEntity: reference,
      contributingSignals: [retrySignal],
      details: retrySignal.details,
    });
  }

  const ageSignal = buildAgeSignal(entityContext, now);
  if (ageSignal && ageSignal.severity !== "MEDIUM") {
    risks.push({
      type: "LONG_TIME_IN_STATUS",
      severity: ageSignal.severity,
      message: ageSignal.message,
      relatedEntity: reference,
      contributingSignals: [ageSignal],
      details: ageSignal.details,
    });
  }

  const invoiceRisk = buildInvoiceOverdueRisk(entityContext, now);
  if (invoiceRisk) {
    risks.push({
      type: "INVOICE_OVERDUE",
      severity: invoiceRisk.severity,
      message: invoiceRisk.message,
      relatedEntity: reference,
      contributingSignals: [invoiceRisk],
      details: invoiceRisk.details,
    });
  }

  const quoteRisk = buildQuoteRisk(entityContext, now);
  if (quoteRisk) {
    risks.push({
      type: quoteRisk.type,
      severity: quoteRisk.signal.severity,
      message: quoteRisk.signal.message,
      relatedEntity: reference,
      contributingSignals: [quoteRisk.signal],
      details: quoteRisk.signal.details,
    });
  }

  return risks;
}

function buildRetryRiskSignal(
  context: WorkflowOptimizationContext,
): OptimizationSignal | null {
  const failedOrRetried = (context.executionRecords ?? []).filter(
    (record) =>
      record.entityId === context.entityId &&
      (record.status === "FAILED" ||
        record.status === "RETRY_SCHEDULED" ||
        record.attemptCount >= 2 ||
        (record.maxAttempts != null && record.attemptCount >= record.maxAttempts)),
  );

  if (failedOrRetried.length === 0) {
    return null;
  }

  const highestAttemptCount = Math.max(
    ...failedOrRetried.map((record) => record.attemptCount),
  );

  return signal({
    code: "execution.multiple-retries-failed",
    label: "Execution retry risk",
    weight: 35,
    severity: highestAttemptCount >= 3 ? "HIGH" : "MEDIUM",
    message: "Workflow execution has repeated retries or failures.",
    source: "execution",
    details: {
      actionIds: failedOrRetried.map((record) => record.actionId),
      highestAttemptCount,
    },
  });
}

function buildInvoiceOverdueRisk(
  context: WorkflowOptimizationContext,
  now: Date,
): OptimizationSignal | null {
  if (context.lifecycle !== "invoice") {
    return null;
  }

  const status = context.status ?? context.entity?.status ?? null;
  const dueAt = getInvoiceDueAt(context.entity);
  const overdue =
    status === INVOICE_STATUS.Overdue ||
    status === "overdue" ||
    Boolean(dueAt && new Date(dueAt).getTime() < now.getTime() && status !== INVOICE_STATUS.Paid);

  if (!overdue) {
    return null;
  }

  return signal({
    code: "invoice.overdue-risk",
    label: "Overdue invoice",
    weight: 80,
    severity: "HIGH",
    message: "Invoice is overdue and should be reviewed before lower-risk work.",
    source: "invoice",
    details: dueAt ? { dueAt } : undefined,
  });
}

function buildQuoteRisk(
  context: WorkflowOptimizationContext,
  now: Date,
): { readonly type: "QUOTE_OR_APPROVAL_STALLED" | "QUOTE_RUNTIME_DEFERRED"; readonly signal: OptimizationSignal } | null {
  const status = context.status ?? context.entity?.status ?? null;
  const ageDays = context.statusEnteredAt
    ? (now.getTime() - new Date(context.statusEnteredAt).getTime()) / 864e5
    : null;

  if (
    context.lifecycle === "work-order" &&
    (status === WORK_ORDER_STATUS.AwaitingQuote ||
      status === WORK_ORDER_STATUS.AwaitingClientApproval) &&
    ageDays != null &&
    ageDays >= 3
  ) {
    return {
      type: "QUOTE_OR_APPROVAL_STALLED",
      signal: signal({
        code: "quote-or-approval.stalled",
        label: "Quote or approval stalled",
        weight: 30,
        severity: ageDays >= 7 ? "HIGH" : "MEDIUM",
        message: "Quote or client approval has been waiting for follow-up.",
        source: "quote",
        details: { ageDays: Math.floor(ageDays), status },
      }),
    };
  }

  if (context.lifecycle === "quote") {
    return {
      type: "QUOTE_RUNTIME_DEFERRED",
      signal: signal({
        code: "quote.runtime-deferred-risk",
        label: "Quote runtime deferred",
        weight: 0,
        severity: "LOW" satisfies OptimizationSignalSeverity,
        message: "Quote runtime is deferred; only limited quote risk can be reported.",
        source: "quote",
        details: { runtimePosture: context.quoteRuntimePosture ?? "deferred" },
      }),
    };
  }

  return null;
}

function getInvoiceDueAt(entity: OptimizationEntity | null | undefined): string | undefined {
  if (!entity || !("dueAt" in entity)) {
    return undefined;
  }

  return entity.dueAt;
}
