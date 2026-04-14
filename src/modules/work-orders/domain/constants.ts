export const WORK_ORDER_STATUSES = [
  "NEW",
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "READY_FOR_INVOICING",
  "CANCELLED",
  "CLOSED",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const WORK_ORDER_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const;

export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

export const WORK_ORDER_CATEGORIES = [
  "GENERAL_REPAIR",
  "ELECTRICAL",
  "PLUMBING",
  "HVAC",
  "CLEANING",
  "OTHER",
] as const;

export type WorkOrderCategory = (typeof WORK_ORDER_CATEGORIES)[number];

export const WORK_ORDER_SOURCES = [
  "MANUAL",
  "CLIENT_PORTAL",
  "EMAIL",
  "PHONE",
] as const;

export type WorkOrderSource = (typeof WORK_ORDER_SOURCES)[number];

export const WORK_ORDER_STATUS_LABELS = {
  NEW: "New",
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  READY_FOR_INVOICING: "Ready for Invoicing",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
} as const satisfies Record<WorkOrderStatus, string>;

export const WORK_ORDER_PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
} as const satisfies Record<WorkOrderPriority, string>;

export const WORK_ORDER_CATEGORY_LABELS = {
  GENERAL_REPAIR: "General Repair",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  HVAC: "HVAC",
  CLEANING: "Cleaning",
  OTHER: "Other",
} as const satisfies Record<WorkOrderCategory, string>;

export function getWorkOrderStatusLabel(status: WorkOrderStatus): string {
  return WORK_ORDER_STATUS_LABELS[status];
}

export function getWorkOrderPriorityLabel(priority: WorkOrderPriority): string {
  return WORK_ORDER_PRIORITY_LABELS[priority];
}

export function getWorkOrderCategoryLabel(category: WorkOrderCategory): string {
  return WORK_ORDER_CATEGORY_LABELS[category];
}

export const ASSIGNMENT_ASSIGNEE_TYPES = [
  "internal",
  "contractor",
] as const;

export type AssignmentAssigneeType =
  (typeof ASSIGNMENT_ASSIGNEE_TYPES)[number];

export const ASSIGNMENT_STATUSES = [
  "assigned",
  "accepted",
  "declined",
  "completed",
  "cancelled",
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_STATUS_LABELS = {
  assigned: "Assigned",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
} as const satisfies Record<AssignmentStatus, string>;
