import type {
  NotificationIntent,
  TransitionReactionAdapters,
  TransitionReactionDispatchResult,
} from "./types.ts";

const CLIENT_NOTIFICATION_TYPES: ReadonlySet<NotificationIntent["type"]> =
  new Set([
    "CLIENT_QUOTE_DECISION_REQUEST",
    "CLIENT_QUOTE_APPROVED_CONFIRMATION",
    "INVOICE_SENT_ALERT",
  ]);

export async function dispatchNotificationIntent(
  intent: NotificationIntent,
  adapters: TransitionReactionAdapters = {},
): Promise<TransitionReactionDispatchResult> {
  const isClientNotification = CLIENT_NOTIFICATION_TYPES.has(intent.type);
  const dispatcher = isClientNotification
    ? adapters.sendClientNotification
    : adapters.sendInternalNotification;

  if (!dispatcher) {
    return {
      ok: true,
      skipped: true,
      intentType: intent.type,
      message: `No notification adapter configured for ${intent.type}.`,
    };
  }

  try {
    if (isClientNotification) {
      await adapters.sendClientNotification?.(intent);
    } else {
      await adapters.sendInternalNotification?.(intent);
    }
    return {
      ok: true,
      intentType: intent.type,
      message: `Notification intent ${intent.type} dispatched.`,
    };
  } catch (error) {
    return {
      ok: false,
      intentType: intent.type,
      message: `Notification intent ${intent.type} failed to dispatch.`,
      warnings: [
        {
          code: "TRANSITION_REACTION_NOTIFICATION_FAILED",
          message: `Notification intent ${intent.type} failed to dispatch.`,
          details: {
            entityType: intent.entityType,
            entityId: intent.entityId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    };
  }
}
