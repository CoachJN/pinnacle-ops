import type { TransitionEventRecord } from "../audit/index.ts";
import { buildAutomationIntents } from "./automation-intents.ts";
import { buildNotificationIntents } from "./notification-intents.ts";
import type {
  AutomationIntent,
  NotificationIntent,
  TransitionReactionWarning,
} from "./types.ts";

export interface TransitionReactionIntents {
  readonly notificationIntents: readonly NotificationIntent[];
  readonly automationIntents: readonly AutomationIntent[];
  readonly warnings: readonly TransitionReactionWarning[];
}

export function deriveTransitionReactionIntents(
  event: TransitionEventRecord,
): TransitionReactionIntents {
  if (event.lifecycle === "quote") {
    return {
      notificationIntents: [],
      automationIntents: [],
      warnings: [
        {
          code: "TRANSITION_REACTION_QUOTE_RUNTIME_DEFERRED",
          message:
            "Quote reaction mappings are defined, but runtime quote transition event handling remains deferred.",
          details: { entityId: event.entityId, newStatus: event.newStatus },
        },
      ],
    };
  }

  return {
    notificationIntents: buildNotificationIntents(event),
    automationIntents: buildAutomationIntents(event),
    warnings: [],
  };
}

