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
import { createRuntimeCapacityServices } from "@/modules/runtime-capacity";
import {
  createSlaServices,
  type SlaDomainServices,
} from "@/modules/sla";
import { createFirestoreRuntimeObservabilityRepositories } from "@/modules/operations/server/runtime-observability-repository";
import type { FirestoreRepositories } from "@/server/repositories";
import { createFirestoreRepositories } from "@/server/repositories";
import {
  createWorkOrderService,
  type WorkOrderService,
} from "@/server/services/work-order-service";
import {
  createAtomicPersistenceService,
  type AtomicPersistenceService,
} from "@/server/services/atomic-persistence-service";

export type {
  AtomicPersistenceService,
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
export type {
  WorkOrderMutationActor,
  WorkOrderMutationContext,
  WorkOrderMutationSource,
} from "@/server/services/work-order-mutation-context";
export {
  canInvoiceTransition,
  canQuoteTransition,
  canWorkOrderTransition,
  INVOICE_TRANSITIONS,
  QUOTE_TRANSITIONS,
  WORK_ORDER_TRANSITIONS,
} from "@/server/services/status-rules";
export {
  createSystemWorkOrderMutationContext,
  createWorkOrderMutationContext,
} from "@/server/services/work-order-mutation-context";
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
  const atomicPersistence = createAtomicPersistenceService();
  const domainEvents = createDomainEventService(repositories, {
    atomicPersistence,
  });
  const clientLocations = createClientLocationService(repositories);
  const communications = createCommunicationServices(repositories, { domainEvents });
  const contacts = createContactService(repositories);
  const contractors = createContractorService(repositories);
  const notifications = createNotificationService(repositories);
  const workOrders = createWorkOrderService(repositories, {
    domainEvents,
    clientLocations,
    notifications,
    atomicPersistence,
  });
  const timeline = createTimelineService(repositories, { domainEvents });
  const intake = createIntakeServices(repositories, {
    communications,
    domainEvents,
    timeline,
    workOrders,
    atomicPersistence,
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
    providerConnections: repositories.providerConnections,
    getDeliveryPlanById: repositories.deliveryPlans.getById.bind(repositories.deliveryPlans),
    saveDeliveryPlan: async (plan) => {
      await repositories.deliveryPlans.save(plan);
    },
    atomicPersistence,
  });
  const transport = createTransportServices(repositories, {
    domainEvents,
    deliveryPolicy: delivery.policy,
    providerRuntime: providerRuntime.capture,
  });
  const runtimeCapacity = createRuntimeCapacityServices({
    repositories: {
      runtimeJobs: repositories.runtimeJobs,
      runtimeDeadLetters: repositories.runtimeDeadLetters,
      deliveryAttempts: repositories.deliveryAttempts,
      escalationOrchestrations: repositories.escalationOrchestrations,
    },
    providerRuntimeStorage: providerRuntime.storage,
    observability: createFirestoreRuntimeObservabilityRepositories(),
  });
  const runtime = createRuntimeServices(repositories, {
    domainEvents,
    slaScheduler: sla.scheduler,
    capacityGuardrails: runtimeCapacity.guardrails,
  });

  return {
    activityLogs,
    assignments: createAssignmentService(repositories, {
      domainEvents,
      workOrders,
      notifications,
      atomicPersistence,
    }),
    clientLocations,
    communications,
    contacts,
    contractors,
    domainEvents,
    invoices: createInvoiceService(repositories, {
      domainEvents,
      workOrders,
      notifications,
      atomicPersistence,
    }),
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
      workOrders,
      notifications,
      atomicPersistence,
    }),
    timeline,
    workOrders,
  };
}
