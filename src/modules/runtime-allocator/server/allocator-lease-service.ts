import "server-only";

import { ALLOCATOR_LEASE_STATUSES, type AllocatorLease } from "../domain/allocator-lease";
import type { RuntimeAllocatorLeaseRepository } from "./runtime-allocator-repository";

export interface AllocatorLeaseService {
  claimShard(input: {
    allocatorId: string;
    shardId: string;
    leaseOwner: string;
    now: string;
    leaseDurationMs?: number;
  }): Promise<{ acquired: boolean; lease: AllocatorLease; recovered: boolean }>;
  heartbeat(input: {
    allocatorId: string;
    shardId: string;
    leaseOwner: string;
    now: string;
    leaseDurationMs?: number;
  }): Promise<AllocatorLease>;
  listLeases(input?: { now?: string }): Promise<AllocatorLease[]>;
}

export function createAllocatorLeaseService(
  repository: RuntimeAllocatorLeaseRepository,
): AllocatorLeaseService {
  return {
    async claimShard(input) {
      const existing = await repository.getLeaseByShardId(input.shardId);
      if (
        existing &&
        existing.status === ALLOCATOR_LEASE_STATUSES.Active &&
        existing.leaseExpiresAt > input.now &&
        (existing.allocatorId !== input.allocatorId || existing.leaseOwner !== input.leaseOwner)
      ) {
        return { acquired: false, lease: existing, recovered: false };
      }

      const recovered = Boolean(existing && existing.leaseExpiresAt <= input.now);
      const lease = buildLease(
        existing?.id ?? repository.newLeaseId(),
        input.allocatorId,
        input.shardId,
        input.leaseOwner,
        input.now,
        input.leaseDurationMs ?? 60_000,
        existing?.createdAt ?? input.now,
      );
      await repository.saveLease(lease);
      return { acquired: true, lease, recovered };
    },
    async heartbeat(input) {
      const current = await repository.getLeaseByShardId(input.shardId);
      if (!current) {
        const created = buildLease(
          repository.newLeaseId(),
          input.allocatorId,
          input.shardId,
          input.leaseOwner,
          input.now,
          input.leaseDurationMs ?? 60_000,
          input.now,
        );
        await repository.saveLease(created);
        return created;
      }

      const renewed = buildLease(
        current.id,
        input.allocatorId,
        input.shardId,
        input.leaseOwner,
        input.now,
        input.leaseDurationMs ?? 60_000,
        current.createdAt,
      );
      await repository.saveLease(renewed);
      return renewed;
    },
    async listLeases(input) {
      const leases = await repository.listLeases();
      const now = input?.now;
      return leases.map((lease) =>
        now && lease.status === ALLOCATOR_LEASE_STATUSES.Active && lease.leaseExpiresAt <= now
          ? { ...lease, status: ALLOCATOR_LEASE_STATUSES.Expired }
          : lease,
      );
    },
  };
}

function buildLease(
  id: string,
  allocatorId: string,
  shardId: string,
  leaseOwner: string,
  now: string,
  leaseDurationMs: number,
  createdAt: string,
): AllocatorLease {
  return {
    id,
    allocatorId,
    shardId,
    leaseOwner,
    leaseExpiresAt: new Date(Date.parse(now) + leaseDurationMs).toISOString(),
    lastHeartbeatAt: now,
    status: ALLOCATOR_LEASE_STATUSES.Active,
    createdAt,
    updatedAt: now,
  };
}
