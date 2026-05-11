import "server-only";

import { createRuntimeCapacityServices, type RuntimeCapacityGuardrailService } from "@/modules/runtime-capacity";
import type { RuntimeClaimDecision } from "../domain/runtime-claim-decision";
import {
  RUNTIME_CLAIM_WINDOW_STATUSES,
  type RuntimeClaimWindow,
} from "../domain/runtime-claim-window";
import type { RuntimeClaimSourceRepository, RuntimeClaimWindowRepository } from "./runtime-claim-repository";
import type { WorkerLeaseService } from "@/modules/runtime/server/worker-lease-service";
import type { FirestoreRepositories } from "@/server/repositories";

export interface RuntimeClaimService {
  materializeDecision(input: {
    allocatorId: string;
    workerPoolId: string;
    workerId: string;
    decision: RuntimeClaimDecision;
    now: string;
    leaseDurationMs: number;
  }): Promise<RuntimeClaimWindow>;
}

export function createRuntimeClaimService(
  repository: RuntimeClaimWindowRepository & RuntimeClaimSourceRepository,
  runtimeLease: Pick<WorkerLeaseService, "claimById">,
  guardrails: Pick<RuntimeCapacityGuardrailService, "getClaimBudget">,
): RuntimeClaimService {
  return {
    async materializeDecision(input) {
      const windowKey = [
        input.allocatorId,
        input.workerPoolId,
        input.decision.allocatorWindowId,
        input.decision.shardId,
        input.decision.tenantId,
      ].join(":");
      const existing = await repository.findByWindowKey(windowKey);
      if (existing) {
        return existing;
      }

      const claimBudget = await guardrails.getClaimBudget({
        organizationId: input.decision.organizationId,
        tenantId: input.decision.tenantId,
        now: input.now,
        requestedJobs: input.decision.grantedClaims,
      });
      const maxClaims = Math.min(input.decision.grantedClaims, claimBudget.allowedMaxJobs);
      const eligibleJobs = (await repository.listRuntimeJobs({
        limit: Math.max(25, input.decision.grantedClaims * 8),
        statuses: ["queued", "leased", "running"],
      }))
        .filter((job) => job.organizationId === input.decision.organizationId)
        .filter((job) => job.tenantId === input.decision.tenantId)
        .filter((job) => isClaimable(job, input.now))
        .sort(compareClaimableJobs);

      const claimedJobs: Array<RuntimeClaimWindow["claimedJobs"][number]> = [];
      for (const job of eligibleJobs.slice(0, maxClaims)) {
        const claimed = await runtimeLease.claimById({
          organizationId: job.organizationId,
          tenantId: job.tenantId,
          jobId: job.id,
          workerId: input.workerId,
          leaseDurationMs: input.leaseDurationMs,
          now: input.now,
        });
        if (!claimed.ok || !claimed.value) {
          continue;
        }
        claimedJobs.push({
          id: claimed.value.id,
          type: claimed.value.type,
          status: claimed.value.status,
          runAfter: claimed.value.runAfter,
          attemptCount: claimed.value.attemptCount,
        });
      }

      const window: RuntimeClaimWindow = {
        id: repository.newWindowId(),
        windowKey,
        allocatorId: input.allocatorId,
        allocatorWindowId: input.decision.allocatorWindowId,
        shardId: input.decision.shardId,
        workerPoolId: input.workerPoolId,
        workerId: input.workerId,
        tenantId: input.decision.tenantId,
        organizationId: input.decision.organizationId,
        status: claimedJobs.length > 0
          ? RUNTIME_CLAIM_WINDOW_STATUSES.Materialized
          : RUNTIME_CLAIM_WINDOW_STATUSES.Noop,
        decision: input.decision,
        plannedClaims: input.decision.grantedClaims,
        claimedCount: claimedJobs.length,
        noopCount: Math.max(0, input.decision.grantedClaims - claimedJobs.length),
        skippedCount: Math.max(0, eligibleJobs.length - maxClaims),
        claimedJobIds: claimedJobs.map((job) => job.id),
        claimedJobs,
        createdAt: input.now,
        updatedAt: input.now,
      };
      return repository.saveWindow(window);
    },
  };
}

export function createRuntimeClaimGuardrails(
  repositories: Pick<
    FirestoreRepositories,
    "runtimeJobs" | "runtimeDeadLetters" | "deliveryAttempts" | "escalationOrchestrations"
  >,
  providerRuntimeStorage: {
    receipts: { listByOrganizationId(input: { organizationId: string; limit: number }): Promise<readonly { tenantId: string; receivedAt: string }[]> };
  },
) {
  return createRuntimeCapacityServices({
    repositories,
    providerRuntimeStorage: providerRuntimeStorage as never,
  }).guardrails;
}

function isClaimable(
  job: Awaited<ReturnType<RuntimeClaimSourceRepository["listRuntimeJobs"]>>[number],
  now: string,
): boolean {
  if (job.status === "queued") {
    return job.runAfter <= now;
  }
  return (job.status === "leased" || job.status === "running") && job.leaseExpiresAt !== null && job.leaseExpiresAt <= now;
}

function compareClaimableJobs(
  left: Awaited<ReturnType<RuntimeClaimSourceRepository["listRuntimeJobs"]>>[number],
  right: Awaited<ReturnType<RuntimeClaimSourceRepository["listRuntimeJobs"]>>[number],
): number {
  const leftTime = left.status === "queued" ? left.runAfter : left.leaseExpiresAt ?? left.runAfter;
  const rightTime = right.status === "queued" ? right.runAfter : right.leaseExpiresAt ?? right.runAfter;
  if (leftTime !== rightTime) {
    return leftTime.localeCompare(rightTime);
  }
  return left.id.localeCompare(right.id);
}
