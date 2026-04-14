import "server-only";

import {
  createActivityLogService,
  type ActivityLogService,
} from "@/server/services/activity-log-service";
import {
  createAssignmentService,
  type AssignmentService,
} from "@/server/services/assignment-service";
import {
  createClientLocationService,
  type ClientLocationService,
} from "@/server/services/client-location-service";
import {
  createContractorService,
  type ContractorService,
} from "@/server/services/contractor-service";
import {
  createInvoiceService,
  type InvoiceService,
} from "@/server/services/invoice-service";
import {
  createNotificationService,
  type NotificationService,
} from "@/server/services/notification-service";
import {
  createQuoteService,
  type QuoteService,
} from "@/server/services/quote-service";
import {
  createQuoteWorkflowService,
  type QuoteWorkflowService,
} from "@/server/services/quote-workflow-service";
import type { FirestoreRepositories } from "@/server/repositories";
import { createFirestoreRepositories } from "@/server/repositories";
import {
  createWorkOrderService,
  type WorkOrderService,
} from "@/server/services/work-order-service";

export type {
  ActivityLogService,
  AssignmentService,
  ClientLocationService,
  ContractorService,
  InvoiceService,
  NotificationService,
  QuoteService,
  QuoteWorkflowService,
  WorkOrderService,
};
export type {
  ServiceActor,
  ServiceAuditContext,
  ServiceResult,
} from "@/server/services/types";
export {
  canInvoiceTransition,
  canQuoteTransition,
  canWorkOrderTransition,
  INVOICE_TRANSITIONS,
  QUOTE_TRANSITIONS,
  WORK_ORDER_TRANSITIONS,
} from "@/server/services/status-rules";
export { serviceFail, serviceOk } from "@/server/services/types";

export interface DomainServices {
  activityLogs: ActivityLogService;
  assignments: AssignmentService;
  clientLocations: ClientLocationService;
  contractors: ContractorService;
  invoices: InvoiceService;
  notifications: NotificationService;
  quotes: QuoteService;
  quoteWorkflow: QuoteWorkflowService;
  workOrders: WorkOrderService;
}

export function createDomainServices(
  repositories: FirestoreRepositories = createFirestoreRepositories(),
): DomainServices {
  const activityLogs = createActivityLogService(repositories);
  const clientLocations = createClientLocationService(repositories);
  const contractors = createContractorService(repositories);
  const notifications = createNotificationService(repositories);

  return {
    activityLogs,
    assignments: createAssignmentService(repositories, {
      activityLogs,
      notifications,
    }),
    clientLocations,
    contractors,
    invoices: createInvoiceService(repositories, { activityLogs, notifications }),
    notifications,
    quotes: createQuoteService(repositories, { activityLogs, notifications }),
    quoteWorkflow: createQuoteWorkflowService(repositories, {
      activityLogs,
      notifications,
    }),
    workOrders: createWorkOrderService(repositories, {
      activityLogs,
      clientLocations,
      notifications,
    }),
  };
}
