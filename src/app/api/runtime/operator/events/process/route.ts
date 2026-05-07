import { NextRequest } from "next/server";
import { createRuntimeOperatorContext, getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/runtime/operator/events/process", async (requestContext) => {
    const baseContext = await getRuntimeApiContext(requestContext);
    const context = createRuntimeOperatorContext(baseContext);
    const body = await parseJsonObject(request);
    const input = parseProcessEventsInput(body);

    const result = await context.operator.processEvents({
      organizationId: context.actor.scope.organizationId,
      eventId: input.eventId,
      batchSize: input.batchSize,
      force: input.force,
      now: input.now,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: {
        results: result.value,
      },
    });
  });
}

function parseProcessEventsInput(body: Record<string, unknown>) {
  return {
    eventId: optionalString(body.eventId, "eventId"),
    batchSize: optionalPositiveInteger(body.batchSize, "batchSize"),
    force: optionalBoolean(body.force, "force"),
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

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw validationError(`${field} must be a boolean.`);
  }
  return value;
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
