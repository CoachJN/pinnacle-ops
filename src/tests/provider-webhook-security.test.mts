import assert from "node:assert/strict";
import test from "node:test";

import { createProviderWebhookSecurityService } from "../modules/provider-runtime/index.ts";
import type { ProviderConnectionRepository, ProviderConnection } from "../server/repositories/index.ts";

test("provider webhook security resolves tenant from trusted subscription mapping", async () => {
  const service = createProviderWebhookSecurityService({
    providerConnections: createProviderConnectionRepository([
      makeConnection(),
    ]),
  });

  const result = await service.verifyMicrosoftGraphRequest({
    payload: {
      value: [
        {
          subscriptionId: "sub-1",
          clientState: "trusted-state-1",
          tenantId: "tenant-1",
        },
      ],
    },
    headers: makeHeaders({ date: "Wed, 07 May 2026 12:00:00 GMT" }),
    now: "2026-05-07T12:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.organizationId, "org-1");
  assert.equal(result.value.connectionId, "connection-1");
});

test("provider webhook security rejects caller payloads without a trusted mapping", async () => {
  const service = createProviderWebhookSecurityService({
    providerConnections: createProviderConnectionRepository([makeConnection()]),
  });

  const result = await service.verifyMicrosoftGraphRequest({
    payload: {
      value: [
        {
          subscriptionId: "sub-unknown",
          clientState: "trusted-state-1",
          tenantId: "tenant-1",
        },
      ],
    },
    headers: makeHeaders({}),
    now: "2026-05-07T12:00:00.000Z",
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.error.safeMessage,
    "Provider webhook subscription is not mapped to an active trusted integration.",
  );
});

test("provider webhook security rejects stale or forged webhook attempts", async () => {
  const service = createProviderWebhookSecurityService({
    providerConnections: createProviderConnectionRepository([makeConnection()]),
  });

  const stale = await service.verifyMicrosoftGraphRequest({
    payload: {
      value: [
        {
          subscriptionId: "sub-1",
          clientState: "trusted-state-1",
          tenantId: "tenant-1",
        },
      ],
    },
    headers: makeHeaders({ date: "Wed, 07 May 2026 11:40:00 GMT" }),
    now: "2026-05-07T12:00:00.000Z",
  });
  assert.equal(stale.ok, false);
  assert.equal(
    stale.error.safeMessage,
    "Provider webhook request timestamp was outside the allowed replay window.",
  );

  const forged = await service.verifyMicrosoftGraphRequest({
    payload: {
      value: [
        {
          subscriptionId: "sub-1",
          clientState: "forged-state",
          tenantId: "tenant-1",
        },
      ],
    },
    headers: makeHeaders({}),
    now: "2026-05-07T12:00:00.000Z",
  });
  assert.equal(forged.ok, false);
  assert.equal(
    forged.error.safeMessage,
    "Provider webhook client state did not match the trusted integration mapping.",
  );
});

function createProviderConnectionRepository(
  store: ProviderConnection[],
): ProviderConnectionRepository {
  return {
    newId: () => `connection-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      const index = store.findIndex((item) => item.id === entity.id);
      if (index >= 0) {
        store[index] = entity;
      } else {
        store.push(entity);
      }
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId(organizationId) {
      const items = store.filter((item) => item.organizationId === organizationId);
      return { items, count: items.length };
    },
    async findByWebhookSubscription(input) {
      return store.find((item) =>
        item.providerKey === input.providerKey &&
        item.metadata.webhookSubscriptionId === input.subscriptionId
      ) ?? null;
    },
    async findByMailboxAddress(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.providerKey === input.providerKey &&
        item.mailboxAddress === input.mailboxAddress
      ) ?? null;
    },
  };
}

function makeConnection(): ProviderConnection {
  return {
    id: "connection-1",
    organizationId: "org-1",
    tenantId: "org-1",
    providerKey: "microsoft_graph",
    providerTenantId: "tenant-1",
    providerAccountId: "account-1",
    mailboxAddress: "ops@example.com",
    displayName: "Ops",
    scopes: [],
    scopeMetadata: {},
    status: "active",
    healthStatus: "healthy",
    ownerUserId: "owner-1",
    connectedAt: "2026-05-07T10:00:00.000Z",
    disabledAt: null,
    expiresAt: null,
    lastHealthyAt: "2026-05-07T10:00:00.000Z",
    lastError: null,
    lastSyncedAt: null,
    metadata: {
      webhookSubscriptionId: "sub-1",
      webhookClientState: "trusted-state-1",
    },
    createdAt: "2026-05-07T10:00:00.000Z",
    updatedAt: "2026-05-07T10:00:00.000Z",
  };
}

function makeHeaders(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? values[name] ?? null;
    },
  };
}
