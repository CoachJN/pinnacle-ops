# Lease And Claim Hardening

Date: 2026-05-07
Phase: 6
Scope: worker-job lease ownership, provider sync run claim ownership, reclaim safety, crash/recovery convergence

## 1. Canonical ownership model

The platform now uses one canonical ownership rule for mutable runtime leases:

1. Only the active lease owner may mutate leased runtime state.
2. Ownership is identified by both `workerId` or `claimedBy` and a monotonic claim token.
3. Lease mutations also require the current lease to be unexpired at mutation time.
4. Reclaim always rotates the claim token and increments the lease version.

### Worker job lease identity

Authoritative runtime jobs now persist:

- `leasedBy`
- `leaseExpiresAt`
- `lease.workerId`
- `lease.claimToken`
- `lease.leaseVersion`
- `lease.claimedAt`
- `lease.heartbeatAt`
- `lease.reclaimedAt`
- `lease.reclaimedBy`
- `lease.reclaimCount`

The legacy top-level `leasedBy` and `leaseExpiresAt` fields remain for existing query surfaces, but the canonical mutation checks now use the nested lease identity as well.

### Provider sync run claim identity

Provider sync runs now persist the same class of ownership metadata in `claim`:

- `claimedBy`
- `claimToken`
- `claimVersion`
- `claimedAt`
- `leaseExpiresAt`
- `heartbeatAt`
- `releasedAt`
- `reclaimedAt`
- `reclaimedBy`
- `reclaimCount`

Provider runtime ownership is no longer weaker than the canonical worker runtime.

## 2. Compare-and-swap semantics

The following runtime operations now execute through compare-and-swap checks at the repository layer:

### Worker runtime

- `claimNext`
- `claimById`
- `markRunning`
- `extendLease`
- `complete`
- `fail`

For `markRunning`, `extendLease`, `complete`, and `fail`, the repository verifies:

1. organization ownership
2. active lease owner
3. current claim token
4. unexpired lease
5. allowed lease status

If any check fails, the mutation is rejected instead of silently overwriting newer ownership.

### Provider runtime

- `syncRuns.claim`
- `syncRuns.complete`
- `syncRuns.fail`
- `syncRuns.release`

Provider sync claims now reject overlapping active claims and stale-owner mutation after reclaim.

## 3. Reclaim and expiry behavior

Expired worker jobs and expired provider sync runs may be reclaimed safely.

Reclaim behavior is canonical:

1. active unexpired owners block a new claim
2. expired owners may be reclaimed
3. reclaim increments version
4. reclaim rotates token
5. reclaim records reclaim metadata
6. stale owners are rejected after reclaim

Worker reclaim remains bounded by the existing retry and dead-letter policies. This phase does not redesign queue scheduling.

## 4. Stale-owner rejection rules

The runtime now rejects:

- stale heartbeat extension after reclaim
- stale completion after reclaim
- stale failure write after reclaim
- stale provider release after reclaim
- stale provider completion or failure after reclaim
- duplicate active claim overwrite by a second worker

This prevents the primary stale-owner race identified in the runtime audits: a worker that read an old lease can no longer revive it after another worker has safely reclaimed it.

## 5. Crash and recovery model

Crash recovery continues to use at-least-once execution, but it now converges more safely:

1. crashed workers lose authority once their lease expires
2. reclaimed jobs receive a new claim token
3. the old worker cannot heartbeat, complete, or fail the reclaimed job
4. retry scheduling still uses deterministic backoff
5. dead-letter routing remains explicit and bounded

The runner now uses the claimed lease timeline during execution so heartbeat and completion mutations remain coherent under replayable tests and deterministic recovery flows.

## 6. Replay and idempotency interaction

This phase preserves prior guarantees:

1. idempotent enqueue identity remains unchanged
2. retry schedule calculation remains deterministic
3. durable outbox replay behavior remains unchanged
4. canonical mutation and event persistence guarantees from Phase 5 remain intact

Lease hardening narrows the ownership race surface without introducing a second orchestration system.

## 7. Ownership audit visibility

Operational records now expose:

- current owner
- current token
- current version
- claim timestamp
- last heartbeat timestamp
- reclaim timestamp
- reclaim owner
- reclaim count

This is intended for diagnostics, replay analysis, and operator trust, not for queue UX redesign.

## 8. Provider runtime hardening

Provider sync run ownership now follows the same rules as worker jobs:

1. claims have expiry
2. claims have token/version identity
3. overlapping active claims are rejected
4. expired claims can be reclaimed
5. stale owners cannot release or complete reclaimed runs

This closes the preexisting gap where provider sync claims were just last-write-wins metadata updates.

## 9. Remaining known limitations

This phase intentionally does not implement:

- autonomous subscriber productionization
- queue scheduling redesign
- SLA runtime productionization
- unified timeline work
- AI governance work
- orchestration redesign

Also unchanged:

1. dead-letter record creation is still a separate durable record from the job status mutation
2. this phase hardens ownership semantics, not the entire multi-record runtime transaction model

## 10. Relationship to later phases

### Phase 7

Subscriber productionization can now rely on stronger lease ownership semantics.

### Phase 8

Unified timeline work can consume clearer reclaim and ownership lineage.

### Phase 9

SLA runtime layering can build on the hardened worker substrate rather than introducing new claim logic.

### Phase 10

AI governance can operate on canonical persisted runtime artifacts with stronger replay and ownership evidence.
