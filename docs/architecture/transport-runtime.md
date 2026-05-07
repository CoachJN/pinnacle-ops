# Transport Runtime

Date: 2026-05-06

## Purpose

Phase 18 adds the canonical provider-agnostic transport execution runtime.

This layer answers:

- was delivery execution attempted
- which adapter/channel executed it
- what execution result exists
- what retry state exists
- what provider receipt correlation exists

This layer does not:

- generate AI-authored message content
- remediate failures autonomously
- mutate work orders directly
- let providers mutate authoritative state

## Canonical model

Durable transport execution records live in `deliveryAttempts`.

Each attempt stores:

- canonical lineage: `deliveryPlanId`, `sourceEventId`, `correlationId`, `causationId`
- execution identity: `idempotencyKey`, `channel`, `adapterType`, `retryCount`
- execution state: `status`, `executionStartedAt`, `executionCompletedAt`
- failure state: `failureCode`, `failureReason`, `nextRetryAt`
- receipt correlation: `providerMessageId`, `providerCorrelationId`, `providerReceiptId`
- emitted event references

`deliveryPlans` remain orchestration records only.

## Execution flow

1. `delivery_planned` and `delivery_scheduled` enqueue `transport.execute` with a stable attempt-0 idempotency key.
2. The transport runtime creates or reuses a canonical `deliveryAttempt`.
3. The adapter registry resolves the channel adapter.
4. The adapter receives a normalized execution payload only.
5. The attempt is persisted through `queued`, `executing`, then a terminal or retry-scheduled state.
6. Retryable failures enqueue a new `transport.execute` job with a higher attempt number and deterministic backoff with jitter.
7. Successful execution marks the delivery plan `completed`.

## Internal adapter

The initial adapter is `internal`.

It:

- simulates durable internal delivery execution
- returns structured synthetic receipt identifiers
- emits canonical transport events through the runtime
- does not send external provider traffic

## Replay and idempotency guarantees

- Attempt identity is stable per `(deliveryPlanId, attemptNumber)`.
- Transport job identity is stable per `(deliveryPlanId, attemptNumber)`.
- Replaying `delivery_planned` and `delivery_scheduled` noops safely into the same transport job.
- Duplicate execution after a successful attempt records a noop event and does not create another active attempt.
- Retry scheduling is explicit, durable, and bounded by delivery policy.
- Provider-specific logic remains isolated behind transport adapters.

## Diagnostics and operator entrypoints

Operator APIs:

- `POST /api/transport/operator/process`
- `GET /api/transport/operator/diagnostics`

Diagnostics expose:

- active attempts
- attempts grouped by status and channel
- retry counts
- recent failures
- receipt correlation summaries
- replay noop counts
- adapter execution metrics
- tenant-scoped summaries

These APIs are explicit operator actions only and require internal runtime authorization.

## Removed or avoided flows

- No direct provider APIs from delivery planning.
- No provider credentials persisted in `deliveryAttempts`.
- No provider-originated workflow mutation.
- No hidden page-load execution loops.
- No parallel transport lifecycle outside canonical runtime jobs plus `deliveryAttempts`.

## Known limitations

- Only the internal adapter is implemented.
- Adapter metrics are attempt-level summaries, not per-provider telemetry streams.
- Retry repair and replay remain explicit operator actions; no autonomous remediation exists yet.

## Phase 19 recommendation

Add external provider adapters behind the same transport contract, starting with one canonical outbound provider, while preserving `deliveryAttempts` as the sole execution history and keeping provider acknowledgements normalized into the same receipt/correlation model.
