import {
  assertNoEventRecorded,
  assertNoReactionTriggered,
  assertTransitionFailed,
  assertTransitionSucceeded,
} from "../assertions.ts";
import { seedStandardWorkOrder } from "../fixtures.ts";
import {
  PLATFORM_ROLES,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  makeScenario,
  simulateQuoteStateStep,
  workOrderTransitionStep,
} from "./helpers.ts";

export const quoteRejectionScenario = makeScenario({
  scenarioKey: "quote-rejection",
  scenarioName: "Quote Rejection Stopped Flow",
  seed(env) {
    seedStandardWorkOrder(env, {
      quoteRequired: true,
      quoteStatus: QUOTE_STATUS.Submitted,
    });
  },
  steps: [
    workOrderTransitionStep({
      stepKey: "wo-new-triage",
      description: "Coordinator triages quoted work.",
      to: WORK_ORDER_STATUS.Triage,
      role: PLATFORM_ROLES.Coordinator,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-quote-required",
      description: "Coordinator marks quote required.",
      to: WORK_ORDER_STATUS.QuotingRequired,
      role: PLATFORM_ROLES.Coordinator,
    }),
    workOrderTransitionStep({
      stepKey: "wo-quote-received",
      description: "Contractor quote submission advances the work order to quote received.",
      to: WORK_ORDER_STATUS.QuoteReceived,
      role: PLATFORM_ROLES.ContractorUser,
    }),
    workOrderTransitionStep({
      stepKey: "wo-quote-review",
      description: "Manager reviews quote.",
      to: WORK_ORDER_STATUS.QuoteReview,
      role: PLATFORM_ROLES.Manager,
    }),
    workOrderTransitionStep({
      stepKey: "wo-awaiting-client-approval",
      description: "Manager sends quote for client decision.",
      to: WORK_ORDER_STATUS.AwaitingClientApproval,
      role: PLATFORM_ROLES.Manager,
    }),
    simulateQuoteStateStep({
      stepKey: "client-rejection-simulated",
      status: QUOTE_STATUS.ClientRejected,
    }),
    workOrderTransitionStep({
      stepKey: "wo-rejected-quote-proceed-blocked",
      description: "Rejected quote blocks approval to proceed.",
      to: WORK_ORDER_STATUS.ApprovedToProceed,
      role: PLATFORM_ROLES.Manager,
      expectedOutcome: "failure",
      assertions: [
        assertTransitionFailed("AUTHORIZATION_FAILED"),
        assertNoEventRecorded(),
        assertNoReactionTriggered(),
      ],
    }),
  ],
});
