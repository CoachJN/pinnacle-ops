import { NextRequest } from "next/server";
import { getProviderRuntimeApiContext } from "@/server/api/provider-runtime";
import { jsonOk, parseJsonObject, withApiRoute } from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/provider-runtime/operator/reconcile", async (requestContext) => {
    const context = await getProviderRuntimeApiContext(requestContext);
    const body = await parseJsonObject(request);
    const input = parseInput(body);
    const now = input.now ?? new Date().toISOString();

    if (input.receiptId) {
      const reconciled = await context.services.providerRuntime.reconciliation.reconcileReceipt({
        organizationId: context.actor.scope.organizationId,
        receiptId: input.receiptId,
        now,
      });
      if (!reconciled.ok) {
        throw reconciled.error;
      }
      return jsonOk({ data: { processed: 1, results: [reconciled.value] } });
    }

    const receipts = await context.services.providerRuntime.storage.receipts.listByOrganizationId({
      organizationId: context.actor.scope.organizationId,
      limit: input.limit,
      reconciliationStatus: "pending",
    });
    const results = [];
    for (const receipt of receipts) {
      const reconciled = await context.services.providerRuntime.reconciliation.reconcileReceipt({
        organizationId: context.actor.scope.organizationId,
        receiptId: receipt.id,
        now,
      });
      if (reconciled.ok) {
        results.push(reconciled.value);
      }
    }

    return jsonOk({
      data: {
        processed: results.length,
        results,
      },
    });
  });
}

function parseInput(body: Record<string, unknown>): {
  receiptId: string | null;
  limit: number;
  now: string | null;
} {
  const receiptId = optionalString(body.receiptId, "receiptId");
  const limit = optionalPositiveInteger(body.limit, "limit") ?? 25;
  const now = optionalString(body.now, "now");
  return {
    receiptId,
    limit,
    now,
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
