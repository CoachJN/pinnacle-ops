import type { TransitionEventRecord } from "../audit/index.ts";
import { dispatchAutomationIntent } from "./dispatch-automation-intent.ts";
import { dispatchNotificationIntent } from "./dispatch-notification-intent.ts";
import { deriveTransitionReactionIntents } from "./event-handlers.ts";
import type {
  TransitionReactionAdapters,
  TransitionReactionDispatchResult,
  TransitionReactionResult,
  TransitionReactionWarning,
} from "./types.ts";

export async function handleTransitionEvent(
  event: TransitionEventRecord | null | undefined,
  adapters: TransitionReactionAdapters = {},
): Promise<TransitionReactionResult> {
  if (!event) {
    const warning: TransitionReactionWarning = {
      code: "TRANSITION_REACTION_EVENT_UNAVAILABLE",
      message: "Transition reaction handling skipped because no reliable event record is available.",
    };

    return buildReactionResult({
      event: undefined,
      notificationIntents: [],
      automationIntents: [],
      notificationDispatches: [],
      automationDispatches: [],
      warnings: [warning],
    });
  }

  const intents = deriveTransitionReactionIntents(event);
  const notificationDispatches = await Promise.all(
    intents.notificationIntents.map((intent) =>
      dispatchNotificationIntent(intent, adapters),
    ),
  );
  const automationDispatches = await Promise.all(
    intents.automationIntents.map((intent) =>
      dispatchAutomationIntent(intent, adapters),
    ),
  );

  return buildReactionResult({
    event,
    notificationIntents: intents.notificationIntents,
    automationIntents: intents.automationIntents,
    notificationDispatches,
    automationDispatches,
    warnings: [
      ...intents.warnings,
      ...warningsFromDispatches(notificationDispatches),
      ...warningsFromDispatches(automationDispatches),
    ],
  });
}

function warningsFromDispatches(
  dispatches: readonly TransitionReactionDispatchResult[],
): readonly TransitionReactionWarning[] {
  return dispatches.flatMap((dispatch) => dispatch.warnings ?? []);
}

function buildReactionResult(input: {
  readonly event?: TransitionEventRecord;
  readonly notificationIntents: TransitionReactionResult["notificationIntents"];
  readonly automationIntents: TransitionReactionResult["automationIntents"];
  readonly notificationDispatches: TransitionReactionResult["notificationDispatches"];
  readonly automationDispatches: TransitionReactionResult["automationDispatches"];
  readonly warnings: readonly TransitionReactionWarning[];
}): TransitionReactionResult {
  return {
    ok: true,
    event: input.event,
    notificationIntents: input.notificationIntents,
    automationIntents: input.automationIntents,
    notificationDispatches: input.notificationDispatches,
    automationDispatches: input.automationDispatches,
    generatedIntentCounts: {
      notifications: input.notificationIntents.length,
      automations: input.automationIntents.length,
    },
    dispatchSummary: {
      notificationSucceeded: input.notificationDispatches.filter(
        (dispatch) => dispatch.ok && !dispatch.skipped,
      ).length,
      notificationFailed: input.notificationDispatches.filter(
        (dispatch) => !dispatch.ok,
      ).length,
      notificationSkipped: input.notificationDispatches.filter(
        (dispatch) => dispatch.skipped,
      ).length,
      automationSucceeded: input.automationDispatches.filter(
        (dispatch) => dispatch.ok && !dispatch.skipped,
      ).length,
      automationFailed: input.automationDispatches.filter((dispatch) => !dispatch.ok)
        .length,
      automationSkipped: input.automationDispatches.filter(
        (dispatch) => dispatch.skipped,
      ).length,
    },
    warnings: input.warnings,
  };
}

