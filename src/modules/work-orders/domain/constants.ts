export const WORK_ORDER_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
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
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
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
