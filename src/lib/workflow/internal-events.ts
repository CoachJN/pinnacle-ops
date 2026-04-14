import type { ActivityEntry } from "../../types/work-order.ts";

export type WorkflowEventType =
  | "quote_requested"
  | "quote_submitted"
  | "quote_pending_client_approval"
  | "client_approved"
  | "client_rejected"
  | "contractor_assigned"
  | "invoice_issued"
  | "invoice_overdue"
  | "invoice_paid"
  | "invoice_voided"
  | "work_order_closed";

export interface WorkflowEventRecord {
  id: string;
  workOrderId: string;
  type: WorkflowEventType;
  message: string;
  createdAt: string;
  sourceActivityId?: ActivityEntry["id"];
}

const store = globalThis as typeof globalThis & {
  __pinnaclePhaseSevenWorkflowEvents?: WorkflowEventRecord[];
};

const workflowEvents =
  store.__pinnaclePhaseSevenWorkflowEvents ?? [];

store.__pinnaclePhaseSevenWorkflowEvents = workflowEvents;

export function recordWorkflowEvent(
  input: Omit<WorkflowEventRecord, "id" | "createdAt"> & { createdAt?: string },
): WorkflowEventRecord {
  const event = {
    ...input,
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  workflowEvents.unshift(event);
  return event;
}

export function listWorkflowEvents(): readonly WorkflowEventRecord[] {
  return [...workflowEvents];
}
