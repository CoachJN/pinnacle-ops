import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientInvoice } from "@/types/invoice";
import type { WorkOrderTimelineEntry } from "@/components/work-orders/work-order-display-model";
import {
  buildFinancialHistorySnapshot,
  deriveWorkOrderFinancialSummary,
  type ClientQuoteRecord,
  type ContractorQuoteRecord,
} from "@/components/work-orders/work-order-financial-model";

describe("deriveWorkOrderFinancialSummary", () => {
  it("handles quote not required", () => {
    const summary = deriveWorkOrderFinancialSummary(baseInput());

    assert.equal(summary.quoteRequirement.label, "Quote not required");
    assert.equal(summary.nextAction.label, "No financial action required yet");
  });

  it("handles quote required with no contractor quote", () => {
    const summary = deriveWorkOrderFinancialSummary(
      baseInput({ requiresQuote: true }),
    );

    assert.equal(summary.contractorQuote.label, "Needed");
    assert.equal(summary.nextAction.label, "Contractor quote needed");
  });

  it("handles contractor quote present but no client quote", () => {
    const summary = deriveWorkOrderFinancialSummary(
      baseInput({
        contractorQuotes: [contractorQuote({ status: "accepted" })],
        requiresQuote: true,
      }),
    );

    assert.equal(summary.clientQuote.label, "Ready to create");
    assert.equal(summary.nextAction.label, "Client quote ready to create");
  });

  it("handles client quote awaiting approval", () => {
    const summary = deriveWorkOrderFinancialSummary(
      baseInput({
        activeClientQuote: clientQuote({ status: "sent", sentAt: "2026-05-08T12:00:00.000Z" }),
        clientQuotes: [clientQuote({ status: "sent", sentAt: "2026-05-08T12:00:00.000Z" })],
        contractorQuotes: [contractorQuote({ status: "accepted" })],
        requiresQuote: true,
        workOrderStatus: "client_approval_requested",
      }),
    );

    assert.equal(summary.blockingApproval, true);
    assert.equal(summary.clientQuote.label, "Awaiting approval");
    assert.equal(summary.nextAction.label, "Awaiting client quote approval");
  });

  it("handles quote rejected with rejection reason", () => {
    const summary = deriveWorkOrderFinancialSummary(
      baseInput({
        activeClientQuote: clientQuote({
          rejectionReason: "Budget exceeded",
          rejectedAt: "2026-05-08T13:00:00.000Z",
          status: "rejected",
        }),
        clientQuotes: [
          clientQuote({
            rejectionReason: "Budget exceeded",
            rejectedAt: "2026-05-08T13:00:00.000Z",
            status: "rejected",
          }),
        ],
        contractorQuotes: [contractorQuote({ status: "accepted" })],
        requiresQuote: true,
      }),
    );

    assert.equal(summary.latestRejectionReason, "Budget exceeded");
    assert.equal(summary.nextAction.label, "Client quote needs revision");
  });

  it("handles ready for invoicing", () => {
    const summary = deriveWorkOrderFinancialSummary(
      baseInput({ workOrderStatus: "ready_for_invoicing" }),
    );

    assert.equal(summary.invoiceReadiness.eligible, true);
    assert.equal(summary.nextAction.label, "Ready for invoice creation");
  });

  it("handles invoice already created", () => {
    const summary = deriveWorkOrderFinancialSummary(
      baseInput({
        invoices: [invoice({ status: "draft" })],
        workOrderStatus: "ready_for_invoicing",
      }),
    );

    assert.equal(summary.hasActiveInvoice, true);
    assert.equal(summary.nextAction.label, "Invoice already created");
  });

  it("handles closed or cancelled work orders", () => {
    const summary = deriveWorkOrderFinancialSummary(
      baseInput({
        requiresQuote: true,
        workOrderStatus: "closed",
      }),
    );

    assert.equal(summary.nextAction.label, "No financial action required yet");
  });
});

describe("buildFinancialHistorySnapshot", () => {
  it("handles no financial history", () => {
    const items = buildFinancialHistorySnapshot({
      clientQuotes: [],
      contractorQuotes: [],
      invoices: [],
      timeline: [],
    });

    assert.equal(items.length, 0);
  });

  it("orders financial history newest first", () => {
    const items = buildFinancialHistorySnapshot({
      clientQuotes: [clientQuote({ updatedAt: "2026-05-08T10:00:00.000Z" })],
      contractorQuotes: [contractorQuote({ updatedAt: "2026-05-08T09:00:00.000Z" })],
      invoices: [invoice({ updatedAt: "2026-05-08T12:00:00.000Z" })],
      timeline: [
        timelineEntry({
          occurredAt: "2026-05-08T11:00:00.000Z",
          summary: "Invoice reviewed",
          type: "invoice_reviewed",
        }),
      ],
    });

    assert.equal(items[0]?.source, "invoice");
    assert.equal(items[1]?.source, "timeline");
    assert.equal(items[2]?.source, "client_quote");
    assert.equal(items[3]?.source, "contractor_quote");
  });
});

function baseInput(overrides: Partial<Parameters<typeof deriveWorkOrderFinancialSummary>[0]> = {}) {
  return {
    activeClientQuote: null,
    clientQuotes: [],
    contractorQuotes: [],
    invoices: [],
    requiresQuote: false,
    workOrderStatus: "assigned" as const,
    ...overrides,
  };
}

function contractorQuote(
  overrides: Partial<ContractorQuoteRecord> = {},
): ContractorQuoteRecord {
  return {
    createdAt: "2026-05-08T08:00:00.000Z",
    id: "contractor-1",
    lineItems: [],
    notes: null,
    rejectionReason: null,
    reviewedAt: null,
    status: "submitted",
    submittedAt: "2026-05-08T08:30:00.000Z",
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    updatedAt: "2026-05-08T08:30:00.000Z",
    ...overrides,
  };
}

function clientQuote(overrides: Partial<ClientQuoteRecord> = {}): ClientQuoteRecord {
  return {
    approvedAt: null,
    createdAt: "2026-05-08T09:00:00.000Z",
    id: "client-1",
    lineItems: [],
    notes: null,
    rejectedAt: null,
    rejectionReason: null,
    respondedAt: null,
    sentAt: null,
    sourceContractorQuoteId: "contractor-1",
    status: "draft",
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    updatedAt: "2026-05-08T09:00:00.000Z",
    ...overrides,
  };
}

function invoice(overrides: Partial<ClientInvoice> = {}): ClientInvoice {
  return {
    clientOrganizationId: "client-org-1",
    createdAt: "2026-05-08T12:00:00.000Z",
    createdByUserId: "user-1",
    currency: "CAD",
    dueDate: "2026-05-15T00:00:00.000Z",
    id: "invoice-1",
    invoiceNumber: "INV-1001",
    isDeleted: false,
    issuedDate: null,
    lineItems: [],
    locationId: "location-1",
    notes: null,
    organizationId: "org-1",
    paidAt: null,
    paymentReference: null,
    qboInvoiceId: null,
    qboSyncStatus: null,
    recordStatus: "active",
    sentAt: null,
    status: "draft",
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    updatedAt: "2026-05-08T12:00:00.000Z",
    updatedByUserId: "user-1",
    viewedAt: null,
    voidedAt: null,
    workOrderId: "work-order-1",
    ...overrides,
  };
}

function timelineEntry(
  overrides: Partial<WorkOrderTimelineEntry> = {},
): WorkOrderTimelineEntry {
  return {
    actor: {
      actorType: "system",
      displayName: "System",
    },
    entity: {
      entityType: "work_order",
      label: "Finance",
    },
    id: "timeline-1",
    occurredAt: "2026-05-08T11:00:00.000Z",
    summary: "Quote updated",
    type: "quote_updated",
    ...overrides,
  };
}
