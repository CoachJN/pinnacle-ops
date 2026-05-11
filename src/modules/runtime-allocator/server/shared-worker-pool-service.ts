import "server-only";

import { RUNTIME_ALLOCATION_STATUSES, type RuntimeAllocationRecord } from "../domain/runtime-allocation";
import type { RuntimeWorkerPoolAssignment, RuntimeWorkerPoolResult } from "../domain/runtime-worker-pool";
import type { RuntimeDomainServices } from "@/modules/runtime/server/worker-runtime-service";
import type { WorkerJob } from "@/modules/runtime";
import type { AllocatorLeaseService } from "./allocator-lease-service";
import type { RuntimeAllocationRepository } from "./runtime-allocator-repository";
import type { RuntimeAllocatorService } from "./runtime-allocator-service";

export interface SharedWorkerPoolService {
  coordinate(input: {
    allocatorId: string;
    leaseOwner: string;
    workerPoolId: string;
    workerId: string;
    now: string;
    shardCount: number;
    totalCapacity: number;
    leaseDurationMs?: number;
    dryRun?: boolean;
  }): Promise<RuntimeWorkerPoolResult>;
}

export function createSharedWorkerPoolService(
  allocator: RuntimeAllocatorService,
  leaseService: AllocatorLeaseService,
  allocationRepository: RuntimeAllocationRepository,
  runtime: Pick<RuntimeDomainServices, "lease">,
): SharedWorkerPoolService {
  return {
    async coordinate(input) {
      const plan = await allocator.inspect({
        now: input.now,
        shardCount: input.shardCount,
        totalCapacity: input.totalCapacity,
      });
      const assignments: RuntimeWorkerPoolAssignment[] = [];
      const skippedShardIds: string[] = [];
      let finalAllocation: RuntimeAllocationRecord | null = null;

      for (const shard of plan.shardPlans) {
        const leaseResult = await leaseService.claimShard({
          allocatorId: input.allocatorId,
          shardId: shard.shardId,
          leaseOwner: input.leaseOwner,
          now: input.now,
          leaseDurationMs: input.leaseDurationMs,
        });
        if (!leaseResult.acquired) {
          skippedShardIds.push(shard.shardId);
          continue;
        }

        const allocationKey = [
          input.allocatorId,
          input.workerPoolId,
          input.workerId,
          shard.window.id,
        ].join(":");
        const existing = await allocationRepository.findByAllocationKey(allocationKey);
        if (existing) {
          finalAllocation = existing;
          continue;
        }

        const shardAssignments: RuntimeWorkerPoolAssignment[] = [];
        const claimedJobIds: string[] = [];
        for (const decision of shard.decisions.filter((item) => item.grantedClaims > 0)) {
          const claimedJobs: WorkerJob[] = [];
          if (!input.dryRun && decision.organizationId === decision.tenantId) {
            for (let index = 0; index < decision.grantedClaims; index += 1) {
              const claim = await runtime.lease.claimNext({
                organizationId: decision.organizationId,
                workerId: input.workerId,
                leaseDurationMs: input.leaseDurationMs ?? 60_000,
                now: input.now,
              });
              if (!claim.ok || !claim.value) {
                break;
              }
              claimedJobs.push(claim.value);
              claimedJobIds.push(claim.value.id);
            }
          }
          shardAssignments.push({
            organizationId: decision.organizationId,
            tenantId: decision.tenantId,
            shardId: decision.shardId,
            jobs: claimedJobs,
          });
        }

        assignments.push(...shardAssignments);
        const grantedCapacity = shard.decisions.reduce((sum, decision) => sum + decision.grantedClaims, 0);
        const claimedCapacity = shardAssignments.reduce((sum, assignment) => sum + assignment.jobs.length, 0);
        finalAllocation = {
          id: allocationRepository.newAllocationId(),
          allocationKey,
          allocatorId: input.allocatorId,
          shardId: shard.shardId,
          workerPoolId: input.workerPoolId,
          workerId: input.workerId,
          status: input.dryRun ? RUNTIME_ALLOCATION_STATUSES.Planned : RUNTIME_ALLOCATION_STATUSES.Claimed,
          windowStartedAt: shard.window.startedAt,
          windowEndsAt: shard.window.endsAt,
          totalCapacity: shard.window.totalCapacity,
          grantedCapacity,
          claimedCapacity,
          decisions: shard.decisions,
          claimedJobIds,
          createdAt: input.now,
          updatedAt: input.now,
        };
        await allocationRepository.saveAllocation(finalAllocation);
      }

      return {
        allocation:
          finalAllocation ??
          {
            id: allocationRepository.newAllocationId(),
            allocationKey: `${input.allocatorId}:${input.workerPoolId}:${input.workerId}:${input.now}`,
            allocatorId: input.allocatorId,
            shardId: "none",
            workerPoolId: input.workerPoolId,
            workerId: input.workerId,
            status: RUNTIME_ALLOCATION_STATUSES.Planned,
            windowStartedAt: input.now,
            windowEndsAt: input.now,
            totalCapacity: input.totalCapacity,
            grantedCapacity: 0,
            claimedCapacity: 0,
            decisions: [],
            claimedJobIds: [],
            createdAt: input.now,
            updatedAt: input.now,
          },
        assignments,
        skippedShardIds,
      };
    },
  };
}
