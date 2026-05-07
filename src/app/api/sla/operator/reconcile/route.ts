import { NextRequest } from "next/server";
import { createSlaRuntimeOperatorService } from "@/modules/sla";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/sla/operator/reconcile", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const body = await parseJsonObject(request);
    const input = parseReconcileInput(body);
    const operator = createSlaRuntimeOperatorService({
      repositories: {
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        slaTimers: context.repositories.slaTimers,
        slaScanCursors: context.repositories.slaScanCursors,
      },
      services: {
        runtime: context.services.runtime,
        sla: context.services.sla,
      },
    });

    const result = await operator.reconcileTimers({
      organizationId: context.actor.scope.organizationId,
      dueBefore: input.dueBefore ?? new Date().toISOString(),
      limit: input.limit ?? 100,
      timerType: input.timerType,
      timerIds: input.timerIds,
      now: input.now,
      audit: context.audit,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({ data: result.value });
  });
}

function parseReconcileInput(body: Record<string, unknown>): {
  dueBefore?: string;
  limit?: number;
  timerType?: string;
  timerIds?: readonly string[];
  now?: string;
} {
  return {
    dueBefore: optionalString(body.dueBefore, "dueBefore") ?? undefined,
    limit: optionalPositiveInteger(body.limit, "limit"),
    timerType: optionalString(body.timerType, "timerType") ?? undefined,
    timerIds: optionalStringArray(body.timerIds, "timerIds"),
    now: optionalString(body.now, "now") ?? undefined,
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

function optionalStringArray(value: unknown, field: string): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw validationError(`${field} must be an array of strings.`);
  }
  return value.map((entry) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw validationError(`${field} must contain only non-empty strings.`);
    }
    return entry.trim();
  });
}
