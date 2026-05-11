import assert from "node:assert/strict";
import test from "node:test";

import {
  createAllocatorLeaseService,
  createRuntimeAllocatorService,
  createSharedWorkerPoolService,
} from "@/modules/runtime-allocator";
import { createRuntimeHarness } from "@/tests/support/runtime-harness.ts";
import {
  createInMemoryAllocatorGlobalRepository,
  createInMemoryAllocatorLeaseRepository,
  createInMemoryRuntimeAllocationRepository,
  createProviderReceipt,
} from "@/tests/support/runtime-allocator-test-utils.ts";

test("shared worker pool claims work fairly and isolates replay-heavy provider pressure", async () => {
  const harness = createRuntimeHarness();
  const now = "2026-05-07T12:05:00.000Z";

  await harness.runtime.jobs.enqueue({
    actor: { userId: "user-1", role: "system" },
    organizationId: "tenant-a",
    tenantId: "tenant-a",
    type: "runtime.standard",
    payload: {},
    payloadVersion: "v1",
    idempotencyKey: "tenant-a-1",
    correlationId: "corr-a-1",
    causationId: "cause-a-1",
    now,
  });
  await harness.runtime.jobs.enqueue({
    actor: { userId: "user-1", role: "system" },
    organizationId: "tenant-a",
    tenantId: "tenant-a",
    type: "runtime.standard",
    payload: {},
    payloadVersion: "v1",
    idempotencyKey: "tenant-a-2",
    correlationId: "corr-a-2",
    causationId: "cause-a-2",
    now,
  });
  await harness.runtime.jobs.enqueue({
    actor: { userId: "user-1", role: "system" },
    organizationId: "tenant-b",
    tenantId: "tenant-b",
    type: "runtime.replay",
    payload: {},
    payloadVersion: "v1",
    idempotencyKey: "tenant-b-1",
    correlationId: "corr-b-1",
    causationId: "cause-b-1",
    now,
  });
  await harness.runtime.jobs.enqueue({
    actor: { userId: "user-1", role: "system" },
    organizationId: "tenant-b",
    tenantId: "tenant-b",
    type: "runtime.replay",
    payload: {},
    payloadVersion: "v1",
    idempotencyKey: "tenant-b-2",
    correlationId: "corr-b-2",
    causationId: "cause-b-2",
    now,
  });
  harness.providerReceipts.push(
    createProviderReceipt({
      id: "receipt-b-1",
      organizationId: "tenant-b",
      normalizedStatus: "failed",
      reconciliationStatus: "pending",
      receivedAt: "2026-05-07T12:04:50.000Z",
    }),
    createProviderReceipt({
      id: "receipt-b-2",
      organizationId: "tenant-b",
      normalizedStatus: "failed",
      reconciliationStatus: "pending",
      receivedAt: "2026-05-07T12:04:51.000Z",
    }),
    createProviderReceipt({
      id: "receipt-b-3",
      organizationId: "tenant-b",
      normalizedStatus: "failed",
      reconciliationStatus: "pending",
      receivedAt: "2026-05-07T12:04:52.000Z",
    }),
    createProviderReceipt({
      id: "receipt-b-4",
      organizationId: "tenant-b",
      normalizedStatus: "failed",
      reconciliationStatus: "pending",
      receivedAt: "2026-05-07T12:04:53.000Z",
    }),
    createProviderReceipt({
      id: "receipt-b-5",
      organizationId: "tenant-b",
      normalizedStatus: "failed",
      reconciliationStatus: "pending",
      receivedAt: "2026-05-07T12:04:54.000Z",
    }),
  );

  const allocator = createRuntimeAllocatorService(
    createInMemoryAllocatorGlobalRepository(harness.jobs, harness.providerReceipts),
  );
  const workerPool = createSharedWorkerPoolService(
    allocator,
    createAllocatorLeaseService(createInMemoryAllocatorLeaseRepository()),
    createInMemoryRuntimeAllocationRepository(),
    harness.runtime,
  );

  const result = await workerPool.coordinate({
    allocatorId: "allocator-a",
    leaseOwner: "owner-a",
    workerPoolId: "pool-a",
    workerId: "worker-a",
    now,
    shardCount: 1,
    totalCapacity: 2,
  });

  assert.equal(result.allocation.grantedCapacity, 2);
  assert.equal(result.assignments.find((item) => item.tenantId === "tenant-a")?.jobs.length, 1);
  assert.equal(result.assignments.find((item) => item.tenantId === "tenant-b")?.jobs.length, 1);
  assert.equal(
    result.allocation.decisions.find((item) => item.tenantId === "tenant-b")?.replayStormIsolated,
    true,
  );
});
