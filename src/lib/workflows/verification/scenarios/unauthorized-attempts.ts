import {
  assertAuditRecorded,
  assertNoEventRecorded,
  assertTransitionFailed,
} from "../assertions.ts";
import { seedStandardInvoice, seedStandardWorkOrder } from "../fixtures.ts";
import {
  INVOICE_STATUS,
  PLATFORM_ROLES,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  invoiceTransitionStep,
  makeScenario,
  workOrderTransitionStep,
} from "./helpers.ts";

export const unauthorizedAttemptsScenario = makeScenario({
  scenarioKey: "unauthorized-attempts",
  scenarioName: "Unauthorized Attempts",
  seed(env) {
    seedStandardWorkOrder(env, {
      id: "wo-standard",
      status: WORK_ORDER_STATUS.AwaitingClientApproval,
      quoteRequired: true,
      quoteStatus: QUOTE_STATUS.ClientApproved,
    });
    seedStandardInvoice(env, {
      id: "invoice-standard",
      status: INVOICE_STATUS.Sent,
    });
    env.seedWorkOrder({
      id: "wo-finance-only",
      status: WORK_ORDER_STATUS.ReadyForInvoicing,
      quoteRequired: false,
    });
  },
  steps: [
    workOrderTransitionStep({
      stepKey: "contractor-approves-quote-blocked",
      description: "Contractor cannot approve quote-gated work order.",
      to: WORK_ORDER_STATUS.ApprovedToProceed,
      role: PLATFORM_ROLES.ContractorUser,
      expectedOutcome: "failure",
      assertions: [
        assertTransitionFailed("AUTHORIZATION_FAILED"),
        assertAuditRecorded({ outcome: "REJECTED" }),
        assertNoEventRecorded(),
      ],
    }),
    workOrderTransitionStep({
      stepKey: "client-transitions-work-order-blocked",
      description: "Client user cannot transition work order.",
      workOrderId: "wo-finance-only",
      to: WORK_ORDER_STATUS.Completed,
      role: PLATFORM_ROLES.ClientUser,
      expectedOutcome: "failure",
      assertions: [assertTransitionFailed("AUTHORIZATION_FAILED"), assertNoEventRecorded()],
    }),
    workOrderTransitionStep({
      stepKey: "coordinator-finance-completion-blocked",
      description: "Coordinator cannot perform finance-only completion.",
      workOrderId: "wo-finance-only",
      to: WORK_ORDER_STATUS.Completed,
      role: PLATFORM_ROLES.Coordinator,
      expectedOutcome: "failure",
      assertions: [assertTransitionFailed("AUTHORIZATION_FAILED"), assertNoEventRecorded()],
    }),
    invoiceTransitionStep({
      stepKey: "user-system-only-viewed-blocked",
      description: "User actor cannot impersonate invoice viewed transition.",
      to: INVOICE_STATUS.Viewed,
      role: PLATFORM_ROLES.Owner,
      actorType: "USER",
      expectedOutcome: "failure",
      assertions: [assertTransitionFailed("AUTHORIZATION_FAILED"), assertNoEventRecorded()],
    }),
  ],
});
