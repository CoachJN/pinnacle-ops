# SLA Runtime Scanning

Date: 2026-05-06

## Scope

Phase 15 adds the canonical SLA timer scanning and reconciliation runtime on top of the existing Phase 11-14 worker substrate.

This phase adds:

- deterministic overdue timer discovery
- durable scan cursors/checkpoints
- bounded repair scanning by due window and batch size
- replay-safe evaluation job repair
- read-only scan diagnostics
- explicit operator-only scan and reconcile APIs

This phase does **not** add:

- autonomous cron or background polling loops
- escalation delivery
- notification delivery
- AI actions
- provider polling
- direct work-order mutation

## Canonical responsibility

The scanner is responsible for one invariant:

- every eligible overdue scheduled SLA timer eventually has the correct canonical `sla.timer.evaluate` runtime job

The scanner is not responsible for:

- evaluating SLA policy logic
- deciding breach outcomes
- mutating workflow state
- sending communications or alerts

## Canonical model

### Timers

The scanner only scans canonical persisted `slaTimers` records that are:

- tenant scoped by `organizationId`
- `scheduled`
- due on or before the requested `dueBefore`

### Cursor

Durable `slaScanCursors` records store one canonical checkpoint per:

- `organizationId`
- `scanType`
- `timerType` or `all`

The cursor advances by ordered `(dueAt, id)` progression:

- `lastScannedDueAt`
- `lastScannedId`

This keeps scans deterministic and avoids full-tenant table walks for large organizations.

### Findings

A scanned timer can produce one of these findings:

- `healthy`
- `missing_active_job`
- `stale_job_reference`
- `terminal_job_without_terminal_timer_state`
- `orphaned_timer`

Repair actions are intentionally narrow:

- attach an already-active canonical runtime job to the timer
- enqueue one canonical `sla.timer.evaluate` repair job
- noop when the timer is already healthy

## Deterministic repair behavior

### Active job detection

The scanner inspects canonical runtime jobs for the timer and treats `queued`, `leased`, and `running` jobs as active.

If the timer points at the wrong job but another active evaluation job already exists:

- the timer is repaired by attaching the active job id
- no new runtime job is enqueued

### Replay-safe enqueue repair

If no active job exists, the scanner enqueues one canonical `sla.timer.evaluate` repair job through the existing runtime service only.

Repair idempotency keys are stable for the repair context:

- `sla.timer.evaluate:{timerId}:repair:due:{dueAt}` when the timer never had a job reference
- `sla.timer.evaluate:{timerId}:repair:after:{runtimeJobId}` when the timer references a stale or terminal job

This guarantees:

- duplicate scan attempts do not create duplicate active jobs
- concurrent operators safely converge on one active repair job
- later repairs can still occur after a newer referenced job becomes terminal

Every repair enqueue preserves canonical runtime identifiers from the timer:

- `organizationId`
- `correlationId`
- `causationId`
- `sourceEventId`

## Operator entrypoints

Protected internal/admin APIs:

- `POST /api/sla/operator/scan`
- `POST /api/sla/operator/reconcile`
- `GET /api/sla/operator/diagnostics`

These endpoints:

- require the same operational runtime admin authorization as other runtime operator APIs
- are explicit operator actions only
- remain bounded by caller-supplied limits
- never execute on page load

## Diagnostics

`GET /api/sla/operator/diagnostics`

Read-only diagnostics expose:

- overdue timer findings
- timers missing active jobs
- stale job references
- orphaned timers
- recent scan runs from durable cursor history
- repaired timer counts
- enqueue repair counts
- latest scan latency
- timer counts by type and status
- tenant-scoped cursor summaries

## Removed / deferred flows

Still not part of the canonical production runtime:

- legacy workflow-library SLA scanning under `src/lib/workflows/execution/*`
- autonomous scan schedulers
- escalation orchestration
- notification delivery adapters
- AI-driven remediation

The canonical Phase 15 path is:

- persisted SLA timer
- explicit operator scan or reconcile action
- canonical runtime job enqueue or attachment repair
- existing `sla.timer.evaluate` worker handler

## Guarantees validated in tests

- duplicate scans do not create duplicate active jobs
- cursor progression is durable across bounded batches
- stale active-job references are repaired without unnecessary enqueue
- orphaned or terminal timers are repaired by one canonical runtime job
- tenant boundaries are preserved during repair

## Phase 16 recommendation

Phase 16 should layer controlled scheduler invocation on top of this substrate:

- explicit or managed scan triggering
- operational metrics and alert thresholds
- safe cadence controls

It should still defer escalation delivery and notifications until the scan substrate is proven stable in operator-driven usage.
