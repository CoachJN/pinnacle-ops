# Runtime Allocator Fairness

Phase 23 introduces a shared multi-tenant runtime allocator that coordinates claim capacity across tenant workloads without bypassing the canonical runtime substrate.

## Canonical behavior

- Shared allocation decisions are computed from canonical persisted runtime jobs and provider receipts.
- Tenant execution still happens through the existing `runtime.lease.claimNext` service. The allocator never mutates worker jobs directly.
- Runtime capacity is divided into deterministic logical shards. Tenant-to-shard placement is a stable hash of `tenantId`.
- Each shard has a recoverable allocator lease. Only the active lease owner may materialize claims for that shard.
- Allocation windows are persisted with a stable allocation key so duplicate allocator ticks do not double-claim work within the same fairness window.

## Fairness model

- Weighted fairness uses the existing tenant quota `fairnessWeight`.
- Starvation prevention boosts effective weight for tenants whose oldest ready job has been waiting beyond the bounded starvation threshold.
- Replay and retry storms attenuate weight instead of allowing a replay-heavy tenant to consume the shared pool.
- Provider pressure and tenant backpressure further attenuate or fully suppress shared claims when isolation is active.
- Capacity is granted one claim at a time using deterministic normalized-load ordering, so no tenant can monopolize the shared pool while peers still have eligible work.

## Worker pool coordination

- Shared worker pool coordination is allocator-driven and bounded by shard capacity plus tenant quota headroom.
- Phase 24 replaces the earlier organization-scoped materialization seam with tenant-aware claim-window execution.
- Claim execution is tenant-aware and replay-safe because all claims are still performed by the canonical worker lease service.
- Duplicate allocator ownership is prevented by per-shard leases.
- Expired leases are recoverable and surface through diagnostics as recoverable shards.

## Operator surfaces

- `GET /api/runtime-allocator/health`
- `GET /api/runtime-allocator/diagnostics`
- `GET /api/runtime-allocator/fairness`

All allocator APIs are read-only and require the existing internal operational runtime authorization path.

## Removed gap

Before Phase 23, runtime fairness existed only as a local tenant planner and runtime execution remained effectively organization-scoped. Phase 23 replaces that gap with a canonical shared allocator layer. No compatibility adapter or alternate execution path was introduced.

Phase 24 continues that canonical path by replacing allocator materialization through organization-wide queue scans with tenant-aware runtime claim execution. See `docs/architecture/runtime-claim-execution.md`.
