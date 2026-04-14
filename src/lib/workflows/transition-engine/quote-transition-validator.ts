import {
  canQuoteTransition,
  isTerminalQuoteStatus,
  type QuoteLifecycleStatus,
} from "../lifecycle/index.ts";
import { normalizeQuoteStatusResult } from "./adapters.ts";
import { transitionFailure, transitionSuccess } from "./errors.ts";
import type { QuoteTransitionContext, TransitionValidationResult } from "./types.ts";

export function validateQuoteTransition(
  from: QuoteLifecycleStatus | string | null | undefined,
  to: QuoteLifecycleStatus | string | null | undefined,
  context: QuoteTransitionContext = {},
): TransitionValidationResult<"quote", QuoteLifecycleStatus> {
  void context;

  const normalizedFrom = normalizeQuoteStatusResult(from);
  const normalizedTo = normalizeQuoteStatusResult(to);

  if (!normalizedFrom.ok) {
    return transitionFailure(normalizedFrom.failureCode, {
      lifecycle: "quote",
      from,
      to,
      message: normalizedFrom.message,
      details: { field: "from", original: normalizedFrom.original },
    });
  }

  if (!normalizedTo.ok) {
    return transitionFailure(normalizedTo.failureCode, {
      lifecycle: "quote",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      message: normalizedTo.message,
      details: { field: "to", original: normalizedTo.original },
    });
  }

  const currentStatusTerminal = isTerminalQuoteStatus(normalizedFrom.status);
  if (currentStatusTerminal) {
    return transitionFailure("TERMINAL_STATE", {
      lifecycle: "quote",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      normalizedTo: normalizedTo.status,
      currentStatusTerminal,
      message: `Quote status ${normalizedFrom.status} is terminal.`,
    });
  }

  if (!canQuoteTransition(normalizedFrom.status, normalizedTo.status)) {
    return transitionFailure("INVALID_TRANSITION", {
      lifecycle: "quote",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      normalizedTo: normalizedTo.status,
      message: `Quote cannot transition from ${normalizedFrom.status} to ${normalizedTo.status}.`,
    });
  }

  return transitionSuccess({
    lifecycle: "quote",
    from,
    to,
    normalizedFrom: normalizedFrom.status,
    normalizedTo: normalizedTo.status,
    message: `Quote transition ${normalizedFrom.status} -> ${normalizedTo.status} is allowed.`,
    details: {
      fromSource: normalizedFrom.source,
      toSource: normalizedTo.source,
    },
  });
}
