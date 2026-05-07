import "server-only";

import {
  createActivityLogService,
  type ActivityLogService,
} from "@/server/services/activity-log-service";
import {
  createDomainEventService,
  type DomainEventService,
} from "@/server/services/domain-event-service";
import {
  createAssignmentService,
  type AssignmentService,
} from "@/server/services/assignment-service";
import {
  createClientLocationService,
  type ClientLocationService,
} from "@/server/services/client-location-service";
import {
  createContactService,
  type ContactService,
} from "@/server/services/contact-service";
import {
  createCommunicationServices,
  type CommunicationDomainServices,
} from "@/server/services/communication-service";
import {
  createContractorService,
  type ContractorService,
} from "@/server/services/contractor-service";
import {
  createInvoiceService,
  type InvoiceService,
} from "@/server/services/invoice-service";
import {
  createIntakeServices,
  type IntakeDomainServices,
} from "@/server/services/intake-service";
import {
  createNotificationService,
  type NotificationService,
} from "@/server/services/notification-service";
import {
  createProviderServices,
  type ProviderDomainServices,
} from "@/server/services/provider-service";
import {
  createQuoteWorkflowService,
  type QuoteWorkflowService,
} from "@/server/services/quote-workflow-service";
import {
  createTimelineService,
  type TimelineService,
} from "@/server/services/timeline-service";
import {
  createDeliveryServices,
  type DeliveryDomainServices,
} from "@/modules/delivery";
import {
  createEscalationServices,
  type EscalationDomainServices,
} from "@/modules/escalation";
import {
  createTransportServices,
  type TransportDomainServices,
} from "@/modules/transport";
import {
  createProviderRuntimeServices,
  type ProviderRuntimeDomainServices,
} from "@/modules/provider-runtime";
import { createTransportAttemptRepository } from "@/modules/transport";
import {
  createRuntimeServices,
  type RuntimeDomainServices,
} from "@/modules/runtime/server/worker-runtime-service";
import {
  createSlaServices,
  type SlaDomainServices,
} from "@/modules/sla";
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
  CommunicationDomainServices,
  ContactService,
  ContractorService,
  DomainEventService,
  InvoiceService,
  IntakeDomainServices,
  NotificationService,
  ProviderDomainServices,
  RuntimeDomainServices,
  DeliveryDomainServices,
  EscalationDomainServices,
  TransportDomainServices,
  ProviderRuntimeDomainServices,
  SlaDomainServices,
  QuoteWorkflowService,
  TimelineService,
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
  communications: CommunicationDomainServices;
  contacts: ContactService;
  contractors: ContractorService;
  domainEvents: DomainEventService;
  invoices: InvoiceService;
  intake: IntakeDomainServices;
  notifications: NotificationService;
  providers: ProviderDomainServices;
  runtime: RuntimeDomainServices;
  delivery: DeliveryDomainServices;
  escalation: EscalationDomainServices;
  transport: TransportDomainServices;
  providerRuntime: ProviderRuntimeDomainServices;
  sla: SlaDomainServices;
  quoteWorkflow: QuoteWorkflowService;
  timeline: TimelineService;
  workOrders: WorkOrderService;
}

export function createDomainServices(
  repositories: FirestoreRepositories = createFirestoreRepositories(),
): DomainServices {
  const activityLogs = createActivityLogService(repositories);
  const domainEvents = createDomainEventService(repositories);
  const clientLocations = createClientLocationService(repositories);
  const communications = createCommunicationServices(repositories, { domainEvents });
  const contacts = createContactService(repositories);
  const contractors = createContractorService(repositories);
  const notifications = createNotificationService(repositories);
  const workOrders = createWorkOrderService(repositories, {
    domainEvents,
    clientLocations,
    notifications,
  });
  const timeline = createTimelineService(repositories, { domainEvents });
  const intake = createIntakeServices(repositories, {
    communications,
    domainEvents,
    timeline,
    workOrders,
  });
  const providers = createProviderServices(repositories, {
    domainEvents,
    intake,
  });
  const sla = createSlaServices(repositories, {
    domainEvents,
  });
  const escalation = createEscalationServices(repositories, {
    domainEvents,
  });
  const delivery = createDeliveryServices(repositories, {
    domainEvents,
  });
  const transportRepository = createTransportAttemptRepository(repositories);
  const providerRuntime = createProviderRuntimeServices({
    domainEvents,
    attempts: transportRepository,
    getDeliveryPlanById: repositories.deliveryPlans.getById.bind(repositories.deliveryPlans),
    saveDeliveryPlan: async (plan) => {
      await repositories.deliveryPlans.save(plan);
    },
  });
  const transport = createTransportServices(repositories, {
    domainEvents,
    deliveryPolicy: delivery.policy,
    providerRuntime: providerRuntime.capture,
  });
  const runtime = createRuntimeServices(repositories, {
    domainEvents,
    slaScheduler: sla.scheduler,
  });

  return {
    activityLogs,
    assignments: createAssignmentService(repositories, {
      domainEvents,
      notifications,
    }),
    clientLocations,
    communications,
    contacts,
    contractors,
    domainEvents,
    invoices: createInvoiceService(repositories, { domainEvents, notifications }),
    intake,
    notifications,
    providers,
    runtime,
    delivery,
    escalation,
    transport,
    providerRuntime,
    sla,
    quoteWorkflow: createQuoteWorkflowService(repositories, {
      domainEvents,
      notifications,
    }),
    timeline,
    workOrders,
  };
}
