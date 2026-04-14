export const workOrdersModule = {
  name: "work-orders",
  routeBasePath: "/work-orders",
} as const;

export {
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_CATEGORY_LABELS,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_SOURCES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_LABELS,
  getWorkOrderCategoryLabel,
  getWorkOrderPriorityLabel,
  getWorkOrderStatusLabel,
} from "./domain/constants.ts";
export {
  createWorkOrderAttachmentMetadataSchema,
  createWorkOrderNoteSchema,
  createWorkOrderSchema,
  updateWorkOrderStatusSchema,
  workOrderCategorySchema,
  workOrderListQuerySchema,
  workOrderPrioritySchema,
  workOrderSourceSchema,
  workOrderStatusSchema,
} from "./domain/schemas.ts";
export {
  getAllowedNextWorkOrderStatuses,
  isWorkOrderStatusTransitionAllowed,
  WORK_ORDER_STATUS_TRANSITION_MAP,
} from "./domain/transitions.ts";
export type {
  CreateWorkOrderAttachmentMetadataDto,
  CreateWorkOrderDto,
  CreateWorkOrderNoteDto,
  UpdateWorkOrderStatusDto,
  WorkOrderListQueryDto,
} from "./domain/schemas.ts";
export type {
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderDetail,
  WorkOrderListItem,
  WorkOrderListQuery,
  WorkOrderNote,
} from "./domain/types.ts";
export type {
  WorkOrderCategory,
  WorkOrderPriority,
  WorkOrderSource,
  WorkOrderStatus,
} from "./domain/constants.ts";
