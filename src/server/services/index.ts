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
  createQuoteService,
  type QuoteService,
} from "@/server/services/quote-service";
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
  QuoteService,
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
  quotes: QuoteService;
  workOrders: WorkOrderService;
}

export function createDomainServices(
  repositories: FirestoreRepositories = createFirestoreRepositories(),
): DomainServices {
  const activityLogs = createActivityLogService(repositories);
  const clientLocations = createClientLocationService(repositories);
  const contractors = createContractorService(repositories);

  return {
    activityLogs,
    assignments: createAssignmentService(repositories, {
      activityLogs,
      contractors,
    }),
    clientLocations,
    contractors,
    invoices: createInvoiceService(repositories, { activityLogs }),
    quotes: createQuoteService(repositories, { activityLogs }),
    workOrders: createWorkOrderService(repositories, {
      activityLogs,
      clientLocations,
    }),
  };
}
