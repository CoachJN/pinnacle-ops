import { NextRequest } from "next/server";
import { RUNTIME_REPAIR_ACTION_TYPES, type RuntimeRepairActionType } from "@/modules/operations";
import { createRuntimeOperationsPlatform } from "@/modules/operations/server/runtime-operations-factory";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/operations/runtime/repair", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const body = await parseJsonObject(request);
    const input = parseRepairInput(body);
    const operations = createRuntimeOperationsPlatform(
      {
        domainEvents: context.repositories.domainEvents,
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        runtimeEventProcessings: context.repositories.runtimeEventProcessings,
        deliveryPlans: context.repositories.deliveryPlans,
        deliveryAttempts: context.repositories.deliveryAttempts,
        escalationOrchestrations: context.repositories.escalationOrchestrations,
        slaTimers: context.repositories.slaTimers,
      },
      {
        runtime: context.services.runtime,
        providerRuntime: context.services.providerRuntime,
        delivery: context.services.delivery,
      },
    );
    const result = await operations.repair.execute({
      organizationId: context.actor.scope.organizationId,
      actor: context.audit.actor,
      actionType: input.actionType,
      targetId: input.targetId,
      idempotencyKey: input.idempotencyKey ?? undefined,
      force: input.force,
      reason: input.reason,
      dryRun: input.dryRun,
      now: input.now ?? undefined,
    });
    if (!result.ok) {
      throw result.error;
    }
    return jsonOk({ data: result.value });
  });
}

function parseRepairInput(body: Record<string, unknown>): {
  actionType: RuntimeRepairActionType;
  targetId: string;
  idempotencyKey: string | null;
  force: boolean | undefined;
  reason: string | null;
  dryRun: boolean | undefined;
  now: string | null;
} {
  const actionType = requireString(body.actionType, "actionType");
  if (!Object.values(RUNTIME_REPAIR_ACTION_TYPES).includes(actionType as RuntimeRepairActionType)) {
    throw validationError("actionType is invalid.");
  }
  return {
    actionType: actionType as RuntimeRepairActionType,
    targetId: requireString(body.targetId, "targetId"),
    idempotencyKey: optionalString(body.idempotencyKey, "idempotencyKey"),
    force: optionalBoolean(body.force, "force"),
    reason: optionalString(body.reason, "reason"),
    dryRun: optionalBoolean(body.dryRun, "dryRun"),
    now: optionalString(body.now, "now"),
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw validationError(`${field} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw validationError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw validationError(`${field} must be a boolean.`);
  }
  return value;
}
