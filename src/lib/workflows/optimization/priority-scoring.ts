import { INVOICE_STATUS, WORK_ORDER_STATUS } from "../lifecycle/index.ts";
import type {
  OptimizationEntity,
  OptimizationPriorityTier,
  OptimizationSignal,
  OptimizationSignalSeverity,
  WorkflowOptimizationContext,
  WorkflowPriorityScore,
} from "./types.ts";

const NEARING_DUE_HOURS = 24;

export function computeWorkflowPriorityScore(
  entityContext: WorkflowOptimizationContext,
): WorkflowPriorityScore {
  const now = new Date(entityContext.now ?? new Date().toISOString());
  const factors = [
    ...buildSlaPrioritySignals(entityContext, now),
    ...buildStatusPrioritySignals(entityContext, now),
    ...buildExecutionPrioritySignals(entityContext),
    ...buildOrchestrationPrioritySignals(entityContext),
    ...buildQuotePostureSignals(entityContext),
  ];
  const score = factors.reduce((total, factor) => total + factor.weight, 0);
  const tier = priorityTierForScore(score);

  return {
    score,
    tier,
    contributingFactors: factors,
    reasons:
      factors.length > 0
        ? factors.map((factor) => factor.message)
        : ["No active optimization signals were detected."],
  };
}

export function priorityTierForScore(score: number): OptimizationPriorityTier {
  if (score >= 100) {
    return "CRITICAL";
  }

  if (score >= 60) {
    return "HIGH";
  }

  if (score >= 25) {
    return "MEDIUM";
  }

  return "LOW";
}

export function buildSlaPrioritySignals(
  context: WorkflowOptimizationContext,
  now: Date,
): readonly OptimizationSignal[] {
  return (context.slaTimers ?? [])
    .filter((timer) => timer.entityId === context.entityId)
    .flatMap((timer) => {
      if (timer.status === "BREACHED") {
        return [
          signal({
            code: "sla.breached",
            label: "SLA breached",
            weight: severityWeight(timer.breachSeverity),
            severity: timer.breachSeverity,
            message: `${timer.slaKey} SLA is breached.`,
            source: "sla",
            details: { timerId: timer.timerId, dueAt: timer.dueAt },
          }),
        ];
      }

      if (timer.status !== "ACTIVE") {
        return [];
      }

      const dueInHours = (new Date(timer.dueAt).getTime() - now.getTime()) / 36e5;
      if (dueInHours <= 0) {
        return [
          signal({
            code: "sla.due-now",
            label: "SLA due",
            weight: 55,
            severity: "HIGH",
            message: `${timer.slaKey} SLA is due or past due.`,
            source: "sla",
            details: { timerId: timer.timerId, dueAt: timer.dueAt },
          }),
        ];
      }

      if (dueInHours <= NEARING_DUE_HOURS) {
        return [
          signal({
            code: "sla.nearing-due",
            label: "SLA nearing due",
            weight: 35,
            severity: "MEDIUM",
            message: `${timer.slaKey} SLA is due within ${NEARING_DUE_HOURS} hours.`,
            source: "sla",
            details: { timerId: timer.timerId, dueAt: timer.dueAt },
          }),
        ];
      }

      return [];
    });
}

function buildStatusPrioritySignals(
  context: WorkflowOptimizationContext,
  now: Date,
): readonly OptimizationSignal[] {
  const status = context.status ?? context.entity?.status ?? null;
  const signals: OptimizationSignal[] = [];

  if (context.lifecycle === "work-order") {
    const weights: Partial<Record<string, [number, OptimizationSignalSeverity, string]>> = {
      [WORK_ORDER_STATUS.Triage]: [10, "LOW", "Work order is waiting for triage."],
      [WORK_ORDER_STATUS.AwaitingQuote]: [20, "MEDIUM", "Work order is waiting for quote follow-up."],
      [WORK_ORDER_STATUS.AwaitingClientApproval]: [25, "MEDIUM", "Work order is waiting for client approval."],
      [WORK_ORDER_STATUS.ApprovedToProceed]: [30, "MEDIUM", "Work order is approved and needs scheduling."],
      [WORK_ORDER_STATUS.ReadyForInvoicing]: [35, "HIGH", "Work order is ready for invoicing."],
      [WORK_ORDER_STATUS.Escalated]: [45, "HIGH", "Work order is escalated."],
      [WORK_ORDER_STATUS.OnHold]: [10, "LOW", "Work order is on hold."],
    };
    const match = status ? weights[status] : undefined;
    if (match) {
      signals.push(
        signal({
          code: `status.${String(status).toLowerCase()}`,
          label: "Lifecycle status",
          weight: match[0],
          severity: match[1],
          message: match[2],
          source: "status",
        }),
      );
    }
  }

  if (context.lifecycle === "invoice") {
    const dueAt = getInvoiceDueAt(context.entity);
    const isOverdue =
      status === INVOICE_STATUS.Overdue ||
      status === "overdue" ||
      Boolean(dueAt && new Date(dueAt).getTime() < now.getTime() && !isInvoiceTerminal(status));

    if (isOverdue) {
      signals.push(
        signal({
          code: "invoice.overdue",
          label: "Invoice overdue",
          weight: 80,
          severity: "HIGH",
          message: "Invoice is overdue and needs finance review.",
          source: "invoice",
          details: dueAt ? { dueAt } : undefined,
        }),
      );
    } else if (status === INVOICE_STATUS.Sent || status === INVOICE_STATUS.Viewed) {
      signals.push(
        signal({
          code: "invoice.awaiting-payment",
          label: "Awaiting payment",
          weight: 20,
          severity: "MEDIUM",
          message: "Invoice has been sent and is awaiting payment.",
          source: "invoice",
        }),
      );
    } else if (status === INVOICE_STATUS.Ready || status === INVOICE_STATUS.Draft) {
      signals.push(
        signal({
          code: "invoice.preparation",
          label: "Invoice preparation",
          weight: 25,
          severity: "MEDIUM",
          message: "Invoice needs preparation or sending.",
          source: "invoice",
        }),
      );
    }
  }

  const ageSignal = buildAgeSignal(context, now);
  if (ageSignal) {
    signals.push(ageSignal);
  }

  return signals;
}

function buildExecutionPrioritySignals(
  context: WorkflowOptimizationContext,
): readonly OptimizationSignal[] {
  return (context.executionRecords ?? [])
    .filter((record) => record.entityId === context.entityId)
    .flatMap((record) => {
      if (record.status === "FAILED") {
        return [
          signal({
            code: "execution.failed",
            label: "Execution failed",
            weight: 35,
            severity: "HIGH",
            message: "Scheduled workflow execution failed.",
            source: "execution",
            details: { actionId: record.actionId, attemptCount: record.attemptCount },
          }),
        ];
      }

      if (record.status === "RETRY_SCHEDULED") {
        return [
          signal({
            code: "execution.retry-scheduled",
            label: "Retry scheduled",
            weight: 20 + Math.min(record.attemptCount * 5, 20),
            severity: "MEDIUM",
            message: "Scheduled workflow execution is waiting for retry.",
            source: "execution",
            details: { actionId: record.actionId, attemptCount: record.attemptCount },
          }),
        ];
      }

      return [];
    });
}

function buildOrchestrationPrioritySignals(
  context: WorkflowOptimizationContext,
): readonly OptimizationSignal[] {
  return (context.orchestrationRecords ?? [])
    .filter(
      (record) =>
        record.entityId === context.entityId &&
        (record.status === "PENDING" || record.status === "SCHEDULED"),
    )
    .map((record) =>
      signal({
        code: `orchestration.${record.actionType.toLowerCase()}`,
        label: "Orchestration intent",
        weight:
          record.severity === "critical"
            ? 50
            : record.severity === "high"
              ? 35
              : record.severity === "normal"
                ? 20
                : 10,
        severity: mapOrchestrationSeverity(record.severity),
        message: record.message,
        source: "orchestration",
        details: { actionId: record.actionId, ruleKey: record.ruleKey },
      }),
    );
}

function buildQuotePostureSignals(
  context: WorkflowOptimizationContext,
): readonly OptimizationSignal[] {
  if (context.lifecycle !== "quote") {
    return [];
  }

  return [
    signal({
      code: "quote.runtime-deferred",
      label: "Quote runtime deferred",
      weight: 0,
      severity: "LOW",
      message: "Quote runtime is deferred; optimization uses limited quote signals only.",
      source: "quote",
      details: { runtimePosture: context.quoteRuntimePosture ?? "deferred" },
    }),
  ];
}

export function buildAgeSignal(
  context: WorkflowOptimizationContext,
  now: Date,
): OptimizationSignal | null {
  const ageSource = context.statusEnteredAt ?? context.entity?.updatedAt ?? context.entity?.createdAt;
  if (!ageSource) {
    return null;
  }

  const ageDays = (now.getTime() - new Date(ageSource).getTime()) / 864e5;
  if (ageDays >= 7) {
    return signal({
      code: "age.long-time-in-status",
      label: "Long time in status",
      weight: 25,
      severity: "HIGH",
      message: "Item has remained in the current status for at least 7 days.",
      source: "age",
      details: { ageDays: Math.floor(ageDays), since: ageSource },
    });
  }

  if (ageDays >= 2) {
    return signal({
      code: "age.stale",
      label: "Stale work",
      weight: 10,
      severity: "MEDIUM",
      message: "Item has not changed status for at least 2 days.",
      source: "age",
      details: { ageDays: Math.floor(ageDays), since: ageSource },
    });
  }

  return null;
}

export function signal(input: OptimizationSignal): OptimizationSignal {
  return input;
}

function severityWeight(severity: OptimizationSignalSeverity): number {
  return {
    LOW: 45,
    MEDIUM: 70,
    HIGH: 90,
    CRITICAL: 110,
  }[severity];
}

function mapOrchestrationSeverity(
  severity: "low" | "normal" | "high" | "critical" | undefined,
): OptimizationSignalSeverity {
  return severity === "critical"
    ? "CRITICAL"
    : severity === "high"
      ? "HIGH"
      : severity === "normal"
        ? "MEDIUM"
        : "LOW";
}

function isInvoiceTerminal(status: string | null | undefined): boolean {
  return (
    status === INVOICE_STATUS.Paid ||
    status === INVOICE_STATUS.Voided ||
    status === "paid" ||
    status === "void" ||
    status === "cancelled"
  );
}

function getInvoiceDueAt(entity: OptimizationEntity | null | undefined): string | undefined {
  if (!entity || !("dueAt" in entity)) {
    return undefined;
  }

  return entity.dueAt;
}
