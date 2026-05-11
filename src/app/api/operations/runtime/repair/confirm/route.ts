import { NextRequest } from "next/server";
import { createRuntimeOperationsPlatform } from "@/modules/operations/server/runtime-operations-factory";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/operations/runtime/repair/confirm", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const body = await parseJsonObject(request);
    const input = parseConfirmInput(body);
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

    const result = await operations.repair.confirm({
      organizationId: context.actor.scope.organizationId,
      actor: context.audit.actor,
      confirmationId: input.confirmationId,
      reason: input.reason,
      now: input.now ?? undefined,
    });
    if (!result.ok) {
      throw result.error;
    }
    return jsonOk({ data: result.value });
  });
}

function parseConfirmInput(body: Record<string, unknown>): {
  confirmationId: string;
  reason: string | null;
  now: string | null;
} {
  return {
    confirmationId: requireString(body.confirmationId, "confirmationId"),
    reason: optionalString(body.reason, "reason"),
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
