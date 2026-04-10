export type WorkOrderStatus =
  | "draft"
  | "submitted"
  | "assigned"
  | "in_progress"
  | "waiting_on_contractor"
  | "waiting_on_customer"
  | "quoted"
  | "approved"
  | "scheduled"
  | "completed"
  | "invoiced"
  | "closed"
  | "cancelled";

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedTo?: string;
}