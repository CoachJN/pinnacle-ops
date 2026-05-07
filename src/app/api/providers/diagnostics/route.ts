import { NextRequest } from "next/server";
import { getProviderRuntimeApiContext } from "@/server/api/provider-runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/providers/diagnostics", async (requestContext) => {
    const context = await getProviderRuntimeApiContext(requestContext);
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() || null;
    const receiptId = request.nextUrl.searchParams.get("receiptId")?.trim() || null;
    const providerMessageId = request.nextUrl.searchParams.get("providerMessageId")?.trim() || null;
    const providerThreadId = request.nextUrl.searchParams.get("providerThreadId")?.trim() || null;

    const [health, receipt, duplicates, attachments, threadMapping] = await Promise.all([
      connectionId
        ? context.services.providers.diagnostics.getConnectionHealth({
            organizationId: context.actor.scope.organizationId,
            connectionId,
          })
        : Promise.resolve({ ok: true as const, value: null }),
      context.services.providers.diagnostics.findReceipt({
        organizationId: context.actor.scope.organizationId,
        receiptId,
        providerMessageId,
      }),
      context.services.providers.diagnostics.listDuplicateDetections({
        organizationId: context.actor.scope.organizationId,
        connectionId,
        limit: 50,
      }),
      context.services.providers.diagnostics.listAttachmentHydrationStatus({
        organizationId: context.actor.scope.organizationId,
        connectionId,
        limit: 100,
      }),
      providerThreadId
        ? context.services.providers.diagnostics.findThreadMapping({
            organizationId: context.actor.scope.organizationId,
            connectionId,
            providerThreadId,
          })
        : Promise.resolve({ ok: true as const, value: null }),
    ]);

    if (!health.ok) throw health.error;
    if (!receipt.ok) throw receipt.error;
    if (!duplicates.ok) throw duplicates.error;
    if (!attachments.ok) throw attachments.error;
    if (!threadMapping.ok) throw threadMapping.error;

    return jsonOk({
      data: {
        connectionHealth: health.value,
        receipt: receipt.value,
        duplicateDetections: duplicates.value,
        attachmentHydration: attachments.value,
        threadMapping: threadMapping.value,
      },
    });
  });
}
