import type { EntityId } from "@/types/entity";
import type { TransitionEventRecord } from "../audit/index.ts";
import type {
  PlatformRole,
  TransitionActorType,
} from "../rbac-transition/index.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";

export type NotificationIntentType =
  | "INTERNAL_STATUS_ALERT"
  | "CLIENT_QUOTE_DECISION_REQUEST"
  | "CLIENT_QUOTE_APPROVED_CONFIRMATION"
  | "COORDINATOR_WORK_READY_ALERT"
  | "FINANCE_WORK_READY_FOR_INVOICING_ALERT"
  | "INVOICE_SENT_ALERT"
  | "INVOICE_OVERDUE_ALERT";

export type AutomationIntentType =
  | "CREATE_INTERNAL_FOLLOW_UP"
  | "FLAG_WORK_ORDER_FOR_SCHEDULING"
  | "FLAG_WORK_ORDER_FOR_INVOICING"
  | "FLAG_INVOICE_FOR_COLLECTION_REVIEW"
  | "REQUEST_MANAGER_REVIEW";

export type TransitionReactionWarningCode =
  | "TRANSITION_REACTION_EVENT_UNAVAILABLE"
  | "TRANSITION_REACTION_NOTIFICATION_FAILED"
  | "TRANSITION_REACTION_AUTOMATION_FAILED"
  | "TRANSITION_REACTION_HANDLER_FAILED"
  | "TRANSITION_REACTION_QUOTE_RUNTIME_DEFERRED";

export type TargetAudience =
  | {
      readonly type: "role";
      readonly roles: readonly PlatformRole[];
    }
  | {
      readonly type: "client-contact";
    }
  | {
      readonly type: "coordinator-assigned";
    }
  | {
      readonly type: "finance";
    };

interface TransitionIntentBase {
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: TransitionEventRecord["entityType"];
  readonly entityId: EntityId;
  readonly eventType: TransitionEventRecord["eventType"];
  readonly previousStatus: string;
  readonly newStatus: string;
  readonly actorType: TransitionActorType | string;
  readonly role?: PlatformRole | string | null;
  readonly actorUserId?: EntityId | null;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NotificationIntent extends TransitionIntentBase {
  readonly type: NotificationIntentType;
  readonly targetAudience: TargetAudience;
  readonly recipientRoles?: readonly PlatformRole[];
}

export interface AutomationIntent extends TransitionIntentBase {
  readonly type: AutomationIntentType;
  readonly actionKey: string;
  readonly automationKey: string;
}

export interface TransitionReactionWarning {
  readonly code: TransitionReactionWarningCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface TransitionReactionDispatchResult {
  readonly ok: boolean;
  readonly intentType: NotificationIntentType | AutomationIntentType;
  readonly skipped?: boolean;
  readonly message: string;
  readonly warnings?: readonly TransitionReactionWarning[];
}

export interface TransitionReactionResult {
  readonly ok: true;
  readonly event?: TransitionEventRecord;
  readonly notificationIntents: readonly NotificationIntent[];
  readonly automationIntents: readonly AutomationIntent[];
  readonly notificationDispatches: readonly TransitionReactionDispatchResult[];
  readonly automationDispatches: readonly TransitionReactionDispatchResult[];
  readonly generatedIntentCounts: {
    readonly notifications: number;
    readonly automations: number;
  };
  readonly dispatchSummary: {
    readonly notificationSucceeded: number;
    readonly notificationFailed: number;
    readonly notificationSkipped: number;
    readonly automationSucceeded: number;
    readonly automationFailed: number;
    readonly automationSkipped: number;
  };
  readonly warnings: readonly TransitionReactionWarning[];
}

export type Awaitable<T> = T | Promise<T>;

export interface TransitionReactionAdapters {
  readonly sendInternalNotification?: (
    intent: NotificationIntent,
  ) => Awaitable<void>;
  readonly sendClientNotification?: (
    intent: NotificationIntent,
  ) => Awaitable<void>;
  readonly enqueueAutomationIntent?: (
    intent: AutomationIntent,
  ) => Awaitable<void>;
  readonly createInternalTask?: (intent: AutomationIntent) => Awaitable<void>;
}
