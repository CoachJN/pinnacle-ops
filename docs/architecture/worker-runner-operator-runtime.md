# Worker Runner And Operator Runtime

Date: 2026-05-06

## Purpose

Phase 13 introduces explicit operator-controlled runtime execution entrypoints on top of the Phase 11 worker substrate and Phase 12 event subscriber runtime.

This phase does four things:

- executes claimed runtime jobs through an explicit worker handler registry
- exposes operator commands to process pending jobs and replay durable domain events
- exposes an explicit dead-letter replay command that re-enqueues new runtime jobs
- expands runtime diagnostics with execution readiness and registered handler visibility

This phase does not introduce autonomous polling, cron scheduling, SLA policy execution, escalation policy execution, AI actions, or provider polling.

## Canonical Execution Model

The canonical runtime path is now:

1. canonical domain events are persisted
2. operator replay can explicitly process those durable events through the subscriber runtime
3. subscribers enqueue canonical `runtimeJobs`
4. an operator command explicitly runs the worker runner
5. the runner claims a lease-safe job, marks it running, executes a registered handler, and then completes, retries, or dead-letters the job through the existing Phase 11 services

No route handler, UI component, or provider adapter executes orchestration inline.

## Worker Handler Contract

Runtime work is executed only through registered handlers.

Each handler receives:

- `job`
- `payload`
- `organizationId`
- `correlationId`
- `causationId`
- `sourceEventId`
- `attemptCount`
- `workerId`
- `startedAt`
- `services`
- `heartbeat.extendLease(...)`

Each handler returns:

- `success`
- optional `message`
- optional `metadata`
- optional `retryable`
- optional `errorCode`
- optional `errorDetails`

Thrown errors are caught, normalized, sanitized through the existing runtime failure path, and then retried or dead-lettered by the Phase 11 policy.

## Safety Guarantees

- Jobs are still claimed only through lease-safe repository semantics.
- The runner executes jobs sequentially by default and requires explicit `maxJobs` to process more than one job in a command.
- Dry-run mode never claims or mutates jobs.
- Expired leases are reclaimable through the same Phase 11 substrate.
- Handler execution can extend leases explicitly through the heartbeat helper, and the runner also supports optional periodic heartbeat extension.
- Unknown job types are never executed directly. If an operator chooses to process them, they fail safely through the canonical retry and dead-letter path.
- Dead-letter replay always creates a new job id by enqueuing a new runtime job with a new idempotency key.
- Dead-letter replay preserves the original `correlationId` and `sourceEventId`.
- Dead-letter replay adds payload replay metadata referencing the original job and dead-letter record.
- Non-retryable dead letters require `force=true`.
- Event replay never mutates domain entities directly; it only reprocesses durable canonical events through the subscriber runtime.
- Diagnostics remain read-only.

## Operator Commands

Protected runtime operator endpoints:

- `POST /api/runtime/operator/jobs/process`
- `POST /api/runtime/operator/events/process`
- `POST /api/runtime/operator/dead-letter/replay`
- `GET /api/runtime/operator/diagnostics`

All of these endpoints use the existing internal operational runtime admin authorization path.

### Jobs Process

`POST /api/runtime/operator/jobs/process`

Supported inputs:

- `workerId`
- `now`
- `maxJobs`
- `leaseDurationMs`
- `heartbeatIntervalMs`
- `jobTypes`
- `dryRun`

The route invokes the worker runner only through the explicit handler registry. There is no hidden loop.

### Events Process

`POST /api/runtime/operator/events/process`

Supported inputs:

- `eventId`
- `batchSize`
- `force`
- `now`

This command reprocesses persisted canonical events through the subscriber runtime. Replay safety remains enforced by durable processing records and stable job idempotency keys.

### Dead-Letter Replay

`POST /api/runtime/operator/dead-letter/replay`

Supported inputs:

- `deadLetterId`
- `force`
- `now`

This command re-enqueues a new canonical runtime job. It does not delete or mutate the dead-letter record.

### Diagnostics

`GET /api/runtime/operator/diagnostics`

Diagnostics combine:

- runtime queue and dead-letter summary
- subscriber processing summary
- registered worker handlers
- currently eligible jobs and whether a handler is registered for each type

## Removed And Avoided Flows

This phase intentionally avoids introducing non-canonical execution paths:

- no background listener
- no cron scheduler
- no SLA rule execution
- no escalation execution
- no AI action execution
- no provider polling execution
- no direct domain mutation from operator routes
- no compatibility adapter to the legacy workflow verification helpers

## Known Limitations

- The default production handler registry is intentionally empty in this phase. Future runtime work must be explicitly registered before it can be executed safely.
- Unsupported job types will retry and eventually dead-letter if an operator chooses to run them before a handler exists.
- Diagnostics are still query-time summaries over canonical records rather than dedicated projections.
- Event batch replay currently replays the newest fetched events first after reversing the repository result into chronological execution order for the bounded batch.

## Phase 14 Recommendation

Phase 14 should add the first real production worker handlers behind canonical service boundaries, starting with one narrowly scoped domain such as provider recovery or SLA timer state materialization, while keeping:

- explicit handler registration
- canonical service-only mutations
- lease heartbeat coverage for long-running handlers
- replay-safe idempotency tests for each concrete handler type
