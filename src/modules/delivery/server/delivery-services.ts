import "server-only";

import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainEventService } from "@/server/services";
import {
  createDeliveryDiagnosticsService,
  type DeliveryDiagnosticsService,
} from "./delivery-diagnostics-service";
import {
  createDeliveryPlanRepository,
  type DeliveryPlanRepository,
} from "./delivery-plan-repository";
import {
  createDeliveryPolicyService,
  type DeliveryPolicyService,
} from "./delivery-policy-service";
import {
  createDeliveryRecipientService,
  type DeliveryRecipientService,
} from "./delivery-recipient-service";
import {
  createDeliveryRuntimeService,
  type DeliveryRuntimeService,
} from "./delivery-runtime-service";
import {
  createDeliverySchedulerService,
  type DeliverySchedulerService,
} from "./delivery-scheduler-service";
import {
  createDeliverySuppressionService,
  type DeliverySuppressionService,
} from "./delivery-suppression-service";

export interface DeliveryDomainServices {
  repository: DeliveryPlanRepository;
  policy: DeliveryPolicyService;
  recipients: DeliveryRecipientService;
  scheduler: DeliverySchedulerService;
  suppression: DeliverySuppressionService;
  runtime: DeliveryRuntimeService;
  diagnostics: DeliveryDiagnosticsService;
}

export function createDeliveryServices(
  repositories: Pick<
    FirestoreRepositories,
    "deliveryPlans" | "domainEvents" | "escalationOrchestrations" | "workOrders" | "userProfiles"
  >,
  dependencies: {
    domainEvents: DomainEventService;
  },
): DeliveryDomainServices {
  const repository = createDeliveryPlanRepository(repositories);
  const policy = createDeliveryPolicyService();
  const recipients = createDeliveryRecipientService(repositories, policy);
  const scheduler = createDeliverySchedulerService(repository);
  const suppression = createDeliverySuppressionService(repository);
  const runtime = createDeliveryRuntimeService(
    repositories,
    repository,
    policy,
    recipients,
    scheduler,
    suppression,
    dependencies.domainEvents,
  );
  const diagnostics = createDeliveryDiagnosticsService(repositories, repository);

  return {
    repository,
    policy,
    recipients,
    scheduler,
    suppression,
    runtime,
    diagnostics,
  };
}
