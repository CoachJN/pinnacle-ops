import { NextRequest } from "next/server";
import { RUNTIME_LOOP_TYPES, type RuntimeLoopType } from "@/modules/runtime-loops";
import { createRuntimeLoopRuntime } from "@/modules/runtime-loops/server/runtime-loop-runtime";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { validationError } from "@/server/services/errors";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/runtime-loops/drain", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const runtimeLoops = createRuntimeLoopRuntime(context);
    const body = await parseJsonObject(request);
    const input = parseDrainInput(body);
    const now = input.now ?? new Date().toISOString();
    const state =
      input.action === "release"
        ? await runtimeLoops.services.drain.releaseDrain({
            organizationId: context.actor.scope.organizationId,
            loopTypes: input.loopTypes,
            now,
          })
        : await runtimeLoops.services.drain.requestDrain({
            organizationId: context.actor.scope.organizationId,
            loopTypes: input.loopTypes,
            reason: input.reason,
            now,
            drainWindowMs: input.drainWindowMs ?? 120_000,
          });
    return jsonOk({ data: state });
  });
}

function parseDrainInput(body: Record<string, unknown>): {
  action: "request" | "release";
  loopTypes?: readonly RuntimeLoopType[];
  reason?: string | null;
  drainWindowMs?: number;
  now?: string;
} {
  const action = body.action;
  if (action !== undefined && action !== "request" && action !== "release") {
    throw validationError("action must be 'request' or 'release'.");
  }
  return {
    action: action === "release" ? "release" : "request",
    loopTypes: optionalLoopTypes(body.loopTypes),
    reason: optionalString(body.reason, "reason"),
    drainWindowMs: optionalPositiveInteger(body.drainWindowMs, "drainWindowMs"),
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

function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw validationError(`${field} must be a positive integer.`);
  }
  return value;
}
