# Runtime Claim Execution

Date: 2026-05-07

## Purpose

Phase 24 closes the remaining gap between globally fair allocator planning and safe canonical execution.

This phase introduces:

- tenant-aware canonical claim materialization
- allocator-driven execution workers
- allocator worker heartbeats and deterministic recovery
- bounded worker-pool scaling
- read-only allocator execution diagnostics

This phase does not introduce AI control, autonomous remediation, workflow optimization, or direct work-order mutation.

## Canonical Execution Path

The canonical path is now:

1. shared allocator planning reads canonical `runtimeJobs` and provider receipts
2. fairness windows decide what work should execute
3. allocator execution workers materialize those decisions into tenant-aware claim windows
4. each claim window claims specific canonical runtime jobs only through the worker lease service
5. normal worker handlers continue to execute leased jobs through the existing runtime substrate

The allocator decides what should execute. The canonical claim runtime decides whether execution is still safe at materialization time.

## Canonical Models

Phase 24 adds three canonical runtime-claim records:

1. `runtimeClaimWindows`
2. `runtimeClaimWorkers`
3. `runtimeClaimRecoveryEvents`

`runtimeClaimWindows` persist allocator-window materialization results. Each window records:

- stable `windowKey`
- allocator id and allocator window id
- shard id
- organization id and tenant id
- the bounded claim decision
- claimed job ids
- noop/skipped counts

`runtimeClaimWorkers` persist allocator execution heartbeat state, active window ownership, desired concurrency, and lease expiry.

`runtimeClaimRecoveryEvents` record explicit worker expiry and deterministic reassignment signals for diagnostics and replay-safe operations review.

## Tenant-Aware Claim Semantics

Tenant-aware claim decisions now carry:

- `tenantId`
- `organizationId`
- `fairnessWeight`
- `allocatorWindowId`
- `shardId`
- `pressureState`
- `quotaHeadroom`
- `replayPressure`
- `providerPressure`
- `claimDecisionReason`

Allocator execution does not claim by scanning a whole organization queue anymore. It selects eligible canonical jobs for the specific `(organizationId, tenantId)` decision and claims them by `jobId` through the canonical lease service. That preserves lease authority while making claim selection tenant-aware.

## Safety Guarantees

- Claim materialization is idempotent per allocator window through a stable `windowKey`.
- Duplicate allocator execution does not double-materialize the same tenant window.
- Specific-job claim acquisition still routes through the canonical worker lease service and repository transaction boundary.
- If a job is no longer claimable because another worker owns a fresh lease, materialization records a noop instead of forcing a second claim.
- Claim budgets are re-evaluated at materialization time so allocator plans still respect quota and backpressure changes that happened after planning.
- Provider isolation and replay pressure attenuate worker scaling and execution ordering.

## Heartbeats, Recovery, And Scaling

- Allocator workers persist heartbeats with lease expiry and active window visibility.
- Expired workers are marked `expired` and produce explicit recovery events.
- Reassignment remains deterministic because stale worker state is read-only metadata; authoritative shard ownership still comes from allocator shard leases.
- Worker scaling is bounded by configured min/max pool size and deterministic claim-per-worker limits.
- Replay pressure and provider isolation reduce worker expansion to avoid runaway amplification.

## Diagnostics And Operator APIs

Read-only operator endpoints:

- `GET /api/runtime-claim/health`
- `GET /api/runtime-claim/diagnostics`
- `GET /api/runtime-claim/workers`

These endpoints reuse the existing internal operational runtime authorization path and never trigger execution as a side effect.

Diagnostics expose:

- allocator health
- active worker heartbeats
- recent claim windows
- recovery events
- fairness execution ordering
- scaling summaries

## Removed Flow

Before Phase 24, the allocator planning layer ended in the older shared worker-pool materialization seam, which still depended on organization-scoped `claimNext(...)` scans. Phase 24 replaces that execution gap with tenant-aware claim-window materialization against canonical leases. No parallel claim runtime was introduced.

## Known Limitations

- Allocator worker execution remains an explicit service layer; this phase does not start autonomous background loops.
- Worker scaling is intentionally bounded and conservative rather than throughput-maximizing.
- Claim diagnostics are query-time reads over canonical records rather than a dedicated projection.

## Phase 25 Recommendation

Phase 25 should add explicit operator-controlled allocator execution entrypoints and worker-runner integration for production execution cycles, while keeping:

- canonical claim-window materialization
- bounded scaling controls
- heartbeat expiry recovery
- read-only diagnostics
- no AI operational authority
