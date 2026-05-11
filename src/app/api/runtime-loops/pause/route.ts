import { NextRequest } from "next/server";
import { RUNTIME_LOOP_TYPES, type RuntimeLoopType } from "@/modules/runtime-loops";
import { createRuntimeLoopRuntime } from "@/modules/runtime-loops/server/runtime-loop-runtime";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { validationError } from "@/server/services/errors";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/runtime-loops/pause", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const runtimeLoops = createRuntimeLoopRuntime(context);
    const body = await parseJsonObject(request);
    const input = parsePauseInput(body);
    const now = input.now ?? new Date().toISOString();
    const state =
      input.action === "resume"
        ? await runtimeLoops.services.drain.resume({
            organizationId: context.actor.scope.organizationId,
            loopTypes: input.loopTypes,
            now,
          })
        : await runtimeLoops.services.drain.pause({
            organizationId: context.actor.scope.organizationId,
            loopTypes: input.loopTypes,
            reason: input.reason,
            now,
          });
    return jsonOk({ data: state });
  });
}

function parsePauseInput(body: Record<string, unknown>): {
  action: "pause" | "resume";
  loopTypes?: readonly RuntimeLoopType[];
  reason?: string | null;
  now?: string;
} {
  const action = body.action;
  if (action !== undefined && action !== "pause" && action !== "resume") {
    throw validationError("action must be 'pause' or 'resume'.");
  }
  return {
    action: action === "resume" ? "resume" : "pause",
    loopTypes: optionalLoopTypes(body.loopTypes),
    reason: optionalString(body.reason, "reason"),
    now: optionalString(body.now, "now") ?? undefined,
  };
}

function optionalLoopTypes(value: unknown): readonly RuntimeLoopType[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw validationError("loopTypes must be an array.");
  }
  const allowed = new Set(Object.values(RUNTIME_LOOP_TYPES));
  return value.map((entry) => {
    if (typeof entry !== "string" || !allowed.has(entry as RuntimeLoopType)) {
      throw validationError("loopTypes contains an unsupported loop type.");
    }
    return entry as RuntimeLoopType;
  });
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw validationError(`${field} must be a string.`);
  }
  return value.trim() || null;
}
