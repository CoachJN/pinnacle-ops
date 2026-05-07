import { NextRequest } from "next/server";
import { getProviderRuntimeApiContext } from "@/server/api/provider-runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/providers/replay", async (requestContext) => {
    const context = await getProviderRuntimeApiContext(requestContext);
    const body = await request.json() as {
      receiptId?: string | null;
      providerMessageId?: string | null;
      providerThreadId?: string | null;
      connectionId?: string | null;
      mode?: "replay" | "retry_failed";
    };

    const result = body.receiptId
      ? body.mode === "retry_failed"
        ? await context.services.providers.replay.retryFailedIngestion({
            organizationId: context.actor.scope.organizationId,
            actor: context.audit.actor,
            receiptId: body.receiptId,
          })
        : await context.services.providers.replay.replayByReceiptId({
            organizationId: context.actor.scope.organizationId,
            actor: context.audit.actor,
            receiptId: body.receiptId,
          })
      : body.providerMessageId
        ? await context.services.providers.replay.replayMessageByProviderMessageId({
            organizationId: context.actor.scope.organizationId,
            actor: context.audit.actor,
            providerMessageId: body.providerMessageId,
          })
        : await context.services.providers.replay.replayThread({
            organizationId: context.actor.scope.organizationId,
            actor: context.audit.actor,
            connectionId: body.connectionId ?? null,
            providerThreadId: body.providerThreadId ?? "",
          });

    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: {
        result: result.value,
      },
    });
  });
}
