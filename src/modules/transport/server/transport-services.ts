import "server-only";

import type { DeliveryPolicyService } from "@/modules/delivery";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainEventService } from "@/server/services";
import {
  createTransportAdapterRegistry,
  type TransportAdapterRegistry,
} from "./transport-adapter-registry";
import { createInternalTransportAdapter } from "./adapters/internal-transport-adapter";
import {
  createTransportAttemptRepository,
  type TransportAttemptRepository,
} from "./transport-attempt-repository";
import {
  createTransportRetryService,
  type TransportRetryService,
} from "./transport-retry-service";
import {
  createTransportReceiptService,
  type TransportReceiptService,
} from "./transport-receipt-service";
import {
  createTransportRuntimeService,
  type TransportRuntimeService,
} from "./transport-runtime-service";
import {
  createTransportDiagnosticsService,
  type TransportDiagnosticsService,
} from "./transport-diagnostics-service";
import type { TransportAdapter } from "@/modules/transport";
import type { ProviderReceiptCaptureService } from "@/modules/provider-runtime";

export interface TransportDomainServices {
  repository: TransportAttemptRepository;
  registry: TransportAdapterRegistry;
  retry: TransportRetryService;
  receipts: TransportReceiptService;
  runtime: TransportRuntimeService;
  diagnostics: TransportDiagnosticsService;
}

export function createTransportServices(
  repositories: Pick<FirestoreRepositories, "deliveryAttempts" | "deliveryPlans" | "domainEvents">,
  dependencies: {
    domainEvents: DomainEventService;
    deliveryPolicy: DeliveryPolicyService;
    adapters?: readonly TransportAdapter[];
    providerRuntime?: ProviderReceiptCaptureService;
  },
): TransportDomainServices {
  const repository = createTransportAttemptRepository(repositories);
  const registry = createTransportAdapterRegistry(
    dependencies.adapters ?? [createInternalTransportAdapter()],
  );
  const retry = createTransportRetryService(dependencies.deliveryPolicy);
  const receipts = createTransportReceiptService();
  const runtime = createTransportRuntimeService(
    repositories,
    repository,
    dependencies.deliveryPolicy,
    retry,
    receipts,
    registry,
    dependencies.domainEvents,
    dependencies.providerRuntime,
  );
  const diagnostics = createTransportDiagnosticsService(repositories, repository, registry);

  return {
    repository,
    registry,
    retry,
    receipts,
    runtime,
    diagnostics,
  };
}
