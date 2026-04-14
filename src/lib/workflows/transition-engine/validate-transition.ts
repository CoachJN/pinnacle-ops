import { validateInvoiceTransition } from "./invoice-transition-validator.ts";
import { validateQuoteTransition } from "./quote-transition-validator.ts";
import type {
  AnyTransitionValidationResult,
  InvoiceTransitionContext,
  QuoteTransitionContext,
  TransitionLifecycle,
  TransitionValidationInput,
  WorkOrderTransitionContext,
} from "./types.ts";
import { validateWorkOrderTransition } from "./work-order-transition-validator.ts";

const supportedLifecycles = ["work-order", "quote", "invoice"] as const;

export function validateLifecycleTransition(
  input: TransitionValidationInput,
): AnyTransitionValidationResult {
  if (!isTransitionLifecycle(input.lifecycle)) {
    return {
      ok: false,
      lifecycle: input.lifecycle,
      from: input.from,
      to: input.to,
      currentStatusTerminal: false,
      failureCode: "INVALID_LIFECYCLE",
      message: `${input.lifecycle} is not a supported lifecycle.`,
      details: { supportedLifecycles },
    };
  }

  switch (input.lifecycle) {
    case "work-order":
      return validateWorkOrderTransition(
        input.from,
        input.to,
        input.context as WorkOrderTransitionContext | undefined,
      );
    case "quote":
      return validateQuoteTransition(
        input.from,
        input.to,
        input.context as QuoteTransitionContext | undefined,
      );
    case "invoice":
      return validateInvoiceTransition(
        input.from,
        input.to,
        input.context as InvoiceTransitionContext | undefined,
      );
  }
}

function isTransitionLifecycle(
  lifecycle: string,
): lifecycle is TransitionLifecycle {
  return (supportedLifecycles as readonly string[]).includes(lifecycle);
}
