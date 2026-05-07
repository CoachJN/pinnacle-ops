# Provider Reconciliation Runtime

Date: 2026-05-06

## 1. Phase 19 scope

Phase 19 adds the canonical outbound provider execution and receipt reconciliation runtime.

This phase now owns:

- outbound provider adapter execution for external transport
- canonical provider receipt persistence
- webhook normalization and deduplication
- receipt-to-attempt correlation
- delivery state convergence from provider truth
- delayed-success retry suppression
- read-only provider diagnostics
- explicit operator reconciliation entrypoints

This phase still does not allow:

- AI-generated communication
- provider-originated workflow mutation
- autonomous remediation
- uncontrolled provider polling loops
- direct provider mutation of work orders, escalations, or delivery orchestration

## 2. Canonical bounded context

Inbound mailbox ingestion remains in `providers`.

Outbound delivery truth now lives in `provider-runtime`.

That separation is intentional:

- `providers` owns mailbox/account ingestion, sync checkpoints, and intake normalization
- `provider-runtime` owns outbound execution receipts and delivery-state convergence

No legacy outbound provider runtime existed before this phase, so no compatibility path was preserved.

## 3. Canonical execution flow

The canonical outbound provider flow is:

1. `transport.execute` selects a transport adapter by channel.
2. The Microsoft Graph email adapter executes behind the transport adapter boundary.
3. An acceptance-style Graph result records a canonical `ProviderReceipt` with normalized status `accepted` or `queued`.
4. The delivery attempt remains in canonical transport execution history and waits for external truth.
5. A provider webhook or explicit operator action records later receipt state such as `delivered` or `failed`.
6. Provider reconciliation correlates the receipt back to the canonical `deliveryAttempt`.
7. Only the reconciliation service may converge the attempt and delivery plan state.

Providers never mutate work orders or escalation state directly.

## 4. Canonical persistence model

Phase 19 introduces two canonical runtime records:

- `providerReceipts`
- `providerWebhookEvents`

`ProviderReceipt` is the authoritative provider-truth artifact for outbound reconciliation.

`ProviderWebhookEvent` is the durable ingress record for deduplication and diagnostics.

The runtime does not persist provider credentials, access tokens, or raw secrets in these records.

## 5. Receipt normalization and correlation

All provider-originated payloads normalize into a canonical `ProviderReceipt` before reconciliation.

Correlation uses the following stable keys in order:

1. `deliveryAttemptId`
2. `providerReceiptId`
3. `providerMessageId`
4. `providerCorrelationId`

If no attempt can be correlated, the receipt remains durable and is marked ignored rather than mutating delivery state speculatively.

## 6. Reconciliation and convergence rules

Reconciliation is replay-safe and idempotent.

Canonical convergence rules:

- `accepted` and `queued` update correlation metadata but do not complete delivery
- `delivered` converges the attempt to `succeeded`
- `failed`, `bounced`, and `rejected` converge the attempt to `failed`
- later lower-order receipts cannot overwrite a higher-order canonical outcome
- replay of an already-applied success or failure becomes a no-op

Out-of-order protection is rank-based:

- `accepted`
- `queued`
- `unknown`
- `failed` / `bounced` / `rejected`
- `delivered`

This prevents a later low-signal provider update from corrupting a previously converged delivery result.

## 7. Late-success retry suppression

The runtime supports the canonical delayed-success case:

1. a transport attempt schedules a retry because external success was not yet confirmed
2. a later provider `delivered` receipt arrives for the original attempt
3. reconciliation flips the original attempt to `succeeded`
4. the delivery plan converges to `completed`
5. the previously scheduled retry becomes redundant and is suppressed by canonical success state

This preserves history while preventing duplicate provider sends during replay or retry execution.

## 8. Diagnostics and operator controls

Read-only diagnostics now expose:

- provider receipt counts by reconciliation status
- duplicate webhook counts
- reconciliation failures
- delayed-success suppression counts
- replay/no-op counts
- provider delivery summaries
- average receipt processing latency

Explicit operator APIs:

- `POST /api/provider-runtime/operator/reconcile`
- `GET /api/provider-runtime/operator/diagnostics`

Webhook ingress:

- `GET /api/provider-runtime/webhooks/microsoft` for validation token echo
- `POST /api/provider-runtime/webhooks/microsoft` for durable webhook normalization

Operator actions remain explicit and do not run as hidden page-load side effects.

## 9. Replay and idempotency guarantees

Phase 19 guarantees:

- duplicate webhook deliveries dedupe by stable webhook idempotency keys
- duplicate provider receipts dedupe by canonical receipt idempotency keys
- replaying the same receipt does not create duplicate state transitions
- provider reconciliation is safe after worker retry, replay, or crash
- provider state converges only through canonical receipt records

## 10. Microsoft Graph adapter notes

The first real outbound adapter is `microsoft_graph_email`.

Behavior:

- live mode uses Graph client-credential auth, draft creation, and draft send
- simulated mode is used automatically when Graph runtime configuration is unavailable
- both modes emit canonical provider correlation ids and receipt metadata

The adapter remains isolated behind the transport adapter contract. No provider-specific logic leaks into delivery planning, escalation orchestration, or work-order services.

## 11. Phase 20 recommendation

Phase 20 should add a canonical provider-substrate worker flow for explicit mailbox/status fetch and operator-driven replay of unresolved pending receipts, while keeping the same receipt-first convergence boundary.
