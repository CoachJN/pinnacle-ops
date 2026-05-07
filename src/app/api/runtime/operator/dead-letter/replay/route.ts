import { NextRequest } from "next/server";
import { createRuntimeOperatorContext, getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/runtime/operator/dead-letter/replay", async (requestContext) => {
    const baseContext = await getRuntimeApiContext(requestContext);
    const context = createRuntimeOperatorContext(baseContext);
    const body = await parseJsonObject(request);
    const input = parseReplayDeadLetterInput(body);

    const result = await context.operator.replayDeadLetter({
      organizationId: context.actor.scope.organizationId,
      deadLetterId: input.deadLetterId,
      actor: context.audit.actor,
      force: input.force,
      now: input.now,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: {
        job: result.value,
      },
    });
  });
}

function parseReplayDeadLetterInput(body: Record<string, unknown>) {
  const deadLetterId = optionalString(body.deadLetterId, "deadLetterId");
  if (!deadLetterId) {
    throw validationError("deadLetterId is required.");
  }

  return {
    deadLetterId,
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
