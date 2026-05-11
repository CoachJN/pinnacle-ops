import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { ProviderConnection } from "@/modules/providers";
import type { ProviderConnectionRepository } from "@/server/repositories";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { validationError } from "@/server/services/errors";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

const MICROSOFT_WEBHOOK_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

interface HeaderReader {
  get(name: string): string | null;
}

interface MicrosoftGraphWebhookNotification {
  subscriptionId?: unknown;
  clientState?: unknown;
  tenantId?: unknown;
}

export interface VerifiedMicrosoftGraphWebhook {
  organizationId: EntityId;
  connectionId: EntityId;
  subscriptionId: string;
  trustedTenantId: string | null;
}

export interface ProviderWebhookSecurityService {
  verifyMicrosoftGraphRequest(input: {
    payload: Record<string, unknown>;
    headers: HeaderReader;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<VerifiedMicrosoftGraphWebhook>>;
}

export function createProviderWebhookSecurityService(
  dependencies: {
    providerConnections: ProviderConnectionRepository;
  },
): ProviderWebhookSecurityService {
  return {
    async verifyMicrosoftGraphRequest(input) {
      try {
        const notifications = readNotifications(input.payload);
        if (notifications.length === 0) {
          return serviceFail(validationError("Provider webhook payload did not contain any notifications."));
        }

        validateRequestTimestamp(input.headers, input.now);

        const subscriptionIds = [...new Set(notifications.map((item) => readRequiredText(item.subscriptionId, "subscriptionId")))];
        if (subscriptionIds.length !== 1) {
          return serviceFail(validationError("Provider webhook payload must resolve to exactly one trusted subscription."));
        }

        const connection = await dependencies.providerConnections.findByWebhookSubscription({
          providerKey: "microsoft_graph",
          subscriptionId: subscriptionIds[0],
        });
        if (!connection || connection.status !== "active") {
          return serviceFail(validationError("Provider webhook subscription is not mapped to an active trusted integration."));
        }

        const expectedClientState = readConfiguredClientState(connection);
        if (!expectedClientState) {
          return serviceFail(validationError("Provider webhook integration is missing a configured client state."));
        }

        for (const notification of notifications) {
          const clientState = readRequiredText(notification.clientState, "clientState");
          if (!constantTimeEquals(expectedClientState, clientState)) {
            return serviceFail(validationError("Provider webhook client state did not match the trusted integration mapping."));
          }

          const tenantId = readOptionalText(notification.tenantId);
          if (
            connection.providerTenantId &&
            tenantId &&
            connection.providerTenantId !== tenantId
          ) {
            return serviceFail(validationError("Provider webhook tenant did not match the trusted integration mapping."));
          }
        }

        return serviceOk({
          organizationId: connection.organizationId,
          connectionId: connection.id,
          subscriptionId: subscriptionIds[0],
          trustedTenantId: connection.providerTenantId ?? null,
        });
      } catch (error) {
        return serviceFail(
          error instanceof Error
            ? validationError(error.message)
            : validationError("Provider webhook verification failed."),
        );
      }
    },
  };
}

function readNotifications(payload: Record<string, unknown>): MicrosoftGraphWebhookNotification[] {
  const value = payload.value;
  return Array.isArray(value) ? value as MicrosoftGraphWebhookNotification[] : [];
}

function validateRequestTimestamp(headers: HeaderReader, now: IsoDateTimeString): void {
  const rawDate = headers.get("date")?.trim() ?? null;
  if (!rawDate) {
    return;
  }

  const receivedAtMs = Date.parse(rawDate);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(receivedAtMs) || !Number.isFinite(nowMs)) {
    throw validationError("Provider webhook request timestamp was invalid.");
  }

  if (Math.abs(nowMs - receivedAtMs) > MICROSOFT_WEBHOOK_MAX_CLOCK_SKEW_MS) {
    throw validationError("Provider webhook request timestamp was outside the allowed replay window.");
  }
}

function readConfiguredClientState(connection: ProviderConnection): string | null {
  const value = connection.metadata.webhookClientState;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRequiredText(value: unknown, field: string): string {
  const normalized = readOptionalText(value);
  if (!normalized) {
    throw validationError(`Provider webhook ${field} is required.`);
  }
  return normalized;
}

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function constantTimeEquals(expected: string, received: string): boolean {
  const expectedHash = createHash("sha256").update(expected).digest();
  const receivedHash = createHash("sha256").update(received).digest();
  return timingSafeEqual(expectedHash, receivedHash);
}
