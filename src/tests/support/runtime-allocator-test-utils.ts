import type { ProviderReceipt } from "@/modules/provider-runtime";
import type { WorkerJob } from "@/modules/runtime";
import type { AllocatorLease } from "@/modules/runtime-allocator";
import type { RuntimeAllocationRecord } from "@/modules/runtime-allocator";
import type {
  RuntimeAllocationRepository,
  RuntimeAllocatorGlobalRepository,
  RuntimeAllocatorLeaseRepository,
} from "@/modules/runtime-allocator";

export function createInMemoryAllocatorGlobalRepository(
  jobs: WorkerJob[],
  receipts: ProviderReceipt[] = [],
): RuntimeAllocatorGlobalRepository {
  return {
    async listRuntimeJobs(input = {}) {
      return jobs
        .filter((job) => (input.statuses?.length ? input.statuses.includes(job.status) : true))
        .slice(0, input.limit ?? jobs.length);
    },
    async listProviderReceipts(input = {}) {
      return receipts.slice(0, input.limit ?? receipts.length);
    },
  };
}

export function createInMemoryAllocatorLeaseRepository(
  store: AllocatorLease[] = [],
): RuntimeAllocatorLeaseRepository {
  return {
    newLeaseId() {
      return `allocator-lease-${store.length + 1}`;
    },
    async getLeaseByShardId(shardId) {
      return store.find((lease) => lease.shardId === shardId) ?? null;
    },
    async listLeases() {
      return [...store].sort((left, right) => left.shardId.localeCompare(right.shardId));
    },
    async saveLease(lease) {
      const index = store.findIndex((item) => item.id === lease.id);
      if (index >= 0) {
        store[index] = lease;
      } else {
        store.push(lease);
      }
      return lease;
    },
  };
}

export function createInMemoryRuntimeAllocationRepository(
  store: RuntimeAllocationRecord[] = [],
): RuntimeAllocationRepository {
  return {
    newAllocationId() {
      return `runtime-allocation-${store.length + 1}`;
    },
    async findByAllocationKey(allocationKey) {
      return store.find((record) => record.allocationKey === allocationKey) ?? null;
    },
    async listRecentAllocations(input = {}) {
      return [...store]
        .sort((left, right) => right.windowStartedAt.localeCompare(left.windowStartedAt))
        .slice(0, input.limit ?? store.length);
    },
    async saveAllocation(record) {
      const index = store.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        store[index] = record;
      } else {
        store.push(record);
      }
      return record;
    },
  };
}

export function createWorkerJob(input: {
  id: string;
  organizationId: string;
  tenantId?: string;
  type?: string;
  status?: WorkerJob["status"];
  runAfter?: string;
  createdAt?: string;
  updatedAt?: string;
  lastError?: WorkerJob["lastError"];
}): WorkerJob {
  const timestamp = input.createdAt ?? input.runAfter ?? "2026-05-07T12:00:00.000Z";
  return {
    id: input.id,
    organizationId: input.organizationId,
    tenantId: input.tenantId ?? input.organizationId,
    type: input.type ?? "runtime.test",
    status: input.status ?? "queued",
    payload: {},
    payloadVersion: "v1",
    idempotencyKey: `idem-${input.id}`,
    correlationId: `corr-${input.id}`,
    causationId: `cause-${input.id}`,
    sourceEventId: null,
    attemptCount: 0,
    maxAttempts: 5,
    runAfter: input.runAfter ?? timestamp,
    leasedBy: null,
    leaseExpiresAt: null,
    lease: {
      workerId: null,
      claimToken: null,
      leaseVersion: 0,
      claimedAt: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      reclaimedAt: null,
      reclaimedBy: null,
      reclaimCount: 0,
    },
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
    lastError: input.lastError ?? null,
    completedAt: null,
  };
}

export function createProviderReceipt(input: {
  id: string;
  organizationId: string;
  tenantId?: string;
  providerType?: ProviderReceipt["providerType"];
  normalizedStatus?: ProviderReceipt["normalizedStatus"];
  reconciliationStatus?: ProviderReceipt["reconciliationStatus"];
  receivedAt?: string;
}): ProviderReceipt {
  const receivedAt = input.receivedAt ?? "2026-05-07T12:00:00.000Z";
  return {
    id: input.id,
    organizationId: input.organizationId,
    tenantId: input.tenantId ?? input.organizationId,
    providerType: input.providerType ?? "microsoft_graph_email",
    providerEventType: "message.delivered",
    providerMessageId: `provider-message-${input.id}`,
    providerCorrelationId: `provider-correlation-${input.id}`,
    providerReceiptId: `provider-receipt-${input.id}`,
    deliveryAttemptId: null,
    deliveryPlanId: null,
    sourceWebhookEventId: null,
    correlationId: `corr-${input.id}`,
    causationId: `cause-${input.id}`,
    idempotencyKey: `idem-${input.id}`,
    normalizedStatus: input.normalizedStatus ?? "delivered",
    rawStatus: null,
    receivedAt,
    processedAt: receivedAt,
    reconciliationStatus: input.reconciliationStatus ?? "processed",
    reconciliationReason: null,
    createdAt: receivedAt,
    updatedAt: receivedAt,
    metadata: {},
  };
}
