import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  PlatformRole,
  TransitionActorType,
} from "../rbac-transition/index.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";
import type {
  TransitionAuditOutcome,
  TransitionEventType,
} from "./event-types.ts";

export type TransitionAuditEntityType = "work-order" | "invoice" | "quote";

export type TransitionAuditMetadata = Readonly<Record<string, unknown>>;

export interface TransitionAuditRecord {
  readonly auditId?: EntityId;
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: TransitionAuditEntityType;
  readonly entityId: EntityId;
  readonly actorType: TransitionActorType | string;
  readonly role?: PlatformRole | string | null;
  readonly actorUserId?: EntityId | null;
  readonly attemptedFromStatus?: string | null;
  readonly attemptedToStatus?: string | null;
  readonly finalOutcome: TransitionAuditOutcome;
  readonly failureCode?: string | null;
  readonly message: string;
  readonly authorizationFailureCode?: string | null;
  readonly validationFailureCode?: string | null;
  readonly timestamp: IsoDateTimeString;
  readonly metadata?: TransitionAuditMetadata;
  readonly correlationId?: string;
  readonly requestId?: string;
}

export interface TransitionEventRecord {
  readonly eventId?: EntityId;
  readonly eventType: TransitionEventType;
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: TransitionAuditEntityType;
  readonly entityId: EntityId;
  readonly previousStatus: string;
  readonly newStatus: string;
  readonly actorType: TransitionActorType | string;
  readonly role?: PlatformRole | string | null;
  readonly actorUserId?: EntityId | null;
  readonly timestamp: IsoDateTimeString;
  readonly metadata?: TransitionAuditMetadata;
  readonly source: "transition-service";
  readonly version: 1;
}

export interface TransitionSideEffectWarning {
  readonly code:
    | "TRANSITION_AUDIT_LOG_FAILED"
    | "TRANSITION_EVENT_LOG_FAILED"
    | "TRANSITION_EVENT_LOG_UNAVAILABLE"
    | "TRANSITION_REACTION_NOTIFICATION_FAILED"
    | "TRANSITION_REACTION_AUTOMATION_FAILED"
    | "TRANSITION_REACTION_EVENT_UNAVAILABLE"
    | "TRANSITION_REACTION_HANDLER_FAILED"
    | "TRANSITION_REACTION_QUOTE_RUNTIME_DEFERRED"
    | "WORKFLOW_ORCHESTRATION_EVENT_UNAVAILABLE"
    | "WORKFLOW_ORCHESTRATION_REPOSITORY_UNAVAILABLE"
    | "WORKFLOW_ORCHESTRATION_PERSISTENCE_FAILED"
    | "WORKFLOW_ORCHESTRATION_DISPATCH_FAILED"
    | "WORKFLOW_ORCHESTRATION_QUOTE_RUNTIME_DEFERRED"
    | "WORKFLOW_ORCHESTRATION_HANDLER_FAILED"
    | "WORKFLOW_SLA_REPOSITORY_UNAVAILABLE"
    | "WORKFLOW_SLA_TIMER_PERSISTENCE_FAILED"
    | "WORKFLOW_SLA_TIMER_UPDATE_FAILED"
    | "WORKFLOW_SLA_BREACH_PERSISTENCE_FAILED"
    | "WORKFLOW_SLA_QUOTE_RUNTIME_DEFERRED"
    | "WORKFLOW_SLA_HANDLER_FAILED";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface TransitionAuditLoggingResult {
  readonly warnings: readonly TransitionSideEffectWarning[];
  readonly eventRecorded?: boolean;
}
