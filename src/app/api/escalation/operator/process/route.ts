import { NextRequest } from "next/server";
import { createRuntimeOperatorContext, getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/escalation/operator/process", async (requestContext) => {
    const baseContext = await getRuntimeApiContext(requestContext);
    const context = createRuntimeOperatorContext(baseContext);
    const body = await parseJsonObject(request);
    const input = parseProcessInput(body, requestContext.requestId);

    const result = await context.operator.processJobs({
      organizationId: context.actor.scope.organizationId,
      services: context.services,
      workerId: input.workerId,
      now: input.now,
      maxJobs: input.maxJobs,
      leaseDurationMs: input.leaseDurationMs,
      heartbeatIntervalMs: input.heartbeatIntervalMs,
      jobTypes: ["escalation.progress"],
      dryRun: input.dryRun,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({ data: result.value });
  });
}

function parseProcessInput(
  body: Record<string, unknown>,
  requestId: string,
): {
  workerId: string;
  now?: string;
  maxJobs?: number;
  leaseDurationMs?: number;
  heartbeatIntervalMs?: number | null;
  dryRun?: boolean;
} {
  return {
    workerId: optionalString(body.workerId, "workerId") ?? `escalation-operator:${requestId}`,
    now: optionalString(body.now, "now") ?? undefined,
    maxJobs: optionalPositiveInteger(body.maxJobs, "maxJobs"),
    leaseDurationMs: optionalPositiveInteger(body.leaseDurationMs, "leaseDurationMs"),
    heartbeatIntervalMs: optionalNullablePositiveInteger(body.heartbeatIntervalMs, "heartbeatIntervalMs"),
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

function optionalNullablePositiveInteger(value: unknown, field: string): number | null | undefined {
  if (value === undefined || value === null) {
    return value as null | undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw validationError(`${field} must be a positive integer or null.`);
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
