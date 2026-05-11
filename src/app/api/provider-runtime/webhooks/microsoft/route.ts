import { NextRequest, NextResponse } from "next/server";
import { createDomainServices } from "@/server/services";

export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: {
        "content-type": "text/plain",
      },
    });
  }

  return NextResponse.json({ error: "validationToken is required." }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const services = createDomainServices();
  const payload = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const verified = await services.providerRuntime.webhookSecurity.verifyMicrosoftGraphRequest({
    payload: payload as Record<string, unknown>,
    headers: request.headers,
    now,
  });
  if (!verified.ok) {
    return NextResponse.json(
      {
        error: verified.error.safeMessage,
      },
      { status: 400 },
    );
  }

  const handled = await services.providerRuntime.webhooks.handleMicrosoftGraphWebhook({
    organizationId: verified.value.organizationId,
    payload: payload as Record<string, unknown>,
    now,
  });
  if (!handled.ok) {
    return NextResponse.json(
      {
        error: handled.error.safeMessage,
      },
      { status: 400 },
    );
  }

  for (const receipt of handled.value.receipts) {
    await services.runtime.jobs.enqueue({
      organizationId: receipt.organizationId,
      actor: { userId: "system", role: "system" },
      now,
      type: "provider.receipt.process",
      payloadVersion: "v1",
      payload: {
        payloadVersion: "v1",
        receiptId: receipt.id,
        reason: "provider_receipt_recorded",
      },
      idempotencyKey: ["provider.receipt.process", receipt.id].join(":"),
      correlationId: receipt.correlationId,
      causationId: receipt.causationId,
      sourceEventId: receipt.sourceWebhookEventId,
      maxAttempts: 3,
    });
  }

  return NextResponse.json({
    data: {
      organizationId: verified.value.organizationId,
      connectionId: verified.value.connectionId,
      receiptCount: handled.value.receipts.length,
      webhookEventCount: handled.value.events.length,
      duplicates: handled.value.duplicates,
    },
  });
}
