import type {
  AutomationIntent,
  TransitionReactionAdapters,
  TransitionReactionDispatchResult,
} from "./types.ts";

export async function dispatchAutomationIntent(
  intent: AutomationIntent,
  adapters: TransitionReactionAdapters = {},
): Promise<TransitionReactionDispatchResult> {
  const shouldCreateInternalTask =
    intent.type === "CREATE_INTERNAL_FOLLOW_UP" && adapters.createInternalTask;
  const dispatcher = shouldCreateInternalTask
    ? adapters.createInternalTask
    : adapters.enqueueAutomationIntent;

  if (!dispatcher) {
    return {
      ok: true,
      skipped: true,
      intentType: intent.type,
      message: `No automation adapter configured for ${intent.type}.`,
    };
  }

  try {
    if (shouldCreateInternalTask) {
      await adapters.createInternalTask?.(intent);
    } else {
      await adapters.enqueueAutomationIntent?.(intent);
    }
    return {
      ok: true,
      intentType: intent.type,
      message: `Automation intent ${intent.type} dispatched.`,
    };
  } catch (error) {
    return {
      ok: false,
      intentType: intent.type,
      message: `Automation intent ${intent.type} failed to dispatch.`,
      warnings: [
        {
          code: "TRANSITION_REACTION_AUTOMATION_FAILED",
          message: `Automation intent ${intent.type} failed to dispatch.`,
          details: {
            entityType: intent.entityType,
            entityId: intent.entityId,
            actionKey: intent.actionKey,
            automationKey: intent.automationKey,
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    };
  }
}
