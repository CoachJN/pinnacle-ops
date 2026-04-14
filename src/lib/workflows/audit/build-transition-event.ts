import {
  TRANSITION_EVENT_TYPES,
  type TransitionEventType,
} from "./event-types.ts";
import type { TransitionEventRecord } from "./types.ts";

export type BuildTransitionEventRecordInput =
  Omit<TransitionEventRecord, "eventType" | "source" | "version"> & {
    readonly eventType?: TransitionEventType;
  };

export function buildTransitionEventRecord(
  input: BuildTransitionEventRecordInput,
): TransitionEventRecord {
  return {
    eventId: input.eventId,
    eventType: input.eventType ?? transitionEventTypeForLifecycle(input.lifecycle),
    lifecycle: input.lifecycle,
    entityType: input.entityType,
    entityId: input.entityId,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    actorType: input.actorType,
    role: input.role ?? null,
    actorUserId: input.actorUserId ?? null,
    timestamp: input.timestamp,
    metadata: input.metadata,
    source: "transition-service",
    version: 1,
  };
}

function transitionEventTypeForLifecycle(
  lifecycle: TransitionEventRecord["lifecycle"],
): TransitionEventType {
  switch (lifecycle) {
    case "work-order":
      return TRANSITION_EVENT_TYPES.WorkOrderStatusChanged;
    case "invoice":
      return TRANSITION_EVENT_TYPES.InvoiceStatusChanged;
    case "quote":
      return TRANSITION_EVENT_TYPES.QuoteStatusChanged;
  }
}
