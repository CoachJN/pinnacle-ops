# Delivery Runtime

Date: 2026-05-06

## Purpose

Phase 17 introduced canonical delivery planning.

Phase 18 keeps `deliveryPlans` as orchestration records only.

This layer answers:

- what delivery should exist
- who should receive it
- which channel should be used
- whether transport execution should be scheduled

This layer does not:

- execute provider traffic
- persist transport receipts or attempt failures
- generate AI-authored content
- mutate work orders directly

## Canonical model

Durable delivery plans live in `deliveryPlans`.

Each plan stores:

- source escalation and source event lineage
- deterministic recipient and channel routing
- template contract identity
- orchestration status
- transport retry pointer fields (`retryCount`, `nextAttemptAt`)
- replay diagnostics (`noopCount`)

Current supported delivery type:

- `escalation.first_response_breach_notification`

Current supported channel:

- `internal`

## Event flow

1. Escalation events enqueue `delivery.plan.process`.
2. Delivery planning resolves recipients from canonical tenant-scoped user profiles.
3. Durable plans are created or duplicate-active recipients are suppressed.
4. Active plans are moved to `scheduled` for transport execution.
5. `delivery_planned` and `delivery_scheduled` events become the canonical bridge into the transport runtime.

## State model

Plan statuses:

- `planned`: durable orchestration record created
- `scheduled`: ready for transport execution or retry
- `suppressed`: duplicate recipient/channel/stage combination suppressed safely
- `cancelled`: source escalation cancelled before transport completion
- `completed`: transport execution completed successfully
- `failed`: transport execution exhausted or hit a terminal failure

## Replay and idempotency guarantees

- Event subscriber processing remains keyed by `(subscriberKey, sourceEventId)`.
- Active plan identity remains stable across `(deliveryType, sourceEscalationId, stageNumber, recipientId, channel)`.
- Replaying the same escalation event does not create duplicate active delivery plans.
- Transport execution is no longer implemented as a delivery-plan follow-up job.
- Delivery plans only describe orchestration state; execution history lives in `deliveryAttempts`.

## Removed flows

- Removed the Phase 17 `process_existing_plan` follow-up planning checkpoint flow.
- Removed the legacy meaning of `completed` as “planning finished without transport.”
- Removed direct delivery runtime enqueue of planning follow-up jobs.

## Canonical replacement path

- `delivery.plan.process` creates or updates delivery orchestration records.
- `delivery_planned` and `delivery_scheduled` enqueue `transport.execute`.
- `deliveryAttempts` hold execution outcomes, retries, and receipts.

## Known limitations

- Only the internal transport adapter exists in this phase.
- No Slack, email, or Teams provider traffic is executed yet.
- Providers still cannot mutate authoritative operational state.
