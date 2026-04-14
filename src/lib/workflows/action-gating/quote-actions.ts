import { QUOTE_STATUS } from "../lifecycle/index.ts";
import type {
  QuoteActionAvailabilityInput,
  QuoteActionAvailabilityResult,
  QuoteActionCatalogEntry,
  QuoteActionDescriptor,
} from "./types.ts";

export const QUOTE_ACTION_CATALOG = [
  action("submit_quote", QUOTE_STATUS.Submitted, "Submit quote"),
  action("start_quote_review", QUOTE_STATUS.UnderReview, "Start quote review"),
  action("reject_quote", QUOTE_STATUS.Rejected, "Reject quote"),
  action(
    "approve_quote_internal",
    QUOTE_STATUS.ApprovedInternal,
    "Approve quote internally",
  ),
  action("send_quote_to_client", QUOTE_STATUS.SentToClient, "Send quote to client"),
  action(
    "approve_quote_as_client",
    QUOTE_STATUS.ClientApproved,
    "Approve quote as client",
  ),
  action(
    "reject_quote_as_client",
    QUOTE_STATUS.ClientRejected,
    "Reject quote as client",
  ),
  action("expire_quote", QUOTE_STATUS.Expired, "Expire quote"),
  action("cancel_quote", QUOTE_STATUS.Cancelled, "Cancel quote"),
] as const satisfies readonly QuoteActionCatalogEntry[];

export function getAvailableQuoteActions(
  input: QuoteActionAvailabilityInput,
): QuoteActionAvailabilityResult {
  const entityId = input.entityId ?? input.entity?.id;
  const fromStatus = input.entity?.status ?? null;
  const message =
    "Quote action availability is unsupported until quote runtime persistence is unified.";

  return {
    ok: false,
    supported: false,
    lifecycle: "quote",
    entityType: "quote",
    entityId,
    currentStatus: fromStatus,
    actions: QUOTE_ACTION_CATALOG.map((entry) =>
      unsupportedQuoteAction(entry, input, fromStatus, message),
    ),
    blockReasonCode: "UNSUPPORTED_RUNTIME_PATH",
    message,
  };
}

function unsupportedQuoteAction(
  entry: QuoteActionCatalogEntry,
  input: QuoteActionAvailabilityInput,
  fromStatus: string | null,
  message: string,
): QuoteActionDescriptor {
  return {
    actionCode: entry.actionCode,
    lifecycle: "quote",
    entityType: "quote",
    fromStatus: null,
    toStatus: entry.toStatus,
    label: entry.label,
    actorType: input.actorType,
    role: input.role ?? null,
    allowed: false,
    blockReasonCode: "UNSUPPORTED_RUNTIME_PATH",
    message,
    details: {
      fromStatus,
      runtimePosture: "quote-apply-deferred",
    },
  };
}

function action(
  actionCode: QuoteActionCatalogEntry["actionCode"],
  toStatus: QuoteActionCatalogEntry["toStatus"],
  label: string,
): QuoteActionCatalogEntry {
  return {
    actionCode,
    lifecycle: "quote",
    entityType: "quote",
    toStatus,
    label,
  };
}
