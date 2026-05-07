import "server-only";

import { createAccessDeniedError } from "@/server/authorization";
import {
  getWorkOrderApiContext,
  type ApiRequestContext,
  type WorkOrderApiContext,
} from "@/server/api/work-orders";
import { USER_ROLES } from "@/types/permissions";

export async function getProviderRuntimeApiContext(
  requestContext: ApiRequestContext | null = null,
): Promise<WorkOrderApiContext> {
  const context = await getWorkOrderApiContext(requestContext);
  authorizeOperationalRuntimeAccess(context);
  return context;
}

export function authorizeProviderRuntimeAccess(context: WorkOrderApiContext): void {
  authorizeOperationalRuntimeAccess(context);
}

export function authorizeOperationalRuntimeAccess(context: WorkOrderApiContext): void {
  if (context.actor.actorType !== "internal") {
    throw createAccessDeniedError("Only internal users can access operational runtime diagnostics.");
  }

  if (
    context.actor.role !== USER_ROLES.Manager &&
    context.actor.role !== USER_ROLES.FinanceAdmin &&
    context.actor.role !== USER_ROLES.Owner
  ) {
    throw createAccessDeniedError("Only operational runtime admins can access this endpoint.");
  }
}
