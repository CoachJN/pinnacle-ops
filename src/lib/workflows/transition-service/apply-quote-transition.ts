import { transitionApplyFailure } from "./errors.ts";
import type {
  ApplyLifecycleTransitionInput,
  TransitionApplyResult,
} from "./types.ts";

export async function applyQuoteTransition(
  input: ApplyLifecycleTransitionInput<"quote">,
): Promise<TransitionApplyResult<"quote">> {
  return transitionApplyFailure("UNSUPPORTED_RUNTIME_PATH", {
    lifecycle: "quote",
    entityType: input.entityType,
    entityId: input.entityId,
    to: input.to,
    message:
      "Quote transition application is deferred because runtime quote persistence is split across legacy contractor and client quote models.",
    details: {
      runtimeModels: ["contractor_quote", "client_quote"],
    },
  });
}
