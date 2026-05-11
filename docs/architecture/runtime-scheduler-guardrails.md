# Runtime Scheduler Guardrails

Phase 21 adds a controlled scheduling and operator guardrail layer on top of the existing runtime substrate and command center.

This phase answers:
- which runtime maintenance work should be invoked on a schedule
- how scheduled work is bounded, tenant-scoped, and replay-safe
- which operator repairs need explicit guardrails and confirmation
- how to keep projections and runtime visibility fresh without autonomous remediation

This phase does not add:
- autonomous remediation
- AI operational authority
- direct work-order mutation from schedulers
- direct provider calls from scheduler sweeps
- background repair side effects triggered by diagnostics reads

## Canonical Scheduler Model

Canonical scheduled task types:
- `operations.projection.refresh`
- `sla.scan.overdue`
- `provider.reconciliation.sweep`
- `runtime.health.refresh`

Each scheduled task is persisted durably with:
- `id`
- `organizationId`
- `taskType`
- `status`
- `cadence`
- `nextRunAt`
- `lastRunAt`
- `lastCompletedAt`
- `lastRuntimeJobId`
- `leaseOwner`
- `leaseExpiresAt`
- `failureCount`
- `lastError`
- `correlationId`
- `createdAt`
- `updatedAt`

The scheduler is not a second worker system. It only:
1. claims due scheduled tasks with a lease
2. enqueues canonical runtime jobs with stable idempotency keys
3. advances `nextRunAt`
4. records diagnostics and outcomes

All actual maintenance execution still happens through the canonical worker runtime.

## Safety Rules

Scheduler safety:
- every scheduled task is tenant-scoped
- duplicate ticks are lease-safe
- duplicate enqueue attempts reuse the same runtime job idempotency key
- scheduler tasks never mutate authoritative domain entities directly
- scheduler tasks only enqueue canonical runtime jobs
- per-task batch limits are fixed and bounded
- per-task active-job thresholds rate-limit new scheduler work
- repeated scheduler failures open a task-level circuit by pausing the task

Runtime jobs created by the scheduler preserve:
- `correlationId`
- `cautationId` replacement path: scheduler-generated causation ids derived from `(taskId, scheduledFor)`
- `sourceEventId = null` unless future scheduler sources map to canonical events

## Scheduled Behaviors

`operations.projection.refresh`
- refreshes the persisted runtime projection from canonical runtime state
- does not mutate work orders or workflow entities

`sla.scan.overdue`
- uses the Phase 15 SLA scanning runtime
- remains bounded by batch size
- only enqueues SLA evaluation repairs through the runtime queue
- does not evaluate timers inline
- does not escalate directly

`provider.reconciliation.sweep`
- scans unresolved and failed provider receipts already persisted canonically
- enqueues `provider.receipt.process` runtime jobs
- does not call external providers directly

`runtime.health.refresh`
- recomputes runtime health from canonical persisted state
- refreshes alerts through the existing command-center alert sync
- preserves alert deduplication

## Diagnostics

Operator diagnostics now include:
- canonical scheduled tasks
- recent scheduler run records
- pending repair confirmations

Operator APIs:
- `POST /api/scheduler/operator/tick`
- `GET /api/scheduler/operator/diagnostics`
- `POST /api/operations/runtime/repair`
- `POST /api/operations/runtime/repair/confirm`

Diagnostics remain read-only. They never execute repair, replay, or reconciliation work as a side effect.

## Operator Guardrails

Guardrail policies cover:
- dead-letter replay
- stuck job requeue
- event replay retry
- provider reconciliation retry
- delivery retry reset

Each policy defines:
- risk level
- max batch size
- whether confirmation is required
- whether a reason is required
- whether dry-run is supported

Current high-risk actions that require explicit confirmation:
- dead-letter replay
- event replay retry

Repair confirmation records are durable and capture:
- requesting operator identity
- approving operator identity
- approval reason
- expiration timestamp
- execution status

Dry-run repair requests remain operator-driven audit records but do not enqueue or mutate runtime work.

## Replacement Path

Before Phase 21:
- command-center projections refreshed only through read-driven access
- high-risk repairs executed immediately once requested
- no managed scheduling cadence existed

After Phase 21:
- projection refresh and runtime maintenance can be invoked through a controlled scheduler tick
- scheduled work remains bounded and replay-safe
- high-risk repairs require explicit confirmation before runtime execution
- no autonomous remediation path has been introduced

## Known Limitations

- scheduler invocation is still operator-triggered or externally invoked; there is no resident cron worker in-process
- paused scheduler tasks require explicit operator follow-up to re-enable
- repair confirmation is currently scoped to single-target repair requests even though policies already carry batch semantics
- scheduler diagnostics are durable but intentionally simple; deeper trend analytics can layer on top later
