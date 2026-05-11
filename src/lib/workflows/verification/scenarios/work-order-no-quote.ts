import {
  assertNoEventRecorded,
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
      description: "Coordinator assigns work directly when quoteRequired=false.",
      to: WORK_ORDER_STATUS.Assigned,
      role: PLATFORM_ROLES.Coordinator,
      assertions: [assertTransitionSucceeded()],
    }),
    workOrderTransitionStep({
      stepKey: "wo-invalid-quote-dependency-check",
      description: "Direct assignment cannot be repeated from an already assigned state.",
      to: WORK_ORDER_STATUS.Assigned,
      role: PLATFORM_ROLES.Coordinator,
      expectedOutcome: "failure",
      assertions: [assertTransitionFailed("AUTHORIZATION_FAILED"), assertNoEventRecorded()],
    }),
  ],
});
