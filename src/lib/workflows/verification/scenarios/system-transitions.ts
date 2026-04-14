import {
  assertAuditRecorded,
  assertEventRecorded,
  assertTransitionFailed,
  assertTransitionSucceeded,
} from "../assertions.ts";
import { seedStandardInvoice, seedStandardWorkOrder } from "../fixtures.ts";
import {
  INVOICE_STATUS,
  PLATFORM_ROLES,
  WORK_ORDER_STATUS,
  invoiceTransitionStep,
  makeScenario,
} from "./helpers.ts";

export const systemTransitionsScenario = makeScenario({
  scenarioKey: "system-transitions",
  scenarioName: "System-Only Transitions",
  seed(env) {
    seedStandardWorkOrder(env, {
      id: "wo-standard",
      status: WORK_ORDER_STATUS.ReadyForInvoicing,
    });
    seedStandardInvoice(env, {
      id: "invoice-standard",
      status: INVOICE_STATUS.Sent,
    });
    seedStandardInvoice(env, {
      id: "invoice-owner-blocked",
      status: INVOICE_STATUS.Sent,
    });
  },
  steps: [
    invoiceTransitionStep({
      stepKey: "system-marks-viewed",
      description: "SYSTEM marks sent invoice viewed.",
      to: INVOICE_STATUS.Viewed,
      actorType: "SYSTEM",
      role: null,
      assertions: [
        assertTransitionSucceeded(),
        assertAuditRecorded({ outcome: "SUCCEEDED" }),
        assertEventRecorded({ eventType: "INVOICE_STATUS_CHANGED" }),
      ],
    }),
    invoiceTransitionStep({
      stepKey: "owner-system-only-blocked",
      description: "OWNER user cannot perform system-only transition.",
      invoiceId: "invoice-owner-blocked",
      to: INVOICE_STATUS.Viewed,
      actorType: "USER",
      role: PLATFORM_ROLES.Owner,
      expectedOutcome: "failure",
      assertions: [assertTransitionFailed("AUTHORIZATION_FAILED")],
    }),
  ],
});
