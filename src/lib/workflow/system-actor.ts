import type { WorkOrderRepositoryActor } from "../work-orders/repository.ts";

export const SYSTEM_WORKFLOW_ACTOR = {
  name: "System",
  role: "system",
} as const satisfies WorkOrderRepositoryActor;
