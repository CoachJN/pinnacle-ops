import type { UserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import type { Quote, QuoteFormInput, QuoteStatus } from "../../types/quote.ts";
import type { WorkOrderRepositoryActor } from "../work-orders/repository.ts";
import {
  addWorkOrderActivity,
  getWorkOrderById,
  setCurrentQuoteForWorkOrder,
  transitionWorkOrderStatus,
} from "../work-orders/repository.ts";
import { recordWorkflowEvent } from "../workflow/internal-events.ts";
import { SYSTEM_WORKFLOW_ACTOR } from "../workflow/system-actor.ts";
import { calculateQuoteTotal } from "./money.ts";

export interface QuoteRepositoryActor {
  name: string;
  role: UserRole;
}

const initialQuotes: Quote[] = [
  {
    id: "quote-1009-v1",
    workOrderId: "wo-1009",
    assignedContractorId: null,
    versionNumber: 1,
    status: "submitted",
    contractorName: "Northline Power",
    submittedByName: "Casey Coordinator",
    submittedByRole: USER_ROLES.Coordinator,
    laborAmount: 1800,
    materialAmount: 3200,
    otherAmount: 250,
    totalAmount: 5250,
    scopeSummary: "Replace failed transfer switch components and test generator handoff.",
    contractorNotes: "Parts available within two business days.",
    internalReviewNotes: null,
    clientResponseNotes: null,
    submittedAt: "2026-04-10T11:20:00.000Z",
    reviewedAt: null,
    clientDecisionAt: null,
    createdAt: "2026-04-10T10:45:00.000Z",
    updatedAt: "2026-04-10T11:20:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "quote-1010-v1",
    workOrderId: "wo-1010",
    assignedContractorId: null,
    versionNumber: 1,
    status: "ready_for_client",
    contractorName: "Clearline Glass",
    submittedByName: "Casey Coordinator",
    submittedByRole: USER_ROLES.Coordinator,
    laborAmount: 950,
    materialAmount: 2100,
    otherAmount: 175,
    totalAmount: 3225,
    scopeSummary: "Replace cracked suite glass panel and seal perimeter.",
    contractorNotes: "Requires after-hours building access.",
    internalReviewNotes: "Scope and pricing reviewed by manager.",
    clientResponseNotes: null,
    submittedAt: "2026-04-09T15:00:00.000Z",
    reviewedAt: "2026-04-10T14:30:00.000Z",
    clientDecisionAt: null,
    createdAt: "2026-04-09T14:45:00.000Z",
    updatedAt: "2026-04-10T14:30:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "quote-1011-v1",
    workOrderId: "wo-1011",
    versionNumber: 1,
    status: "client_approved",
    assignedContractorId: "contractor-signalworks",
    contractorName: "SignalWorks",
    submittedByName: "Casey Coordinator",
    submittedByRole: USER_ROLES.Coordinator,
    laborAmount: 1200,
    materialAmount: 870,
    otherAmount: 90,
    totalAmount: 2160,
    scopeSummary: "Run boardroom AV cabling and terminate wall plates.",
    contractorNotes: "Includes patch testing.",
    internalReviewNotes: "Approved for client decision.",
    clientResponseNotes: "Client approved by email.",
    submittedAt: "2026-04-08T13:15:00.000Z",
    reviewedAt: "2026-04-09T10:00:00.000Z",
    clientDecisionAt: "2026-04-10T15:00:00.000Z",
    createdAt: "2026-04-08T12:30:00.000Z",
    updatedAt: "2026-04-10T15:00:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Morgan Manager",
  },
  {
    id: "quote-1012-v1",
    workOrderId: "wo-1012",
    assignedContractorId: null,
    versionNumber: 1,
    status: "superseded",
    contractorName: "Stonecraft Restoration",
    submittedByName: "Casey Coordinator",
    submittedByRole: USER_ROLES.Coordinator,
    laborAmount: 2400,
    materialAmount: 1600,
    otherAmount: 350,
    totalAmount: 4350,
    scopeSummary: "Full lobby stone panel replacement and polish.",
    contractorNotes: "Original full replacement scope.",
    internalReviewNotes: "Sent to client; client requested smaller scope.",
    clientResponseNotes: "Rejected full replacement. Requested spot repair option.",
    submittedAt: "2026-04-05T10:00:00.000Z",
    reviewedAt: "2026-04-06T11:30:00.000Z",
    clientDecisionAt: "2026-04-07T15:00:00.000Z",
    createdAt: "2026-04-05T09:30:00.000Z",
    updatedAt: "2026-04-10T16:15:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
  {
    id: "quote-1012-v2",
    workOrderId: "wo-1012",
    assignedContractorId: null,
    versionNumber: 2,
    status: "draft",
    contractorName: "Stonecraft Restoration",
    submittedByName: "Casey Coordinator",
    submittedByRole: USER_ROLES.Coordinator,
    laborAmount: 1250,
    materialAmount: 700,
    otherAmount: 150,
    totalAmount: 2100,
    scopeSummary: "Spot repair damaged lobby stone and polish visible area.",
    contractorNotes: "Revised smaller scope for client review.",
    internalReviewNotes: null,
    clientResponseNotes: null,
    submittedAt: null,
    reviewedAt: null,
    clientDecisionAt: null,
    createdAt: "2026-04-10T16:15:00.000Z",
    updatedAt: "2026-04-10T16:15:00.000Z",
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
  },
];

const store = globalThis as typeof globalThis & {
  __pinnaclePhaseFourQuotes?: Quote[];
  __pinnaclePhaseFourQuoteSequence?: number;
};

const quotes = store.__pinnaclePhaseFourQuotes ?? initialQuotes;
store.__pinnaclePhaseFourQuotes = quotes;
store.__pinnaclePhaseFourQuoteSequence =
  store.__pinnaclePhaseFourQuoteSequence ?? 2000;

export async function listQuotesForWorkOrder(
  workOrderId: string,
): Promise<Quote[]> {
  return quotes
    .filter((quote) => quote.workOrderId === workOrderId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export async function getQuoteById(
  workOrderId: string,
  quoteId: string,
): Promise<Quote | null> {
  if (!workOrderId.trim() || !quoteId.trim()) {
    return null;
  }

  return (
    quotes.find(
      (quote) => quote.workOrderId === workOrderId && quote.id === quoteId,
    ) ?? null
  );
}

export async function getCurrentQuoteForWorkOrder(
  workOrderId: string,
): Promise<Quote | null> {
  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder?.currentQuoteId) {
    return null;
  }

  return getQuoteById(workOrderId, workOrder.currentQuoteId);
}

export async function createQuote(
  workOrderId: string,
  input: QuoteFormInput,
  actor: QuoteRepositoryActor,
): Promise<Quote | null> {
  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder) {
    return null;
  }

  const now = new Date().toISOString();
  const nextVersion = getNextVersionNumber(workOrderId);
  const sequence = store.__pinnaclePhaseFourQuoteSequence ?? 2000;
  store.__pinnaclePhaseFourQuoteSequence = sequence + 1;

  const quote: Quote = {
    id: `quote-${sequence}`,
    workOrderId,
    versionNumber: nextVersion,
    status: "draft",
    assignedContractorId: input.assignedContractorId ?? null,
    contractorName: input.contractorName,
    submittedByName: actor.name,
    submittedByRole: actor.role,
    laborAmount: input.laborAmount,
    materialAmount: input.materialAmount,
    otherAmount: input.otherAmount,
    totalAmount: calculateQuoteTotal(
      input.laborAmount,
      input.materialAmount,
      input.otherAmount,
    ),
    scopeSummary: input.scopeSummary,
    contractorNotes: input.contractorNotes,
    internalReviewNotes: null,
    clientResponseNotes: null,
    submittedAt: null,
    reviewedAt: null,
    clientDecisionAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.name,
    lastUpdatedBy: actor.name,
  };

  const currentQuote = workOrder.currentQuoteId
    ? await getQuoteById(workOrderId, workOrder.currentQuoteId)
    : null;
  if (currentQuote && currentQuote.id !== quote.id) {
    currentQuote.status = "superseded";
    currentQuote.updatedAt = now;
    currentQuote.lastUpdatedBy = SYSTEM_WORKFLOW_ACTOR.name;
  }

  quotes.unshift(quote);
  await setCurrentQuoteForWorkOrder(workOrderId, quote.id, actor);
  await addWorkOrderActivity(workOrderId, {
    type: nextVersion > 1 ? "quote_revised" : "edited",
    message:
      nextVersion > 1
        ? `Created revised quote version ${nextVersion}.`
        : `Created quote draft version ${nextVersion}.`,
    actor,
  });
  if (currentQuote && nextVersion > 1) {
    await addWorkOrderActivity(workOrderId, {
      type: "quote_revised",
      message: `System marked quote version ${currentQuote.versionNumber} superseded after quote version ${nextVersion} became current.`,
      actor: SYSTEM_WORKFLOW_ACTOR,
    });
  }

  return quote;
}

export async function updateQuoteDraft(
  workOrderId: string,
  quoteId: string,
  input: QuoteFormInput,
  actor: QuoteRepositoryActor,
): Promise<Quote | null> {
  const quote = await getQuoteById(workOrderId, quoteId);
  if (!quote) {
    return null;
  }

  Object.assign(quote, {
    contractorName: input.contractorName,
    assignedContractorId: input.assignedContractorId ?? quote.assignedContractorId,
    laborAmount: input.laborAmount,
    materialAmount: input.materialAmount,
    otherAmount: input.otherAmount,
    totalAmount: calculateQuoteTotal(
      input.laborAmount,
      input.materialAmount,
      input.otherAmount,
    ),
    scopeSummary: input.scopeSummary,
    contractorNotes: input.contractorNotes,
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: actor.name,
  });

  await addWorkOrderActivity(workOrderId, {
    type: "edited",
    message: `Edited quote version ${quote.versionNumber}.`,
    actor,
  });

  return quote;
}

export async function submitQuote(
  workOrderId: string,
  quoteId: string,
  actor: QuoteRepositoryActor,
): Promise<Quote | null> {
  const quote = await getQuoteById(workOrderId, quoteId);
  if (!quote) {
    return null;
  }

  const now = new Date().toISOString();
  quote.status = "submitted";
  quote.submittedAt = now;
  quote.updatedAt = now;
  quote.lastUpdatedBy = actor.name;

  await addWorkOrderActivity(workOrderId, {
    type: "quote_submitted",
    message: `Submitted contractor quote version ${quote.versionNumber}.`,
    actor,
  });
  await transitionWorkOrderStatus(workOrderId, "quote_received", SYSTEM_WORKFLOW_ACTOR, {
    activityMessage: `System moved work order to Quote Received after quote v${quote.versionNumber} was submitted.`,
  });
  recordWorkflowEvent({
    workOrderId,
    type: "quote_submitted",
    message: `Quote v${quote.versionNumber} was submitted.`,
  });

  return quote;
}

export async function markQuoteUnderReview(
  workOrderId: string,
  quoteId: string,
  internalReviewNotes: string | null,
  actor: QuoteRepositoryActor,
): Promise<Quote | null> {
  const quote = await getQuoteById(workOrderId, quoteId);
  if (!quote) {
    return null;
  }

  const now = new Date().toISOString();
  quote.status = "under_review";
  quote.internalReviewNotes = internalReviewNotes ?? quote.internalReviewNotes;
  quote.reviewedAt = now;
  quote.updatedAt = now;
  quote.lastUpdatedBy = actor.name;

  return quote;
}

export async function sendQuoteToClientApproval(
  workOrderId: string,
  quoteId: string,
  internalReviewNotes: string | null,
  actor: QuoteRepositoryActor,
): Promise<Quote | null> {
  const quote = await getQuoteById(workOrderId, quoteId);
  if (!quote) {
    return null;
  }

  const now = new Date().toISOString();
  quote.status = "ready_for_client";
  quote.internalReviewNotes = internalReviewNotes ?? quote.internalReviewNotes;
  quote.reviewedAt = now;
  quote.updatedAt = now;
  quote.lastUpdatedBy = actor.name;

  await addWorkOrderActivity(workOrderId, {
    type: "quote_sent_for_client_approval",
    message: `Sent quote version ${quote.versionNumber} for client approval.`,
    actor,
  });
  await transitionWorkOrderStatus(
    workOrderId,
    "pending_client_approval",
    SYSTEM_WORKFLOW_ACTOR,
    {
      activityMessage: `System moved work order to Pending Client Approval after quote v${quote.versionNumber} was sent for client approval.`,
    },
  );
  recordWorkflowEvent({
    workOrderId,
    type: "quote_pending_client_approval",
    message: `Quote v${quote.versionNumber} is pending client approval.`,
  });

  return quote;
}

export async function recordClientQuoteDecision(
  workOrderId: string,
  quoteId: string,
  decision: "approved" | "rejected",
  clientResponseNotes: string | null,
  actor: QuoteRepositoryActor,
): Promise<Quote | null> {
  const quote = await getQuoteById(workOrderId, quoteId);
  if (!quote) {
    return null;
  }

  const approved = decision === "approved";
  const now = new Date().toISOString();
  quote.status = approved ? "client_approved" : "client_rejected";
  quote.clientResponseNotes = clientResponseNotes;
  quote.clientDecisionAt = now;
  quote.updatedAt = now;
  quote.lastUpdatedBy = actor.name;

  await addWorkOrderActivity(workOrderId, {
    type: approved ? "quote_client_approved" : "quote_client_rejected",
    message: approved
      ? `Client approved quote version ${quote.versionNumber}.`
      : `Client rejected quote version ${quote.versionNumber}; revised quote is needed.`,
    actor,
  });
  await transitionWorkOrderStatus(
    workOrderId,
    approved ? "approved_to_proceed" : "quote_requested",
    SYSTEM_WORKFLOW_ACTOR,
    {
      activityMessage: approved
        ? `System moved work order to Approved to Proceed after quote v${quote.versionNumber} was approved.`
        : `System returned work order to Quote Requested after quote v${quote.versionNumber} was rejected.`,
    },
  );
  recordWorkflowEvent({
    workOrderId,
    type: approved ? "client_approved" : "client_rejected",
    message: approved
      ? `Client approved quote v${quote.versionNumber}.`
      : `Client rejected quote v${quote.versionNumber}.`,
  });

  return quote;
}

function getNextVersionNumber(workOrderId: string): number {
  const latestVersion = quotes
    .filter((quote) => quote.workOrderId === workOrderId)
    .reduce((latest, quote) => Math.max(latest, quote.versionNumber), 0);

  return latestVersion + 1;
}

export function getQuoteStatusForWorkOrder(
  quote: Quote | null,
): QuoteStatus | null {
  return quote?.status ?? null;
}

export function toWorkOrderActor(actor: QuoteRepositoryActor): WorkOrderRepositoryActor {
  return actor;
}
