import type { TransitionAuditRepository } from "./repositories.ts";
import type {
  TransitionAuditLoggingResult,
  TransitionAuditRecord,
} from "./types.ts";

export async function logTransitionAttempt(input: {
  readonly repositories?: TransitionAuditRepository;
  readonly record: TransitionAuditRecord;
}): Promise<TransitionAuditLoggingResult> {
  if (!input.repositories?.recordTransitionAudit) {
    return { warnings: [] };
  }

  try {
    await input.repositories.recordTransitionAudit(input.record);
    return { warnings: [] };
  } catch (error) {
    return {
      warnings: [
        {
          code: "TRANSITION_AUDIT_LOG_FAILED",
          message: "Failed to record transition audit.",
          details: { error: error instanceof Error ? error.message : String(error) },
        },
      ],
    };
  }
}

