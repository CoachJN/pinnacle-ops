import {
  assertNoEventRecorded,
  assertReactionTriggered,
  assertTransitionFailed,
  assertTransitionSucceeded,
} from "../assertions.ts";
import { seedStandardWorkOrder } from "../fixtures.ts";
import {
  PLATFORM_ROLES,
  WORK_ORDER_STATUS,
  makeScenario,
  workOrderTransitionStep,
} from "./helpers.ts";

export const workOrderNoQuoteScenario = makeScenario({
  scenarioKey: "work-order-no-quote",
  scenarioName: "Work Order Without Quote",
  seed(env) {
    seedStandardWorkOrder(env, {
      id: "wo-standard",
      quoteRequired: false,
      quoteStatus: null,
    });
  },
  steps: [
    workOrderTransitionStep({
      stepKey: "wo-new-triage",
      description: "Coordinator moves no-quote work order into triage.",
      to: WORK_ORDER_STATUS.Triage,
      role: PLATFORM_ROLES.Coordinator,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-direct-approved",
      description: "Manager approves directly when quoteRequired=false.",
      to: WORK_ORDER_STATUS.ApprovedToProceed,
      role: PLATFORM_ROLES.Manager,
      assertions: [
        assertTransitionSucceeded(),
        assertReactionTriggered("COORDINATOR_WORK_READY_ALERT"),
      ],
    }),
    workOrderTransitionStep({
      stepKey: "wo-invalid-quote-dependency-check",
      description: "Direct approval cannot be repeated from an already approved state.",
      to: WORK_ORDER_STATUS.ApprovedToProceed,
      role: PLATFORM_ROLES.Manager,
      expectedOutcome: "failure",
      assertions: [assertTransitionFailed("AUTHORIZATION_FAILED"), assertNoEventRecorded()],
    }),
  ],
});
