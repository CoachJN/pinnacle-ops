import type { QuoteStatus } from "@/types/quote";

export const QUOTE_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "ready_for_client",
  "client_approved",
  "client_rejected",
  "superseded",
] as const satisfies readonly QuoteStatus[];

export const QUOTE_STATUS_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  ready_for_client: "Ready for Client",
  client_approved: "Client Approved",
  client_rejected: "Client Rejected",
  superseded: "Superseded",
} as const satisfies Record<QuoteStatus, string>;

export const TERMINAL_QUOTE_STATUSES = [
  "client_approved",
  "superseded",
] as const satisfies readonly QuoteStatus[];

export const QUOTE_TRANSITIONS = {
  draft: ["submitted"],
  submitted: ["under_review"],
  under_review: ["ready_for_client", "superseded"],
  ready_for_client: ["client_approved", "client_rejected"],
  client_rejected: ["superseded"],
  client_approved: [],
  superseded: [],
} as const satisfies Record<QuoteStatus, readonly QuoteStatus[]>;

export function canTransitionQuoteStatus(
  from: QuoteStatus,
  to: QuoteStatus,
): boolean {
  return (QUOTE_TRANSITIONS[from] as readonly QuoteStatus[]).includes(to);
}

export function isTerminalQuoteStatus(status: QuoteStatus): boolean {
  return (TERMINAL_QUOTE_STATUSES as readonly QuoteStatus[]).includes(status);
}
