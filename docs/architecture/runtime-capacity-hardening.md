# Runtime Capacity Hardening

## Scope
Phase 22 adds deterministic runtime isolation and operational hardening for the distributed orchestration substrate. The goal is to keep one tenant, one provider path, or one repair/replay surge from destabilizing the rest of the platform.

This phase adds:
- tenant runtime quotas
- queue and claim guardrails
- runtime backpressure modes
- provider isolation
- bounded fairness planning
- retention and archival inspection
- bounded operator diagnostics

This phase does not add:
- AI runtime authority
- autonomous remediation
- direct work-order mutation from runtime capacity controls
- hidden repair/replay automation

## Canonical Model
The canonical implementation lives in `src/modules/runtime-capacity`.

The bounded context is policy-only. It does not create a parallel queue, scheduler, or authorization path. Instead, it evaluates the canonical runtime and provider-runtime stores and feeds decisions back into the existing runtime services.

Primary domain models:
- `TenantRuntimeQuota`: per-tenant limits for concurrency, queue depth, replay, repair, provider request volume, delivery attempt volume, retry storms, dead letters, escalations, projection refreshes, and bounded batching.
- `RuntimeBackpressureEvaluation`: normalized runtime pressure state with deterministic directives.
- `RuntimeRetentionPolicy`: hot, archive, and purge windows for derived operational artifacts.
- `RuntimeCapacityAlert`: bounded, sanitized operator-facing capacity signals.

## Enforcement Points
Tenant isolation is enforced in the current runtime at four canonical points:

1. `worker-runtime-service`
- enqueue is blocked when tenant queue, replay, repair, or projection-refresh limits are exceeded
- retryable failures can be suppressed into dead-letter when backpressure or provider isolation makes further retries unsafe

2. `worker-runner-service`
- claim throughput is reduced by per-tenant concurrency headroom and backpressure directives before jobs are leased

3. `runtime-scheduler-service`
- scheduler tick throughput is reduced under pressure
- reconciliation and replay-like scheduled work can be paused in degraded states
- only bounded health-oriented work is allowed through in emergency states

4. Operator entry points
- runtime operator processing uses the same guarded runner
- scheduler operator APIs instantiate the same guardrail services before ticking

## Fairness
The current runtime operator remains organization-scoped, so there is not yet a single global allocator claiming work for multiple tenants in one loop.

Phase 22 handles that in two layers:
- hard per-tenant runtime quotas prevent a tenant from exhausting shared runtime capacity
- `runtime-fairness-service` provides a deterministic round-robin allocation planner that guarantees starvation-safe batching for future shared allocators

The fairness planner:
- grants work in rounds rather than draining one tenant at a time
- respects queued work, requested claims, per-tenant concurrency limits, and batch caps
- refuses tenants in emergency backpressure mode

## Backpressure
Runtime backpressure has four states:
- `normal`
- `throttled`
- `degraded`
- `emergency`

State is computed from canonical utilization:
- queued runtime ratio
- active runtime ratio
- dead-letter growth
- retry-storm detection
- provider isolation state

Directives control:
- worker claim batch reduction
- scheduler task batch reduction
- replay and repair admission
- retry suppression
- full queue pause in emergency mode

## Provider Isolation
Provider instability is isolated at the tenant-provider boundary.

The provider isolation service examines canonical provider receipts and marks providers as:
- `normal`
- `throttled`
- `isolated`

Isolation is triggered by failed receipt volume, pending receipt backlog, or duplicate pressure. When isolated:
- retries for affected provider runtime jobs are suppressed
- unrelated providers are not globally degraded
- alerts are emitted as bounded runtime-capacity diagnostics

## Retention And Archival
Retention applies only to derived operational artifacts and diagnostics-oriented history:
- runtime projections
- diagnostics snapshots
- replay history
- dead-letter history
- provider receipt history
- delivery attempt history

The retention model is read-only in this phase. It classifies data into:
- hot
- archive eligible
- purge eligible

Authoritative domain history is explicitly preserved. No cleanup runs automatically from diagnostics reads.

## Observability Protections
Runtime-capacity diagnostics are bounded by design:
- top-N job-type summaries instead of unbounded high-cardinality dimensions
- bounded provider state lists
- bounded alert list
- summarized backlog and quota utilization instead of raw queue dumps

## Operator APIs
New read-only operator APIs:
- `GET /api/runtime-capacity/quotas`
- `GET /api/runtime-capacity/diagnostics`
- `GET /api/runtime-capacity/backpressure`
- `GET /api/runtime-capacity/retention`

All use the existing internal operational runtime authorization path.

## Known Limitation
The platform still lacks a true global multi-tenant worker allocator. Phase 22 prepares for that by introducing the canonical fairness planner and by enforcing tenant isolation in the current organization-scoped runtime. A future phase can plug the fairness planner into a shared claim loop without replacing the policy model.
