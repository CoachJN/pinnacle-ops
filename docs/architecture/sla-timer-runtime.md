# SLA Timer Runtime

Date: 2026-05-06

## Scope

Phase 14 introduces one canonical SLA timer runtime path:

- persisted `slaTimers` records
- one production worker handler: `sla.timer.evaluate`
- one narrow timer type: `work_order.first_response_due`

This phase does **not** add:

- cron or autonomous polling
- notification delivery
- escalation delivery
- direct work-order mutation
- provider, email, Slack, Teams, or AI side effects

## Canonical behavior

### Timer type

`work_order.first_response_due`

Purpose:

- detect when a work order created in the canonical runtime has not received an internal first response within the SLA window

Current policy:

- policy version: `work_order.first_response_due.v1`
- due window: 4 hours from `work_order_created`

Current satisfaction rule:

- the timer is considered satisfied when canonical persisted evidence shows an internal first response after activation
- accepted evidence in this phase:
  - an internal `lifecycle_transitioned` domain event
  - an internal `communication_message_created` domain event
  - terminal work-order closure/cancellation, which deactivates the timer without mutating workflow

## Runtime flow

1. `work_order_created` emits a canonical domain event.
2. The runtime subscriber maps that event into SLA scheduling work.
3. The scheduler persists or reuses one canonical `slaTimers` record for the work order.
4. The scheduler enqueues one `sla.timer.evaluate` runtime job at `dueAt`.
5. Later internal lifecycle or internal communication events enqueue an immediate `sla.timer.evaluate` job for the same timer.
6. The latest queued job id is attached to the timer; older queued jobs become stale safely.
7. The production worker handler loads the timer, evaluates persisted canonical evidence only, and settles the timer:
   - `satisfied`
   - `breached`
   - `failed`
   - noop stale/duplicate

## Safety guarantees

- one canonical SLA timer record per work order/timer type via stable timer idempotency keys
- duplicate event replay does not create duplicate active timers
- duplicate runtime execution does not double-breach a timer
- stale superseded jobs no-op safely through `runtimeJobId` matching
- SLA evaluation reads canonical persisted state only
- SLA evaluation emits a canonical `sla_timer_breached` event on breach
- the handler never mutates work-order lifecycle state directly
- diagnostics are read-only

## Removed / deferred flows

Not used as production runtime:

- legacy workflow-library SLA primitives under `src/lib/workflows/execution/*`

Reason:

- they represent a separate workflow/SLA system and are not the canonical Phase 11-14 runtime path

Deferred to later phases:

- bounded timer scanning and reconciliation runtime in `docs/architecture/sla-runtime-scanning.md`
- timer scanning cron entrypoints
- escalation policies and recipients
- notification delivery adapters
- automated work-order escalation transitions
- richer policy configuration such as business hours or per-tenant overrides

## Diagnostics

`GET /api/sla/diagnostics`

Returns read-only summary data:

- scheduled timer count
- breached timer count
- satisfied timer count
- failed timer count
- overdue scheduled timers
- timers grouped by type
- recent breaches
- recent failures
