import {
  buildInvoiceCreationEligibility,
  INVOICE_CREATION_ELIGIBLE_WORK_ORDER_STATUSES,
} from "@/modules/finance";
import {
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderStatus,
} from "@/modules/work-orders";
import type { ClientInvoice, InvoiceStatus } from "@/types/invoice";
import type {
  ClientQuoteStatus,
  ContractorQuoteStatus,
} from "@/types/quote";
import type { WorkOrderTimelineEntry } from "./work-order-display-model";

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ContractorQuoteRecord {
  id: string;
  status: ContractorQuoteStatus | string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientQuoteRecord {
  id: string;
  status: ClientQuoteStatus | string;
  sourceContractorQuoteId: string | null;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteWorkflowResponse {
  contractorQuotes: ContractorQuoteRecord[];
  clientQuotes: ClientQuoteRecord[];
  activeClientQuote: ClientQuoteRecord | null;
  visibility: {
    showContractorQuotes: boolean;
    showClientQuotes: boolean;
  };
  capabilities: {
    canSubmitContractorQuote: boolean;
    canReviewContractorQuote: boolean;
    canCreateClientQuote: boolean;
    canSendClientQuote: boolean;
    canApproveClientQuote: boolean;
    canRejectClientQuote: boolean;
  };
}

export interface FinancialStatusBadgeModel {
  detail: string;
  label: string;
  tone: "danger" | "neutral" | "success" | "warning";
}

export interface WorkOrderFinancialSummary {
  blockingApproval: boolean;
  clientQuote: FinancialStatusBadgeModel;
  contractorQuote: FinancialStatusBadgeModel;
  currentQuoteWorkflowState: string;
  hasActiveInvoice: boolean;
  headerSignal: string | null;
  invoiceReadiness: FinancialStatusBadgeModel & {
    eligible: boolean;
    eligibleStatuses: WorkOrderStatus[];
  };
  invoiceStatus: FinancialStatusBadgeModel & {
    qboDetail: string | null;
  };
  latestRejectionReason: string | null;
  nextAction: FinancialStatusBadgeModel;
  quoteRequirement: FinancialStatusBadgeModel & {
    required: boolean;
  };
}

export interface WorkOrderFinancialHistoryItem {
  detail: string;
  id: string;
  occurredAt: string;
  source: "client_quote" | "contractor_quote" | "invoice" | "timeline";
  title: string;
}

export function deriveWorkOrderFinancialSummary(input: {
  activeClientQuote: ClientQuoteRecord | null;
  clientQuotes: ClientQuoteRecord[];
  contractorQuotes: ContractorQuoteRecord[];
  invoices: ClientInvoice[];
  requiresQuote: boolean;
  workOrderStatus: WorkOrderStatus;
}): WorkOrderFinancialSummary {
  const contractorQuotes = sortByMostRecent(input.contractorQuotes);
  const clientQuotes = sortByMostRecent(input.clientQuotes);
  const invoices = sortByMostRecent(input.invoices);
  const latestContractorQuote = contractorQuotes[0] ?? null;
  const activeClientQuote =
    input.activeClientQuote ?? clientQuotes.find((quote) => !isClientQuoteTerminal(quote.status)) ?? null;
  const latestClientQuote = activeClientQuote ?? clientQuotes[0] ?? null;
  const currentInvoice = invoices.find((invoice) => invoice.status !== "void") ?? null;
  const invoiceCreation = buildInvoiceCreationEligibility({
    workOrderStatus: input.workOrderStatus,
    hasActiveInvoice: currentInvoice !== null,
  });
  const hasAcceptedContractorQuote = contractorQuotes.some(
    (quote) => quote.status === "accepted",
  );
  const latestRejectionReason =
    latestClientQuote?.rejectionReason ??
    latestContractorQuote?.rejectionReason ??
    null;
  const blockingApproval =
    latestClientQuote?.status === "sent" ||
    input.workOrderStatus === "client_approval_requested";

  const quoteRequirement = input.requiresQuote
    ? {
        detail: "This work order requires quote workflow before execution can advance.",
        label: "Quote required",
        required: true,
        tone: "warning" as const,
      }
    : {
        detail: "This work order can continue without quote workflow.",
        label: "Quote not required",
        required: false,
        tone: "success" as const,
      };

  const contractorQuote = deriveContractorQuoteStatus({
    latestContractorQuote,
    requiresQuote: input.requiresQuote,
  });
  const clientQuote = deriveClientQuoteStatus({
    hasAcceptedContractorQuote,
    latestClientQuote,
    requiresQuote: input.requiresQuote,
  });
  const invoiceReadiness = invoiceCreation.eligible
    ? {
        detail: "Operational status allows invoice creation for this work order.",
        eligible: true,
        eligibleStatuses: [...INVOICE_CREATION_ELIGIBLE_WORK_ORDER_STATUSES],
        label: "Ready for invoicing",
        tone: "success" as const,
      }
    : {
        detail: invoiceCreation.reason ?? "Invoice creation is not available yet.",
        eligible: false,
        eligibleStatuses: [...INVOICE_CREATION_ELIGIBLE_WORK_ORDER_STATUSES],
        label: "Not ready for invoicing",
        tone: "neutral" as const,
      };
  const invoiceStatus = deriveInvoiceStatus(currentInvoice);

  return {
    blockingApproval,
    clientQuote,
    contractorQuote,
    currentQuoteWorkflowState: deriveQuoteWorkflowState({
      hasAcceptedContractorQuote,
      latestClientQuote,
      latestContractorQuote,
      requiresQuote: input.requiresQuote,
      workOrderStatus: input.workOrderStatus,
    }),
    hasActiveInvoice: currentInvoice !== null,
    headerSignal: deriveHeaderSignal({
      blockingApproval,
      currentInvoice,
      invoiceCreationEligible: invoiceCreation.eligible,
      latestContractorQuote,
      requiresQuote: input.requiresQuote,
    }),
    invoiceReadiness,
    invoiceStatus,
    latestRejectionReason,
    nextAction: deriveNextAction({
      blockingApproval,
      currentInvoice,
      hasAcceptedContractorQuote,
      invoiceCreationEligible: invoiceCreation.eligible,
      latestClientQuote,
      latestContractorQuote,
      requiresQuote: input.requiresQuote,
      workOrderStatus: input.workOrderStatus,
    }),
    quoteRequirement,
  };
}

export function buildFinancialHistorySnapshot(input: {
  clientQuotes: ClientQuoteRecord[];
  contractorQuotes: ContractorQuoteRecord[];
  invoices: ClientInvoice[];
  limit?: number;
  timeline: WorkOrderTimelineEntry[];
}): WorkOrderFinancialHistoryItem[] {
  const items = [
    ...input.contractorQuotes.map<WorkOrderFinancialHistoryItem>((quote) => ({
      detail: `Contractor quote ${humanizeStatus(quote.status)}${quote.rejectionReason ? ` • ${quote.rejectionReason}` : ""}`,
      id: `contractor-quote-${quote.id}`,
      occurredAt: quote.reviewedAt ?? quote.submittedAt ?? quote.updatedAt ?? quote.createdAt,
      source: "contractor_quote",
      title: "Contractor quote",
    })),
    ...input.clientQuotes.map<WorkOrderFinancialHistoryItem>((quote) => ({
      detail: `Client quote ${humanizeStatus(quote.status)}${quote.rejectionReason ? ` • ${quote.rejectionReason}` : ""}`,
      id: `client-quote-${quote.id}`,
      occurredAt:
        quote.respondedAt ??
        quote.approvedAt ??
        quote.rejectedAt ??
        quote.sentAt ??
        quote.updatedAt ??
        quote.createdAt,
      source: "client_quote",
      title: "Client quote",
    })),
    ...input.invoices.map<WorkOrderFinancialHistoryItem>((invoice) => ({
      detail: `${invoice.invoiceNumber} ${humanizeStatus(invoice.status)}${invoice.qboSyncStatus ? ` • QBO ${invoice.qboSyncStatus}` : ""}`,
      id: `invoice-${invoice.id}`,
      occurredAt:
        invoice.paidAt ??
        invoice.voidedAt ??
        invoice.overdueAt ??
        invoice.viewedAt ??
        invoice.sentAt ??
        invoice.updatedAt ??
        invoice.createdAt,
      source: "invoice",
      title: "Invoice",
    })),
    ...input.timeline
      .filter((entry) => isFinancialTimelineEntry(entry))
      .map<WorkOrderFinancialHistoryItem>((entry) => ({
        detail: entry.summary,
        id: `timeline-${entry.id}`,
        occurredAt: entry.occurredAt,
        source: "timeline",
        title: entry.entity.label ?? "Timeline activity",
      })),
  ];

  return items
    .sort(compareRecentFirst)
    .slice(0, input.limit ?? 5);
}

function deriveContractorQuoteStatus(input: {
  latestContractorQuote: ContractorQuoteRecord | null;
  requiresQuote: boolean;
}): FinancialStatusBadgeModel {
  if (!input.requiresQuote) {
    return {
      detail: "No contractor quote is required for this work order.",
      label: "Not required",
      tone: "success",
    };
  }

  if (!input.latestContractorQuote) {
    return {
      detail: "No contractor quote has been received yet.",
      label: "Needed",
      tone: "warning",
    };
  }

  switch (input.latestContractorQuote.status) {
    case "accepted":
      return {
        detail: "A contractor quote is available for client quote creation.",
        label: "Accepted",
        tone: "success",
      };
    case "submitted":
    case "under_review":
      return {
        detail: "A contractor quote has been received and is awaiting review.",
        label: "Received",
        tone: "neutral",
      };
    case "rejected":
      return {
        detail: "The latest contractor quote was rejected and needs replacement.",
        label: "Rejected",
        tone: "danger",
      };
    case "draft":
      return {
        detail: "A draft contractor quote exists but has not been submitted.",
        label: "Draft only",
        tone: "neutral",
      };
    default:
      return {
        detail: `Latest contractor quote is ${humanizeStatus(input.latestContractorQuote.status)}.`,
        label: humanizeStatus(input.latestContractorQuote.status),
        tone: "neutral",
      };
  }
}

function deriveClientQuoteStatus(input: {
  hasAcceptedContractorQuote: boolean;
  latestClientQuote: ClientQuoteRecord | null;
  requiresQuote: boolean;
}): FinancialStatusBadgeModel {
  if (!input.requiresQuote) {
    return {
      detail: "No client-facing quote is required for this work order.",
      label: "Not required",
      tone: "success",
    };
  }

  if (!input.latestClientQuote) {
    return input.hasAcceptedContractorQuote
      ? {
          detail: "A contractor quote is available, so a client-facing quote can be created.",
          label: "Ready to create",
          tone: "warning",
        }
      : {
          detail: "No client-facing quote has been created yet.",
          label: "Not created",
          tone: "neutral",
        };
  }

  switch (input.latestClientQuote.status) {
    case "approved":
      return {
        detail: "Client quote approval is complete.",
        label: "Approved",
        tone: "success",
      };
    case "sent":
      return {
        detail: "The client-facing quote has been sent and is awaiting a response.",
        label: "Awaiting approval",
        tone: "warning",
      };
    case "rejected":
      return {
        detail: "The latest client-facing quote was rejected.",
        label: "Rejected",
        tone: "danger",
      };
    case "draft":
      return {
        detail: "A client-facing quote exists but has not been sent yet.",
        label: "Draft",
        tone: "neutral",
      };
    default:
      return {
        detail: `Latest client-facing quote is ${humanizeStatus(input.latestClientQuote.status)}.`,
        label: humanizeStatus(input.latestClientQuote.status),
        tone: "neutral",
      };
  }
}

function deriveInvoiceStatus(
  invoice: ClientInvoice | null,
): WorkOrderFinancialSummary["invoiceStatus"] {
  if (!invoice) {
    return {
      detail: "No invoice has been created yet.",
      label: "Not created",
      qboDetail: null,
      tone: "neutral",
    };
  }

  return {
    detail: `Invoice ${invoice.invoiceNumber} is currently ${humanizeStatus(invoice.status)}.`,
    label: humanizeStatus(invoice.status),
    qboDetail: buildQboDetail(invoice),
    tone: invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : "neutral",
  };
}

function deriveQuoteWorkflowState(input: {
  hasAcceptedContractorQuote: boolean;
  latestClientQuote: ClientQuoteRecord | null;
  latestContractorQuote: ContractorQuoteRecord | null;
  requiresQuote: boolean;
  workOrderStatus: WorkOrderStatus;
}): string {
  if (!input.requiresQuote) {
    return "Quote not required";
  }

  if (input.latestClientQuote?.status === "sent") {
    return "Client approval requested";
  }

  if (input.latestClientQuote?.status === "approved") {
    return "Client quote approved";
  }

  if (input.latestClientQuote?.status === "rejected") {
    return "Client quote rejected";
  }

  if (input.hasAcceptedContractorQuote && !input.latestClientQuote) {
    return "Ready to create client quote";
  }

  if (input.latestContractorQuote?.status === "submitted") {
    return "Contractor quote received";
  }

  if (input.latestContractorQuote?.status === "under_review") {
    return "Contractor quote under review";
  }

  if (input.latestContractorQuote?.status === "accepted") {
    return "Contractor quote accepted";
  }

  if (input.latestContractorQuote?.status === "rejected") {
    return "Contractor quote rejected";
  }

  return WORK_ORDER_STATUS_LABELS[input.workOrderStatus] ?? "Quote workflow active";
}

function deriveNextAction(input: {
  blockingApproval: boolean;
  currentInvoice: ClientInvoice | null;
  hasAcceptedContractorQuote: boolean;
  invoiceCreationEligible: boolean;
  latestClientQuote: ClientQuoteRecord | null;
  latestContractorQuote: ContractorQuoteRecord | null;
  requiresQuote: boolean;
  workOrderStatus: WorkOrderStatus;
}): FinancialStatusBadgeModel {
  if (input.currentInvoice) {
    return {
      detail: "An invoice already exists for this work order.",
      label: "Invoice already created",
      tone: input.currentInvoice.status === "paid" ? "success" : "neutral",
    };
  }

  if (input.workOrderStatus === "closed" || input.workOrderStatus === "cancelled") {
    return {
      detail: "This work order is no longer active, so no further financial action is required.",
      label: "No financial action required yet",
      tone: "neutral",
    };
  }

  if (input.requiresQuote && !input.latestContractorQuote) {
    return {
      detail: "Quote workflow is blocked until a contractor quote is submitted.",
      label: "Contractor quote needed",
      tone: "warning",
    };
  }

  if (input.requiresQuote && input.latestContractorQuote?.status === "rejected") {
    return {
      detail: "The latest contractor quote was rejected, so another quote is needed.",
      label: "Quote required before work can proceed",
      tone: "danger",
    };
  }

  if (input.requiresQuote && !input.hasAcceptedContractorQuote) {
    return {
      detail: "An accepted contractor quote is still needed before client quote workflow can continue.",
      label: "Quote required before work can proceed",
      tone: "warning",
    };
  }

  if (input.latestClientQuote?.status === "rejected") {
    return {
      detail: "Use the rejection reason to revise and resend the client-facing quote.",
      label: "Client quote needs revision",
      tone: "danger",
    };
  }

  if (input.requiresQuote && !input.latestClientQuote) {
    return {
      detail: "A contractor quote is ready, so the client-facing quote can be created now.",
      label: "Client quote ready to create",
      tone: "warning",
    };
  }

  if (input.blockingApproval) {
    return {
      detail: "Work is waiting on a client quote approval decision.",
      label: "Awaiting client quote approval",
      tone: "warning",
    };
  }

  if (input.invoiceCreationEligible) {
    return {
      detail: "Operational workflow is complete enough to create the client invoice.",
      label: "Ready for invoice creation",
      tone: "success",
    };
  }

  return {
    detail: "There is no immediate financial action to take from this workspace.",
    label: "No financial action required yet",
    tone: "neutral",
  };
}

function deriveHeaderSignal(input: {
  blockingApproval: boolean;
  currentInvoice: ClientInvoice | null;
  invoiceCreationEligible: boolean;
  latestContractorQuote: ContractorQuoteRecord | null;
  requiresQuote: boolean;
}): string | null {
  if (input.currentInvoice) {
    return "Invoice created";
  }

  if (input.blockingApproval) {
    return "Awaiting quote approval";
  }

  if (input.requiresQuote && !input.latestContractorQuote) {
    return "Quote required";
  }

  if (input.invoiceCreationEligible) {
    return "Ready for invoice";
  }

  return null;
}

function buildQboDetail(invoice: ClientInvoice): string | null {
  if (invoice.qboSyncStatus === "synced" && invoice.qboInvoiceId) {
    return "Synced to QuickBooks";
  }

  if (invoice.qboSyncStatus === "failed") {
    return "QuickBooks sync needs attention";
  }

  if (invoice.qboSyncStatus === "pending") {
    return "QuickBooks sync pending";
  }

  return invoice.qboInvoiceId ? "QuickBooks invoice linked" : null;
}

function isFinancialTimelineEntry(entry: WorkOrderTimelineEntry): boolean {
  const summary = `${entry.type} ${entry.summary}`.toLowerCase();
  return summary.includes("quote") || summary.includes("invoice") || summary.includes("finance");
}

function isClientQuoteTerminal(status: string): boolean {
  return status === "approved" || status === "rejected" || status === "expired" || status === "cancelled";
}

function humanizeStatus(status: string): string {
  switch (status as InvoiceStatus) {
    case "viewed":
      return "Viewed";
    default:
      return status
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

function sortByMostRecent<T extends { createdAt: string; updatedAt?: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(compareRecentFirst);
}

function compareRecentFirst(
  left: { createdAt?: string; occurredAt?: string; updatedAt?: string },
  right: { createdAt?: string; occurredAt?: string; updatedAt?: string },
): number {
  return (
    new Date(
      right.occurredAt ?? right.updatedAt ?? right.createdAt ?? 0,
    ).getTime() -
    new Date(
      left.occurredAt ?? left.updatedAt ?? left.createdAt ?? 0,
    ).getTime()
  );
}
