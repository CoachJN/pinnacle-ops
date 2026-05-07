import "server-only";

import {
  PROVIDER_RUNTIME_TYPES,
  type ProviderRuntimeType,
} from "@/modules/provider-runtime/domain/provider-receipt";
import {
  TRANSPORT_ADAPTER_TYPES,
  type TransportAdapter,
} from "@/modules/transport";

export interface MicrosoftGraphEmailAdapterOptions {
  tenantId?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  senderUserId?: string | null;
  fetchImpl?: typeof fetch;
}

export function createMicrosoftGraphEmailAdapter(
  options: MicrosoftGraphEmailAdapterOptions = {},
): TransportAdapter {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return {
    adapterType: TRANSPORT_ADAPTER_TYPES.MicrosoftGraphEmail,
    supportsChannel(channel) {
      return channel === "email";
    },
    async execute(input) {
      const { deliveryPlan, attempt } = input.payload;
      const providerCorrelationId = `graph-correlation:${attempt.id}`;
      const simulatedMessageId = `graph-message:${deliveryPlan.id}:${attempt.retryCount}`;
      const simulatedReceiptId = `graph-receipt:${attempt.id}`;

      if (!options.tenantId || !options.clientId || !options.clientSecret || !options.senderUserId || !fetchImpl) {
        return {
          outcome: "accepted",
          message: "Microsoft Graph adapter executed in simulated mode.",
          providerType: PROVIDER_RUNTIME_TYPES.MicrosoftGraphEmail,
          providerEventType: "message.accepted",
          rawStatus: "accepted",
          receipt: {
            deliveryPlanId: deliveryPlan.id,
            deliveryAttemptId: attempt.id,
            providerMessageId: simulatedMessageId,
            providerCorrelationId,
            providerReceiptId: simulatedReceiptId,
          },
          metadata: {
            mode: "simulated",
            recipientAddress: deliveryPlan.recipientAddress,
            templateId: deliveryPlan.templateId,
            templateVersion: deliveryPlan.templateVersion,
          },
        };
      }

      const accessToken = await fetchGraphAccessToken(fetchImpl, {
        tenantId: options.tenantId,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
      });

      const draft = await createGraphDraft(fetchImpl, accessToken, options.senderUserId, {
        to: deliveryPlan.recipientAddress,
        subject: buildGraphSubject(deliveryPlan.templateId, deliveryPlan.id),
        body: buildGraphBody(deliveryPlan.templateId, deliveryPlan.id, attempt.id),
      });

      await sendGraphDraft(fetchImpl, accessToken, options.senderUserId, draft.id);

      return {
        outcome: "accepted",
        message: "Microsoft Graph accepted outbound email delivery.",
        providerType: PROVIDER_RUNTIME_TYPES.MicrosoftGraphEmail,
        providerEventType: "message.accepted",
        rawStatus: "accepted",
        receipt: {
          deliveryPlanId: deliveryPlan.id,
          deliveryAttemptId: attempt.id,
          providerMessageId: draft.id,
          providerCorrelationId,
          providerReceiptId: draft.internetMessageId ?? draft.id,
        },
        metadata: {
          mode: "live",
          senderUserId: options.senderUserId,
          recipientAddress: deliveryPlan.recipientAddress,
        },
      };
    },
  };
}

async function fetchGraphAccessToken(
  fetchImpl: typeof fetch,
  input: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  },
): Promise<string> {
  const tokenResponse = await fetchImpl(
    `https://login.microsoftonline.com/${encodeURIComponent(input.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  if (!tokenResponse.ok) {
    throw new Error(`graph_token_request_failed:${tokenResponse.status}`);
  }
  const tokenPayload = await tokenResponse.json() as { access_token?: string };
  if (!tokenPayload.access_token) {
    throw new Error("graph_access_token_missing");
  }
  return tokenPayload.access_token;
}

async function createGraphDraft(
  fetchImpl: typeof fetch,
  accessToken: string,
  senderUserId: string,
  input: {
    to: string;
    subject: string;
    body: string;
  },
): Promise<{ id: string; internetMessageId: string | null }> {
  const response = await fetchImpl(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderUserId)}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        subject: input.subject,
        body: {
          contentType: "Text",
          content: input.body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: input.to,
            },
          },
        ],
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`graph_draft_create_failed:${response.status}`);
  }
  const payload = await response.json() as { id?: string; internetMessageId?: string | null };
  if (!payload.id) {
    throw new Error("graph_draft_id_missing");
  }
  return {
    id: payload.id,
    internetMessageId: payload.internetMessageId ?? null,
  };
}

async function sendGraphDraft(
  fetchImpl: typeof fetch,
  accessToken: string,
  senderUserId: string,
  messageId: string,
): Promise<void> {
  const response = await fetchImpl(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderUserId)}/messages/${encodeURIComponent(messageId)}/send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`graph_send_failed:${response.status}`);
  }
}

function buildGraphSubject(templateId: string, deliveryPlanId: string): string {
  return `[${templateId}] Delivery ${deliveryPlanId}`;
}

function buildGraphBody(templateId: string, deliveryPlanId: string, attemptId: string): string {
  return [
    `Template: ${templateId}`,
    `Delivery plan: ${deliveryPlanId}`,
    `Attempt: ${attemptId}`,
    "This message was issued by the canonical provider runtime.",
  ].join("\n");
}
