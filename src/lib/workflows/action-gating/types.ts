import type { EntityId } from "@/types/entity";
import type { ClientInvoice as Invoice } from "@/types/invoice";
import type { WorkOrder } from "@/types/work-order";
import type {
  InvoiceLifecycleStatus,
  QuoteLifecycleStatus,
  WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";
import type {
  PlatformRole,
  TransitionActorType,
} from "../rbac-transition/index.ts";
import type {
  TransitionContextByLifecycle,
  TransitionLifecycle,
  TransitionStatusByLifecycle,
} from "../transition-engine/index.ts";
import type { LifecycleEntityType } from "../transition-service/index.ts";
import type { LifecycleTransitionRepositories } from "../transition-service/repositories.ts";

export type WorkOrderActionCode =
  | "move_to_triage"
  | "request_quote"
  | "mark_quote_received"
  | "send_for_client_approval"
  | "approve_to_proceed"
  | "move_to_scheduling"
  | "mark_scheduled"
  | "start_work"
  | "mark_work_completed"
  | "send_to_qa"
  | "ready_for_invoicing"
  | "complete_work_order"
  | "place_on_hold"
  | "escalate_work_order"
  | "cancel_work_order";

export type InvoiceActionCode =
  | "mark_ready"
  | "draft_invoice"
  | "send_invoice"
  | "mark_partially_paid"
  | "mark_paid"
  | "void_invoice"
  | "mark_viewed"
  | "mark_overdue";

export type QuoteActionCode =
  | "submit_quote"
  | "start_quote_review"
  | "reject_quote"
  | "approve_quote_internal"
  | "send_quote_to_client"
  | "approve_quote_as_client"
  | "reject_quote_as_client"
  | "expire_quote"
  | "cancel_quote";

export type WorkflowActionCode =
  | WorkOrderActionCode
  | InvoiceActionCode
  | QuoteActionCode;

export type WorkflowBlockReasonCode =
  | "ENTITY_NOT_FOUND"
  | "UNKNOWN_STATUS"
  | "INVALID_ROLE"
  | "INVALID_ACTOR_TYPE"
  | "INVALID_TRANSITION"
  | "TERMINAL_STATE"
  | "DEPENDENCY_FAILED"
  | "ROLE_NOT_PERMITTED"
  | "SYSTEM_ONLY"
  | "UNSUPPORTED_RUNTIME_PATH"
  | "STATUS_MODEL_MISMATCH";

export interface WorkflowActionCatalogEntry<
  TActionCode extends WorkflowActionCode = WorkflowActionCode,
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
> {
  readonly actionCode: TActionCode;
  readonly lifecycle: TLifecycle;
  readonly entityType: LifecycleEntityType;
  readonly toStatus: TransitionStatusByLifecycle[TLifecycle];
  readonly label: string;
}

export interface WorkflowActionDescriptor<
  TActionCode extends WorkflowActionCode = WorkflowActionCode,
  TLifecycle extends TransitionLifecycle = TransitionLifecycle,
> {
  readonly actionCode: TActionCode;
  readonly lifecycle: TLifecycle;
  readonly entityType: LifecycleEntityType;
  readonly fromStatus: TransitionStatusByLifecycle[TLifecycle] | null;
  readonly toStatus: TransitionStatusByLifecycle[TLifecycle];
  readonly label: string;
  readonly actorType: TransitionActorType | string | null | undefined;
  readonly role?: PlatformRole | string | null;
  readonly allowed: boolean;
  readonly blockReasonCode?: WorkflowBlockReasonCode | null;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type WorkflowActionAvailability = WorkflowActionDescriptor;

export interface WorkflowActionAvailabilityResult<
  TAction extends WorkflowActionDescriptor = WorkflowActionDescriptor,
> {
  readonly ok: boolean;
  readonly supported: boolean;
  readonly lifecycle: TransitionLifecycle | string;
  readonly entityType: LifecycleEntityType | string;
  readonly entityId?: EntityId;
  readonly currentStatus?: string | null;
  readonly actions: readonly TAction[];
  readonly blockReasonCode?: WorkflowBlockReasonCode | null;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkflowActionActorInput {
  readonly actorType: TransitionActorType | string | null | undefined;
  readonly role?: PlatformRole | string | null;
  readonly actorUserId?: EntityId;
}

export interface WorkOrderActionAvailabilityInput
  extends WorkflowActionActorInput {
  readonly entity?: WorkOrder | null;
  readonly entityId?: EntityId;
  readonly repositories?: Pick<LifecycleTransitionRepositories, "getWorkOrderById">;
  readonly contextOverrides?: Partial<TransitionContextByLifecycle["work-order"]>;
}

export interface InvoiceActionAvailabilityInput
  extends WorkflowActionActorInput {
  readonly entity?: Invoice | null;
  readonly entityId?: EntityId;
  readonly repositories?: Pick<
    LifecycleTransitionRepositories,
    "getInvoiceById" | "getWorkOrderById"
  >;
  readonly contextOverrides?: Partial<TransitionContextByLifecycle["invoice"]>;
}

export interface QuoteActionAvailabilityInput
  extends WorkflowActionActorInput {
  readonly entity?: { readonly id: EntityId; readonly status?: string | null } | null;
  readonly entityId?: EntityId;
}

export type LifecycleActionAvailabilityInput =
  | ({ readonly lifecycle: "work-order"; readonly entityType?: "work-order" } & WorkOrderActionAvailabilityInput)
  | ({ readonly lifecycle: "invoice"; readonly entityType?: "invoice" } & InvoiceActionAvailabilityInput)
  | ({ readonly lifecycle: "quote"; readonly entityType?: "quote" } & QuoteActionAvailabilityInput)
  | ({
      readonly lifecycle: string;
      readonly entityType?: string;
    } & WorkflowActionActorInput);

export type WorkOrderActionDescriptor = WorkflowActionDescriptor<
  WorkOrderActionCode,
  "work-order"
>;

export type InvoiceActionDescriptor = WorkflowActionDescriptor<
  InvoiceActionCode,
  "invoice"
>;

export type QuoteActionDescriptor = WorkflowActionDescriptor<
  QuoteActionCode,
  "quote"
>;

export type WorkOrderActionAvailabilityResult =
  WorkflowActionAvailabilityResult<WorkOrderActionDescriptor>;

export type InvoiceActionAvailabilityResult =
  WorkflowActionAvailabilityResult<InvoiceActionDescriptor>;

export type QuoteActionAvailabilityResult =
  WorkflowActionAvailabilityResult<QuoteActionDescriptor>;

export type WorkOrderRuntimeState = WorkOrder & {
  readonly quoteRequired?: boolean;
  readonly requiresQuote?: boolean;
  readonly quoteStatus?: string | null;
  readonly clientQuoteStatus?: string | null;
};

export type InvoiceRuntimeState = Invoice;

export type WorkOrderActionCatalogEntry = WorkflowActionCatalogEntry<
  WorkOrderActionCode,
  "work-order"
>;

export type InvoiceActionCatalogEntry = WorkflowActionCatalogEntry<
  InvoiceActionCode,
  "invoice"
>;

export type QuoteActionCatalogEntry = WorkflowActionCatalogEntry<
  QuoteActionCode,
  "quote"
>;

export type AnyLifecycleStatus =
  | WorkOrderLifecycleStatus
  | InvoiceLifecycleStatus
  | QuoteLifecycleStatus;
