import {
  assertAuditRecorded,
  assertEventRecorded,
  assertOrchestrationCreated,
  assertPriorityTier,
  assertReactionTriggered,
  assertSlaTimerCreated,
  assertTransitionSucceeded,
} from "../assertions.ts";
import { seedStandardInvoice, seedStandardWorkOrder } from "../fixtures.ts";
import {
  INVOICE_STATUS,
  PLATFORM_ROLES,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  invoiceTransitionStep,
  makeScenario,
  optimizationStep,
  quoteDeferredStep,
  simulateQuoteStateStep,
  workOrderTransitionStep,
} from "./helpers.ts";

export const workOrderStandardScenario = makeScenario({
  scenarioKey: "work-order-standard",
  scenarioName: "Standard Work Order With Quote",
  seed(env) {
    seedStandardWorkOrder(env);
    seedStandardInvoice(env);
  },
  steps: [
    quoteDeferredStep(),
    workOrderTransitionStep({
      stepKey: "wo-new-triage",
      description: "Coordinator moves new work order into triage.",
      to: WORK_ORDER_STATUS.Triage,
      role: PLATFORM_ROLES.Coordinator,
      assertions: [assertTransitionSucceeded(), assertAuditRecorded(), assertEventRecorded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-triage-quote-required",
      description: "Coordinator marks quote required.",
      to: WORK_ORDER_STATUS.QuotingRequired,
      role: PLATFORM_ROLES.Coordinator,
      assertions: [
        assertTransitionSucceeded(),
        assertOrchestrationCreated("REQUEST_QUOTE_FOLLOW_UP"),
        assertSlaTimerCreated("work-order.awaiting-quote"),
      ],
    }),
    simulateQuoteStateStep({ stepKey: "quote-submitted-simulated", status: QUOTE_STATUS.Submitted }),
    workOrderTransitionStep({
      stepKey: "wo-awaiting-quote-quote-received",
      description: "Contractor quote submission advances the work order to quote received.",
      to: WORK_ORDER_STATUS.QuoteReceived,
      role: PLATFORM_ROLES.ContractorUser,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-quote-review",
      description: "Manager starts quote review.",
      to: WORK_ORDER_STATUS.QuoteReview,
      role: PLATFORM_ROLES.Manager,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-awaiting-client-approval",
      description: "Manager sends quote for client approval.",
      to: WORK_ORDER_STATUS.AwaitingClientApproval,
      role: PLATFORM_ROLES.Manager,
      assertions: [
        assertTransitionSucceeded(),
        assertReactionTriggered("CLIENT_QUOTE_DECISION_REQUEST"),
        assertSlaTimerCreated("work-order.awaiting-client-approval"),
      ],
    }),
    simulateQuoteStateStep({ stepKey: "client-approval-simulated", status: QUOTE_STATUS.ClientApproved }),
    workOrderTransitionStep({
      stepKey: "wo-approved-to-proceed",
      description: "Client approval advances the work order to approved.",
      to: WORK_ORDER_STATUS.ApprovedToProceed,
      role: PLATFORM_ROLES.ClientUser,
      assertions: [
        assertTransitionSucceeded(),
        assertReactionTriggered("COORDINATOR_WORK_READY_ALERT"),
        assertSlaTimerCreated("work-order.scheduling"),
      ],
    }),
    workOrderTransitionStep({
      stepKey: "wo-scheduling",
      description: "Coordinator assigns the approved work.",
      to: WORK_ORDER_STATUS.Assigned,
      role: PLATFORM_ROLES.Coordinator,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-scheduled",
      description: "Coordinator marks work scheduled.",
      to: WORK_ORDER_STATUS.Scheduled,
      role: PLATFORM_ROLES.Coordinator,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-in-progress",
      description: "Contractor starts work.",
      to: WORK_ORDER_STATUS.InProgress,
      role: PLATFORM_ROLES.ContractorUser,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-work-completed",
      description: "Contractor marks work complete.",
      to: WORK_ORDER_STATUS.WorkCompleted,
      role: PLATFORM_ROLES.ContractorUser,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-qa-review",
      description: "Manager sends work to QA review.",
      to: WORK_ORDER_STATUS.QaReview,
      role: PLATFORM_ROLES.Manager,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-ready-for-invoicing",
      description: "Manager marks work ready for invoicing.",
      to: WORK_ORDER_STATUS.ReadyForInvoicing,
      role: PLATFORM_ROLES.Manager,
      assertions: [
        assertTransitionSucceeded(),
        assertReactionTriggered("FINANCE_WORK_READY_FOR_INVOICING_ALERT"),
        assertOrchestrationCreated("FLAG_ENTITY"),
        assertSlaTimerCreated("work-order.invoicing"),
      ],
    }),
    invoiceTransitionStep({
      stepKey: "invoice-ready",
      description: "Finance marks invoice ready.",
      to: INVOICE_STATUS.Ready,
    }),
    invoiceTransitionStep({
      stepKey: "invoice-draft",
      description: "Finance drafts invoice.",
      to: INVOICE_STATUS.Draft,
    }),
    invoiceTransitionStep({
      stepKey: "invoice-sent",
      description: "Finance sends invoice.",
      to: INVOICE_STATUS.Sent,
      assertions: [
        assertTransitionSucceeded(),
        assertReactionTriggered("INVOICE_SENT_ALERT"),
        assertOrchestrationCreated("SCHEDULE_RECHECK"),
        assertSlaTimerCreated("invoice.payment-follow-up"),
      ],
    }),
    workOrderTransitionStep({
      stepKey: "wo-invoiced",
      description: "Finance marks the work order invoiced after invoice send.",
      to: WORK_ORDER_STATUS.Invoiced,
      role: PLATFORM_ROLES.FinanceAdmin,
      assertions: [assertTransitionSucceeded()],
    }),
    invoiceTransitionStep({
      stepKey: "invoice-paid",
      description: "Finance marks invoice paid.",
      to: INVOICE_STATUS.Paid,
    }),
    workOrderTransitionStep({
      stepKey: "wo-paid",
      description: "Finance marks the work order paid after invoice payment.",
      to: WORK_ORDER_STATUS.Paid,
      role: PLATFORM_ROLES.FinanceAdmin,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-completed",
      description: "Finance closes the paid work order.",
      to: WORK_ORDER_STATUS.Completed,
      role: PLATFORM_ROLES.FinanceAdmin,
      assertions: [assertTransitionSucceeded()],
    }),
    optimizationStep({
      assertions: [assertPriorityTier("wo-standard", "CRITICAL")],
    }),
  ],
});
