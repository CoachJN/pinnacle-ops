export interface RuntimeShardTenantAssignment {
  organizationId: string;
  tenantId: string;
  queuedReadyJobs: number;
  queuedJobs: number;
  activeJobs: number;
  replayQueuedJobs: number;
  retryableFailuresInWindow: number;
  providerPressureLevel: "normal" | "throttled" | "isolated";
}

export interface RuntimeShard {
  id: string;
  ordinal: number;
  tenantCount: number;
  queuedReadyJobs: number;
  queuedJobs: number;
  activeJobs: number;
  replayQueuedJobs: number;
  providerIsolatedTenantCount: number;
  tenants: readonly RuntimeShardTenantAssignment[];
}
