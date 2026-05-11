import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const ALLOCATOR_LEASE_STATUSES = {
  Active: "active",
  Expired: "expired",
  Released: "released",
} as const;

export type AllocatorLeaseStatus =
  (typeof ALLOCATOR_LEASE_STATUSES)[keyof typeof ALLOCATOR_LEASE_STATUSES];

export interface AllocatorLease {
  id: EntityId;
  allocatorId: string;
  shardId: string;
  leaseOwner: string;
  leaseExpiresAt: IsoDateTimeString;
  lastHeartbeatAt: IsoDateTimeString;
  status: AllocatorLeaseStatus;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
