# Worker Runtime Substrate

## Purpose

Phase 11 introduces the canonical async execution substrate for the operational platform. This runtime is intentionally narrow:

- it persists generic worker jobs
- it supports atomic lease-based claiming
- it schedules bounded retries with deterministic exponential backoff and jitter
- it routes exhausted work into dead-letter storage
- it emits durable runtime domain events for observability
- it exposes read-only diagnostics APIs

This phase does **not** introduce background polling loops, SLA timers, escalations, AI actions, or provider polling automation.

## Canonical Model

The runtime now uses two canonical persistence records:

1. `runtimeJobs`
2. `runtimeDeadLetters`

`runtimeJobs` is the only authoritative async execution queue. Jobs carry:

- `id`
- `type`
- `status`
- `payload`
- `payloadVersion`
- `idempotencyKey`
- `correlationId`
- `causationId`
- `sourceEventId`
- `attemptCount`
- `maxAttempts`
- `runAfter`
- `leasedBy`
- `leaseExpiresAt`
- `createdAt`
- `updatedAt`
- `lastError`
- `completedAt`

`runtimeDeadLetters` preserves exhausted or invalid jobs for operator diagnosis and explicit replay decisions.

## Safety Guarantees

The runtime is designed around at-least-once delivery and crash recovery:

- Jobs are claimed through lease semantics, not implicit ownership.
- Only `queued` jobs with `runAfter <= now` can be freshly claimed.
- `leased` and `running` jobs can only be reclaimed after `leaseExpiresAt`.
- Claim transitions happen at the repository boundary so duplicate workers cannot both acquire the same active lease.
- Claiming increments `attemptCount`, making retries and reclaims observable.
- Retries use exponential backoff with deterministic jitter so tests can assert scheduling.
- Retry exhaustion or non-retryable failures route to `runtimeDeadLetters`.
- Error details are sanitized before persistence to avoid storing secrets or raw credentials.
- Queue writes are protected by `(organizationId, type, idempotencyKey)` guardrails in the service layer to prevent duplicate enqueue paths.
- Runtime observability is emitted through durable domain events instead of UI-only projections.

## Event Model

The runtime emits canonical domain events for operational observability:

- `runtime_job_queued`
- `runtime_job_failed`
- `runtime_job_retry_scheduled`
- `runtime_job_dead_lettered`
- `runtime_job_succeeded`
- `runtime_job_cancelled`

These are operational events. They are not direct work-order mutations, and future subscribers must remain idempotent.

## Removed And Avoided Flows

This phase deliberately avoids creating a second queueing system:

- The older `src/lib/workflows/execution/*` utilities remain non-authoritative workflow verification helpers only.
- They are not used as the worker runtime substrate.
- No compatibility adapter was added between those helpers and `runtimeJobs`.
- No worker is allowed to mutate work orders, communications, or intake records directly.

## Diagnostics APIs

Read-only runtime endpoints are now available:

- `GET /api/runtime/jobs`
- `GET /api/runtime/jobs/[jobId]`
- `GET /api/runtime/dead-letter`
- `GET /api/runtime/diagnostics`

Diagnostics expose:

- queued count
- leased/running count
- failed count
- dead-letter count
- oldest queued job
- jobs by type
- recent failures

These endpoints use the same internal operational-runtime admin access path as provider runtime diagnostics.

## Known Limitations

- No production worker loop is started in this phase.
- Lease heartbeats are supported through explicit extension, but no automatic heartbeat runner exists yet.
- Diagnostics currently aggregate from canonical persisted records without dedicated projections.
- Dead-letter replay and operator repair commands are intentionally deferred.

## Phase 12 Direction

Phase 12 can safely layer on top of this substrate:

1. Event subscribers that enqueue runtime jobs from canonical domain events.
2. Explicit operator replay and repair commands for dead-lettered jobs.
3. Approved worker runners for SLA timers, provider sync orchestration, and automation execution.
4. Additional runtime projections or dashboards if diagnostics query volume grows.
