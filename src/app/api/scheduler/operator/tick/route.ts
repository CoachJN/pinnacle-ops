import { NextRequest } from "next/server";
import {
  createFirestoreSchedulerRepositories,
  createRuntimeSchedulerService,
} from "@/modules/scheduler";
import { createRuntimeCapacityServices } from "@/modules/runtime-capacity";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/scheduler/operator/tick", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const body = await parseJsonObject(request);
    const input = parseTickInput(body);
    const runtimeCapacity = createRuntimeCapacityServices({
      repositories: {
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        deliveryAttempts: context.repositories.deliveryAttempts,
        escalationOrchestrations: context.repositories.escalationOrchestrations,
      },
      providerRuntimeStorage: context.services.providerRuntime.storage,
    });
    const scheduler = createRuntimeSchedulerService(
      createFirestoreSchedulerRepositories(),
      context.services.runtime,
      runtimeCapacity.guardrails,
    );
    const result = await scheduler.tick({
      organizationId: context.actor.scope.organizationId,
      workerId: input.workerId ?? `scheduler:${context.actor.userId}`,
      now: input.now ?? new Date().toISOString(),
      maxTasks: input.maxTasks,
      leaseDurationMs: input.leaseDurationMs,
      dryRun: input.dryRun,
    });
    if (!result.ok) {
      throw result.error;
    }
    return jsonOk({ data: result.value });
  });
}

function parseTickInput(body: Record<string, unknown>): {
  workerId: string | null;
  now: string | null;
  maxTasks: number | undefined;
  leaseDurationMs: number | undefined;
  dryRun: boolean | undefined;
} {
  return {
    workerId: optionalString(body.workerId, "workerId"),
    now: optionalString(body.now, "now"),
    maxTasks: optionalPositiveInteger(body.maxTasks, "maxTasks"),
    leaseDurationMs: optionalPositiveInteger(body.leaseDurationMs, "leaseDurationMs"),
    dryRun: optionalBoolean(body.dryRun, "dryRun"),
  };
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

function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw validationError(`${field} must be a positive integer.`);
  }
  return value;
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
