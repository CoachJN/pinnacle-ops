import type { TransitionAuditRepository } from "./repositories.ts";
import type {
  TransitionAuditLoggingResult,
  TransitionAuditRecord,
  TransitionEventRecord,
} from "./types.ts";

export async function logTransitionSuccess(input: {
  readonly repositories?: TransitionAuditRepository;
  readonly auditRecord: TransitionAuditRecord;
  readonly eventRecord: TransitionEventRecord;
}): Promise<TransitionAuditLoggingResult> {
  const warnings: TransitionAuditLoggingResult["warnings"][number][] = [];
  let eventRecorded = false;

  if (input.repositories?.recordTransitionAudit) {
    try {
      await input.repositories.recordTransitionAudit(input.auditRecord);
    } catch (error) {
      warnings.push({
        code: "TRANSITION_AUDIT_LOG_FAILED",
        message: "Failed to record successful transition audit.",
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  if (input.repositories?.recordTransitionEvent) {
    try {
      await input.repositories.recordTransitionEvent(input.eventRecord);
      eventRecorded = true;
    } catch (error) {
      warnings.push({
        code: "TRANSITION_EVENT_LOG_FAILED",
        message: "Failed to record transition event.",
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  } else {
    warnings.push({
      code: "TRANSITION_EVENT_LOG_UNAVAILABLE",
      message: "Transition event recording is not configured; downstream reactions were skipped.",
    });
  }

  return { warnings, eventRecorded };
}
