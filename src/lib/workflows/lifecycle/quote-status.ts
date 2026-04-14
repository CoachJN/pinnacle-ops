import { includesStatus, type LifecycleStatusMetadata } from "./types.ts";

export const QUOTE_STATUS = {
  Requested: "REQUESTED",
  Submitted: "SUBMITTED",
  UnderReview: "UNDER_REVIEW",
  Rejected: "REJECTED",
  ApprovedInternal: "APPROVED_INTERNAL",
  SentToClient: "SENT_TO_CLIENT",
  ClientApproved: "CLIENT_APPROVED",
  ClientRejected: "CLIENT_REJECTED",
  Expired: "EXPIRED",
  Cancelled: "CANCELLED",
} as const;

export type QuoteLifecycleStatus =
  (typeof QUOTE_STATUS)[keyof typeof QUOTE_STATUS];

export type QuoteLifecycleCategory =
  | "request"
  | "review"
  | "client-decision"
  | "terminal";

export const QUOTE_STATUSES = [
  QUOTE_STATUS.Requested,
  QUOTE_STATUS.Submitted,
  QUOTE_STATUS.UnderReview,
  QUOTE_STATUS.Rejected,
  QUOTE_STATUS.ApprovedInternal,
  QUOTE_STATUS.SentToClient,
  QUOTE_STATUS.ClientApproved,
  QUOTE_STATUS.ClientRejected,
  QUOTE_STATUS.Expired,
  QUOTE_STATUS.Cancelled,
] as const satisfies readonly QuoteLifecycleStatus[];

export const TERMINAL_QUOTE_STATUSES = [
  QUOTE_STATUS.ClientApproved,
  QUOTE_STATUS.ClientRejected,
  QUOTE_STATUS.Expired,
  QUOTE_STATUS.Cancelled,
] as const satisfies readonly QuoteLifecycleStatus[];

export const NON_TERMINAL_QUOTE_STATUSES = [
  QUOTE_STATUS.Requested,
  QUOTE_STATUS.Submitted,
  QUOTE_STATUS.UnderReview,
  QUOTE_STATUS.Rejected,
  QUOTE_STATUS.ApprovedInternal,
  QUOTE_STATUS.SentToClient,
] as const satisfies readonly QuoteLifecycleStatus[];

// APPROVED_INTERNAL and SENT_TO_CLIENT keep internal quote approval distinct
// from the client-facing decision while preserving one quote lifecycle.
export const QUOTE_STATUS_LABELS = {
  [QUOTE_STATUS.Requested]: "Requested",
  [QUOTE_STATUS.Submitted]: "Submitted",
  [QUOTE_STATUS.UnderReview]: "Under Review",
  [QUOTE_STATUS.Rejected]: "Rejected",
  [QUOTE_STATUS.ApprovedInternal]: "Approved Internal",
  [QUOTE_STATUS.SentToClient]: "Sent to Client",
  [QUOTE_STATUS.ClientApproved]: "Client Approved",
  [QUOTE_STATUS.ClientRejected]: "Client Rejected",
  [QUOTE_STATUS.Expired]: "Expired",
  [QUOTE_STATUS.Cancelled]: "Cancelled",
} as const satisfies Record<QuoteLifecycleStatus, string>;

export const QUOTE_STATUS_CATEGORIES = {
  [QUOTE_STATUS.Requested]: "request",
  [QUOTE_STATUS.Submitted]: "request",
  [QUOTE_STATUS.UnderReview]: "review",
  [QUOTE_STATUS.Rejected]: "review",
  [QUOTE_STATUS.ApprovedInternal]: "review",
  [QUOTE_STATUS.SentToClient]: "client-decision",
  [QUOTE_STATUS.ClientApproved]: "terminal",
  [QUOTE_STATUS.ClientRejected]: "terminal",
  [QUOTE_STATUS.Expired]: "terminal",
  [QUOTE_STATUS.Cancelled]: "terminal",
} as const satisfies Record<QuoteLifecycleStatus, QuoteLifecycleCategory>;

export const QUOTE_STATUS_METADATA = QUOTE_STATUSES.map((status) => ({
  status,
  label: QUOTE_STATUS_LABELS[status],
  category: QUOTE_STATUS_CATEGORIES[status],
  terminal: includesStatus<QuoteLifecycleStatus>(TERMINAL_QUOTE_STATUSES, status),
})) as readonly LifecycleStatusMetadata<
  QuoteLifecycleStatus,
  QuoteLifecycleCategory
>[];
