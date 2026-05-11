# Runtime Execution Loops

## Purpose

Phase 25 adds the canonical runtime loop control plane that coordinates continuous allocator cadence, scheduler cadence, provider reconciliation cadence, and worker daemon execution without introducing a second execution substrate.

The loops in this phase only coordinate cadence. They do not introduce AI authority, autonomous remediation, direct work-order mutation, or hidden repair behavior.

## Canonical model

`runtimeLoops` persist one canonical record per `(organizationId, loopType)` with:

- `status`
- `leaseOwner`
- `leaseExpiresAt`
- `heartbeatAt`
- `lastRunStartedAt`
- `lastRunCompletedAt`
- `cadence`
- `concurrencyLimit`
- `failureCount`
- `lastError`
- `correlationId`

`runtimeLoopStates` persist explicit operator pause and drain controls. These controls are first-class runtime state, not implicit environment flags.

`runtimeLoopEvents` persist observable failover and control events:

- `failover`
- `pause_requested`
- `pause_released`
- `drain_requested`
- `drain_released`

`runtimeLoopResults` persist bounded run summaries so operators can inspect throughput, noop/replay behavior, and cadence lag without mutating runtime state.

## Supported loop types

- `allocator.execution`
- `scheduler.cadence`
- `provider.reconciliation`
- `worker.daemon`

## Ownership and recovery

Each loop acquires ownership through a recoverable lease.

- Duplicate owners are denied while a fresh lease is active.
- Expired ownership is recoverable by the next claimant.
- Ownership failover records a durable `failover` event.
- Heartbeat health is derived from persisted lease expiry, so stale ownership is observable without mutating the runtime during diagnostics reads.

This keeps loop coordination lease-safe while preserving replay safety underneath:

- allocator execution still depends on allocator shard leases and canonical claim-window materialization
- scheduler cadence still claims canonical scheduled tasks
- provider reconciliation still enqueues canonical runtime jobs
- worker daemons still execute jobs only through the canonical worker lease service

## Loop behavior

### Allocator execution

The allocator loop invokes canonical allocator execution only through the existing fairness, quota, backpressure, shard-lease, and claim-window services. Duplicate loop execution cannot double-claim work because:

- loop ownership is leased
- allocator shard ownership is leased
- claim-window materialization is idempotent per window key

### Scheduler cadence

The scheduler loop invokes the canonical scheduler tick service. Due-task claiming and scheduled-job idempotency remain authoritative, so duplicate cadence windows do not enqueue duplicate maintenance work.

### Provider reconciliation cadence

The reconciliation loop does not reconcile receipts directly. It enqueues the canonical `provider.reconciliation.sweep` worker job with a cadence-window idempotency key. The existing sweep handler then enqueues bounded receipt-processing work through the canonical runtime service.

### Worker daemon

The worker daemon loop only invokes the canonical worker runner. It respects existing claim guardrails, backpressure, quota, retries, dead-letter behavior, and handler boundaries.

## Pause and drain controls

Operator controls are explicit APIs:

- `GET /api/runtime-loops/health`
- `GET /api/runtime-loops/diagnostics`
- `POST /api/runtime-loops/pause`
- `POST /api/runtime-loops/drain`

Pause prevents a targeted loop from starting new work.

Drain is graceful:

- an in-flight bounded cycle completes
- the next cycle observes drain state and skips new work
- drain windows are explicit and observable

No repair, replay, or reconciliation action runs as a hidden page-load side effect.

## Diagnostics and health

Health aggregates:

- loop ownership
- heartbeat freshness
- pause/drain state
- recent throughput
- queue pressure
- pending provider reconciliation pressure

Diagnostics add:

- failover events
- recent run summaries
- utilization per loop
- cadence lag
- replay/noop counts

All diagnostics remain read-only.

## Removed and replaced flow

Before Phase 25, allocator, scheduler, reconciliation, and worker execution remained primarily operator-triggered service calls with no shared production cadence control plane.

Phase 25 replaces that gap with one canonical runtime loop layer. No parallel workflow system or alternate authorization path was introduced.

## Known limitations

- This phase coordinates bounded loop cycles, but it does not yet introduce a dedicated long-lived process supervisor.
- Provider reconciliation cadence currently schedules canonical sweep jobs; it does not yet add provider-specific adaptive cadence policies.
- Loop diagnostics summarize recent results only; historical analytics rollups remain a future observability concern.

## Recommended Phase 26

Phase 26 should layer explicit process-hosted runtime supervisors on top of this control plane:

- long-lived daemon bootstrapping
- supervisor heartbeat aggregation
- lease-aware process registration
- explicit restart policies
- runtime substrate metrics export

That next phase should keep using the same canonical loop records, control state, and diagnostics introduced here rather than adding a second coordination path.
