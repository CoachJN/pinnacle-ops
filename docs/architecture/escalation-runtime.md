# Escalation Orchestration Runtime

## Purpose

Phase 16 adds the canonical escalation orchestration runtime on top of the existing SLA timer substrate.

This runtime answers:

- what escalation exists
- what stage it is in
- whether it is active, suppressed, cancelled, completed, or failed
- what follow-up runtime jobs should exist next

This runtime does **not**:

- send notifications
- deliver email, Slack, Teams, or provider messages
- invoke AI actions
- mutate work orders directly
- run autonomous remediation

## Canonical Flow

Initial canonical escalation:

- `work_order.first_response_breach`

Canonical trigger:

- `sla_timer_breached` for `work_order.first_response_due`

Canonical resolution signal:

- `sla_timer_satisfied`

The event subscriber runtime converts those canonical SLA events into `escalation.progress` worker jobs. The worker handler then creates, progresses, suppresses, or cancels a persisted orchestration record.

## Persistence Model

Escalations are stored in the top-level `escalationOrchestrations` collection.

Each orchestration persists:

- tenant and organization scope
- escalation type and target entity identity
- source SLA timer and source event references
- correlation and causation ids
- stable idempotency key
- durable status
- current stage
- full stage history
- scheduled runtime job references
- suppression and cancellation reasons
- progression attempt and noop counts

This makes the runtime replayable, diagnosable, and recoverable without inferring state from UI projections or transient transport state.

## Stage Policy

Current deterministic policy:

- Stage 1: created immediately on breach
- Stage 2: scheduled 1 hour after Stage 1 if unresolved
- Stage 3: scheduled 4 hours after Stage 2 if unresolved

Stage 3 is terminal for progression scheduling. The orchestration is marked `completed` to indicate the runtime has exhausted its deterministic stage plan. This still does not deliver notifications or mutate operational entities.

## Idempotency And Replay Guarantees

The runtime is intentionally safe under duplicate delivery, replay, retry, and worker restart.

Guarantees:

- Replaying the same `sla_timer_breached` event cannot create duplicate active escalations.
- Duplicate `escalation.progress` jobs noop safely when the requested stage was already entered.
- Open-orchestration suppression is scoped to the canonical escalation condition: escalation type plus target entity, not only to a specific runtime event.
- Progression jobs use stable idempotency keys per orchestration stage.
- Cancellation jobs use canonical `sla_timer_satisfied` events rather than side-channel checks.
- Event subscriber processing remains separately durable and duplicate-safe through `runtimeEventProcessings`.

## Cancellation And Suppression

Cancellation path:

1. A breached timer is re-evaluated after durable internal response evidence arrives.
2. The SLA evaluator marks the timer satisfied and emits `sla_timer_satisfied`.
3. The event subscriber queues `escalation.progress` with `cancel_if_resolved`.
4. The escalation runtime cancels the matching orchestration and emits `escalation_cancelled`.

Suppression path:

- If another active or completed escalation already exists for the same escalation type and target entity, the new orchestration request is persisted as `suppressed` and emits `escalation_suppressed`.

## Diagnostics And Operator Entry Points

Operator APIs added:

- `POST /api/escalation/operator/process`
- `GET /api/escalation/operator/diagnostics`

Diagnostics expose:

- active escalations
- escalations by stage
- cancelled and suppressed escalations
- overdue escalations
- aggregate progression/noop counts
- recent escalation events
- tenant-scoped summary data

These APIs require the existing internal operational runtime authorization path and only run from explicit operator actions.

## Removed And Replaced Flows

- Removed flows: none, because no prior escalation orchestration runtime existed
- Replacement paths: SLA breach events now feed escalation orchestration through canonical event subscriber and worker runtime paths
- Final canonical behavior: escalation state is persisted and progressed only through canonical SLA events, canonical worker jobs, canonical domain services, and canonical domain events

## Known Limits In Phase 16

- No notification delivery runtime exists yet.
- No recipient resolution exists yet.
- No provider transport exists yet.
- No AI action execution exists yet.
- No direct work-order mutation exists yet.
- No remediation or delivery policy fan-out exists yet.

## Recommended Phase 17

Build the delivery planning/runtime layer that consumes canonical escalation events and persisted orchestrations to determine **who should receive delivery and through which channel**, while keeping delivery transport, retries, and provider integration separate from orchestration state.
