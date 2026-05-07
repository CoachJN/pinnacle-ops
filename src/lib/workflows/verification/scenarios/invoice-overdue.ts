import {
  assertOrchestrationCreated,
  assertPriorityTier,
  assertReactionTriggered,
  assertSlaBreached,
  assertSlaTimerCreated,
  assertTransitionSucceeded,
} from "../assertions.ts";
import { seedStandardInvoice, seedStandardWorkOrder } from "../fixtures.ts";
import {
  INVOICE_STATUS,
  PLATFORM_ROLES,
  WORK_ORDER_STATUS,
  evaluateSlaBreachesStep,
  invoiceTransitionStep,
  makeScenario,
  optimizationStep,
} from "./helpers.ts";

export const invoiceOverdueScenario = makeScenario({
  scenarioKey: "invoice-overdue",
  scenarioName: "Invoice Overdue Flow",
  seed(env) {
    seedStandardWorkOrder(env, {
      id: "wo-standard",
      status: WORK_ORDER_STATUS.ReadyForInvoicing,
    });
    seedStandardInvoice(env, {
      id: "invoice-standard",
      status: INVOICE_STATUS.Draft,
      dueDate: "2026-01-01T00:30:00.000Z",
    });
  },
  steps: [
    invoiceTransitionStep({
      stepKey: "invoice-sent",
      description: "Finance sends invoice and creates follow-up timer.",
      to: INVOICE_STATUS.Sent,
      role: PLATFORM_ROLES.FinanceAdmin,
      assertions: [
        assertTransitionSucceeded(),
        assertReactionTriggered("INVOICE_SENT_ALERT"),
        assertOrchestrationCreated("SCHEDULE_RECHECK"),
        assertSlaTimerCreated("invoice.payment-follow-up"),
      ],
    }),
    evaluateSlaBreachesStep({
      stepKey: "payment-follow-up-breached",
      advanceDays: 200,
      assertions: [assertSlaBreached("invoice.payment-follow-up")],
    }),
    invoiceTransitionStep({
      stepKey: "invoice-overdue",
      description: "System marks invoice overdue.",
      to: INVOICE_STATUS.Overdue,
      actorType: "SYSTEM",
      role: null,
      assertions: [
        assertTransitionSucceeded(),
        assertReactionTriggered("INVOICE_OVERDUE_ALERT"),
        assertOrchestrationCreated("REQUEST_COLLECTION_REVIEW"),
        assertSlaTimerCreated("invoice.overdue-collection"),
      ],
    }),
    optimizationStep({
      assertions: [assertPriorityTier("invoice-standard", "CRITICAL")],
    }),
  ],
});
