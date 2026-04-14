import { getAvailableInvoiceActions } from "./invoice-actions.ts";
import { getAvailableQuoteActions } from "./quote-actions.ts";
import type {
  LifecycleActionAvailabilityInput,
  WorkflowActionAvailabilityResult,
} from "./types.ts";
import { getAvailableWorkOrderActions } from "./work-order-actions.ts";

export async function getAvailableLifecycleActions(
  input: LifecycleActionAvailabilityInput,
): Promise<WorkflowActionAvailabilityResult> {
  switch (input.lifecycle) {
    case "work-order":
      return getAvailableWorkOrderActions(input);
    case "invoice":
      return getAvailableInvoiceActions(input);
    case "quote":
      return getAvailableQuoteActions(input);
    default:
      return {
        ok: false,
        supported: false,
        lifecycle: input.lifecycle,
        entityType: input.entityType ?? input.lifecycle,
        actions: [],
        blockReasonCode: "UNSUPPORTED_RUNTIME_PATH",
        message: `Lifecycle action availability is not supported for ${input.lifecycle}.`,
      };
  }
}
