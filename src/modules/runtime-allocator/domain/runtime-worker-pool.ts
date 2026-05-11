import type { WorkerJob } from "@/modules/runtime";
import type { RuntimeAllocationRecord } from "./runtime-allocation";

export interface RuntimeWorkerPoolAssignment {
  organizationId: string;
  tenantId: string;
  shardId: string;
  jobs: readonly WorkerJob[];
}

export interface RuntimeWorkerPoolResult {
  allocation: RuntimeAllocationRecord;
  assignments: readonly RuntimeWorkerPoolAssignment[];
  skippedShardIds: readonly string[];
}
