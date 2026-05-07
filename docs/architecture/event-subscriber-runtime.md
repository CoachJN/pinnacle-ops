# Event Subscriber Runtime

Date: 2026-05-06

## Purpose

Phase 12 adds the canonical event-to-worker bridge on top of the durable domain event and worker runtime foundations.

This phase does one thing:

- consume persisted canonical domain events through a subscriber registry
- transform them into runtime job enqueue requests
- persist durable subscriber processing records for idempotency, failures, diagnostics, and replay

This phase does not execute SLA rules, escalations, AI actions, provider polling, or direct work-order mutations.

## Canonical Model

The subscriber runtime now uses one durable record type:

- `runtimeEventProcessings`

Each processing record is keyed logically by:

- `organizationId`
- `subscriberKey`
- `sourceEventId`

Each record stores:

- `subscriberKey`
- `subscriberName`
- `sourceEventId`
- `eventType`
- `correlationId`
- `causationId`
- `idempotencyKey`
- `status`
- `attemptCount`
- `jobCount`
- `jobs`
- `lastError`
- `createdAt`
- `updatedAt`
- `completedAt`

## Subscriber Contract

Subscribers are registry-defined and intentionally constrained.

Subscribers may:

- read a persisted canonical event
- build runtime job enqueue requests

Subscribers may not:

- mutate work orders directly
- call provider APIs directly
- execute automation directly
- infer authoritative state from UI projections

Each job enqueue request carries:

- `organizationId`
- `sourceEventId`
- `correlationId`
- `causationId`
- `idempotencyKey`

The enqueue bridge delegates to the canonical worker runtime service so job deduplication still flows through the existing `(organizationId, type, idempotencyKey)` guardrail.

## Implemented Subscribers

The default registry currently queues only future runtime work:

- `lifecycle-sla-timer`
- `provider-failure-replay`
- `intake-review-followup`

These subscribers enqueue runtime jobs only. No worker execution is introduced in this phase.

## Idempotency And Replay Safety

Replay safety is enforced at two layers:

1. Subscriber processing records skip already-succeeded `(subscriberKey, sourceEventId)` pairs unless a replay is explicitly forced.
2. Worker job enqueue calls reuse stable subscriber-generated idempotency keys, so replaying the same event cannot create duplicate active jobs.

Failed subscriber processing remains durable and retryable:

- failures persist in `runtimeEventProcessings`
- diagnostics expose recent failures and per-subscriber counts
- reprocessing a failed event updates the same durable record with a higher `attemptCount`

## Read-Only Diagnostics

Read-only runtime endpoints are now available:

- `GET /api/runtime/subscribers`
- `GET /api/runtime/subscribers/diagnostics`

These endpoints expose:

- registered subscriber definitions
- durable processing records
- per-subscriber counts
- recent failures

No repair, replay, or mutation command is triggered from diagnostics reads.

## Removed And Avoided Flows

This phase intentionally avoids non-canonical runtime paths:

- no direct business automation execution from route handlers or UI components
- no provider API calls inside event subscribers
- no direct work-order mutation inside event subscribers
- no second async queue beside `runtimeJobs`
- no compatibility adapter from legacy workflow helpers into subscriber processing

## Final Canonical Behavior

- canonical domain events remain the durable source of truth
- subscribers consume those events through one registry
- subscribers enqueue canonical runtime jobs through one service
- durable processing records provide idempotency, diagnostics, and replay context
- future worker phases can safely build on this bridge without replacing it
