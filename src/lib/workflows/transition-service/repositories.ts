import type { EntityId } from "@/types/entity";
import type { ClientInvoice as Invoice } from "@/types/invoice";
import type { WorkOrder } from "@/types/work-order";
import type {
  InvoiceLifecycleStatus,
  WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";
import type { TransitionAuditRepository } from "../audit/index.ts";
import type { WorkflowOrchestrationAdapters } from "../orchestration/index.ts";
import type { WorkflowExecutionAdapters } from "../execution/index.ts";
import type { TransitionReactionAdapters } from "../reactions/index.ts";
import type { TransitionUpdateMetadata } from "./types.ts";

export type Awaitable<T> = T | Promise<T>;

export type WorkOrderStatusUpdateResult =
  | WorkOrder
  | { readonly status?: WorkOrderLifecycleStatus | string }
  | void;

export type InvoiceStatusUpdateResult =
  | Invoice
  | { readonly status?: InvoiceLifecycleStatus | string }
  | void;

export interface WorkOrderTransitionRepository {
  readonly getWorkOrderById: (entityId: EntityId) => Awaitable<WorkOrder | null>;
  readonly updateWorkOrderStatus: (
    entityId: EntityId,
    nextStatus: WorkOrderLifecycleStatus,
    updateMeta?: TransitionUpdateMetadata,
  ) => Awaitable<WorkOrderStatusUpdateResult>;
}

export interface InvoiceTransitionRepository {
  readonly getInvoiceById: (entityId: EntityId) => Awaitable<Invoice | null>;
  readonly updateInvoiceStatus: (
    entityId: EntityId,
    nextStatus: InvoiceLifecycleStatus,
    updateMeta?: TransitionUpdateMetadata,
  ) => Awaitable<InvoiceStatusUpdateResult>;
  readonly getWorkOrderById: (entityId: EntityId) => Awaitable<WorkOrder | null>;
}

export type LifecycleTransitionRepositories =
  Partial<
    WorkOrderTransitionRepository &
      InvoiceTransitionRepository &
      TransitionAuditRepository &
      TransitionReactionAdapters &
      WorkflowOrchestrationAdapters &
      WorkflowExecutionAdapters
  >;
