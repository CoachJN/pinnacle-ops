# Operational Durability & Runtime Readiness Audit

Date: 2026-05-07

## 1. Runtime readiness assessment

### Executive summary

The platform is **architecturally ahead of where most apps are before async runtime work begins**, but it is **not yet fully runtime-ready for autonomous production execution**.

What is already strong:

- One canonical worker queue exists in `runtimeJobs`, with dead-letter storage, retry scheduling, correlation fields, and diagnostics.
- Durable domain events, subscriber processing records, SLA timer records, scheduler task records, provider sync checkpoints, provider sync runs, and provider receipt records all exist as explicit persisted artifacts.
- The runtime has a credible operator surface for diagnostics, replay, repair, and manual bounded execution.
- The runtime-loop control plane, allocator/claim substrate, and worker daemon coordination show that the repo is already aiming at lease-safe continuous execution rather than request-time pseudo-background work.

What keeps this from being production-ready for autonomous workers:

- Several critical idempotency paths still use non-atomic read-then-create logic rather than a transaction or unique-key write.
- Multiple canonical state changes and their corresponding events are persisted as separate writes, so crash/retry windows can leave durable partial state.
- Event subscribers exist, but there is no canonical autonomous event-consumption loop yet; most event processing is still operator-triggered.
- Some subscriber definitions enqueue job types that do not have production handlers.
- Provider polling/sync records do not yet have true lease-safe claim semantics.
- A few request-time paths still directly enqueue or coordinate runtime work, which will become architectural coupling once continuous subscribers/workers are enabled.

Assessment: **Partially ready. Safe for manual/operator-driven bounded execution. Not yet ready to turn on unattended polling/orchestration/SLA automation without hardening the concurrency and claim boundaries first.**

## 2. Idempotency/replay assessment

### Current strengths

- Worker jobs carry stable `idempotencyKey`, `correlationId`, `causationId`, and `sourceEventId`, and retries route through one canonical queue path in `src/modules/runtime/server/worker-runtime-service.ts`.
- Job claiming is transaction-backed in Firestore for `claimNext` and `claimById`, which is the right substrate for at-least-once execution in `src/server/repositories/firestore/repositories.ts:1819-1925`.
- Event subscriber processing records are durable and keyed by `(subscriberKey, sourceEventId)`, which gives replay context and duplicate suppression in `src/modules/runtime/server/event-subscriber-service.ts:102-183`.
- SLA timers use stable timer-level idempotency keys and superseded-job protection through `runtimeJobId` matching in `src/modules/sla/server/sla-timer-service.ts:63-117` and `149-201`.
- Dead-letter replay is explicit operator action rather than hidden automatic recovery in `src/modules/runtime/server/dead-letter-replay-service.ts:27-77`.

### Durability gaps

#### Non-atomic idempotency checks

Several core paths still do `find existing` and then `create`, which is not safe under concurrent delivery:

- Worker job enqueue checks for an existing idempotency key and then creates the job in separate operations in `src/modules/runtime/server/worker-runtime-service.ts:139-153` and `193-202`.
- Provider webhook ingestion checks for existing webhook/receipt idempotency keys and then creates new records in separate operations in `src/modules/provider-runtime/server/provider-webhook-runtime.ts:48-80` and `116-152`.
- Intake/provider ingestion does duplicate detection before creating a new provider receipt, but the detection and receipt creation are not one atomic unit in `src/server/services/intake-service.ts:881-925` and `1889-1928`.

This means duplicate queue entries, duplicate receipts, and duplicate ingestion artifacts remain possible under concurrent retries or multi-worker delivery.

#### Replay after partial failure is not fully reconstructible

Inbound provider ingestion is a multi-step sequence:

1. create intake event
2. create communication records
3. create intake artifact
4. create provider receipt
5. emit follow-on events

That sequence is implemented as separate writes in `src/server/services/intake-service.ts:964-1117`. If a failure occurs after some canonical artifacts have been created but before the receipt is persisted or linked, the catch block creates a failed receipt with null canonical links in `src/server/services/intake-service.ts:1117-1151`. Replay can then re-enter ingestion without first reconciling those partial artifacts, so duplicate intake/communication records are possible.

#### Replay payload storage is durable but not operationally scalable

Replay payloads are stored inline in Firestore receipt metadata as `metadata.replayPayload` in `src/server/services/intake-service.ts:1918-1924`. The same ingestion path also stores raw normalized payload JSON in `IntakeArtifact.rawContent` in `src/server/services/intake-service.ts:1008-1018`.

That is convenient for replay, but it is not aligned with the repo’s own durability rules for large payload snapshots. It will eventually become a document size, indexing, and recovery-surface risk.

Assessment: **Replay model is conceptually sound, but idempotency enforcement is not yet strong enough for true duplicate-delivery safety under production concurrency.**

## 3. Orchestration readiness assessment

### What is ready

- The domain-event model is the correct orchestration anchor. Work flows through durable events, then subscriber records, then runtime jobs.
- The subscriber registry already encodes a sensible event chain:
  - SLA scheduling
  - SLA breach to escalation
  - escalation to delivery planning
  - delivery to transport execution
  - provider receipt to reconciliation

This is visible in `src/modules/runtime/server/event-subscriber-registry.ts:47-332`.

### What is not ready

#### No autonomous subscriber-consumption path yet

The only general event replay/processing path I found is operator-driven:

- `POST /api/runtime/operator/events/process`
- `EventReplayService.replay(...)`

See `src/app/api/runtime/operator/events/process/route.ts` and `src/modules/runtime/server/event-replay-service.ts:25-58`.

That means the event subscriber layer is durable, but not yet continuously consuming events. For upcoming orchestration subscribers, this is the biggest gap between “designed” and “operational.”

#### Subscriber registry and handler registry are out of sync

The subscriber registry can enqueue `provider.replay` and `intake.followup` jobs in `src/modules/runtime/server/event-subscriber-registry.ts:280-330`, but the production worker handler registry does not register handlers for either job type in `src/server/api/runtime.ts:75-131`.

If autonomous subscriber processing is enabled as-is, those jobs will enqueue successfully and then churn through retries/dead-letter due to missing handlers.

#### Parallel enqueue paths already exist for provider receipt processing

`provider_receipt_recorded` is modeled as a subscriber-triggered job in `src/modules/runtime/server/event-subscriber-registry.ts:250-278`, but the Microsoft webhook route also directly enqueues `provider.receipt.process` in `src/app/api/provider-runtime/webhooks/microsoft/route.ts:41-58`.

Today this is partly masked by shared idempotency keys, but it is still a duplicate orchestration responsibility. Once continuous event subscribers exist, that route-level enqueue becomes a parallel workflow path.

Assessment: **Event-driven orchestration architecture is good, but production orchestration readiness is only partial because subscriber execution is not yet autonomous and the subscriber/handler contract is not fully closed.**

## 4. SLA runtime readiness assessment

### What is ready

- The SLA timer model is canonical, typed, and persisted.
- Timers use stable ids and one-timer-per-work-order idempotency keys in `src/modules/sla/server/sla-timer-service.ts:63-117`.
- Immediate and due-time evaluation jobs attach back to the timer, and stale jobs are rejected by `runtimeJobId` supersession in `src/modules/sla/server/sla-timer-service.ts:139-201`.
- The evaluation handler reads persisted evidence rather than inferred UI state.

### What is not ready

- SLA creation depends on the event-subscriber bridge, but that bridge is not yet continuously driven.
- There is no canonical always-on event processor that guarantees every `work_order_created`, internal lifecycle transition, or internal communication event will be translated into SLA work without operator intervention.
- Timer state transitions and timer-job attachment are persisted as separate writes rather than one atomic unit, so a crash can leave timer/job drift.

Assessment: **The SLA timer substrate itself is strong. The missing piece is continuous event consumption plus tighter transactional guarantees around timer/job attachment.**

## 5. Retry/recovery assessment

### What is ready

- Worker retries are explicit, bounded, and use backoff/jitter through `calculateWorkerRetrySchedule(...)` in `src/modules/runtime/server/worker-runtime-service.ts:363-387`.
- Exhausted or non-retryable jobs route to dead-letter storage in `src/modules/runtime/server/worker-runtime-service.ts:315-360`.
- Dead-letter replay is an explicit operator action, not a hidden repair loop, in `src/modules/runtime/server/dead-letter-replay-service.ts:27-77`.
- Runtime diagnostics, replay, repair, and health routes are read-only unless explicitly invoked through operator APIs.

### Recovery gaps

#### Runtime state changes and runtime events are not atomic

Examples:

- job enqueue creates the job and then records `runtime_job_queued` in separate writes in `src/modules/runtime/server/worker-runtime-service.ts:193-202`
- job failure writes error/dead-letter state and then records events in separate writes in `src/modules/runtime/server/worker-runtime-service.ts:289-355`
- transition auditing writes `transitionAudits`, then `transitionEvents`, then `domainEvents` in sequence in `src/server/services/domain-event-service.ts:142-185`
- provider reconciliation updates attempt, plan, receipt, and then emits events in sequence in `src/modules/provider-runtime/server/provider-reconciliation-service.ts:141-179`

If a worker crashes or Firestore partially fails mid-sequence, operators can recover, but the persisted record set may be causally incomplete.

#### Event replay tooling is bounded, but still coarse

`EventReplayService` replays by explicit event id or by the latest `N` org events in `src/modules/runtime/server/event-replay-service.ts:25-58`. There is no cursor-range replay, failure-only replay, subscriber-specific replay window, or “resume from last failed event” operator primitive yet.

Assessment: **Retry policy and dead-letter handling are materially ahead of average. Recovery tooling exists, but transactional consistency between canonical mutations and their runtime/event side effects is still the main weakness.**

## 6. Worker-runtime readiness assessment

### What is ready

- Canonical queued/leased/running/dead-letter statuses exist.
- Job claim acquisition is transaction-backed and recoverable in `src/server/repositories/firestore/repositories.ts:1819-1925`.
- The worker runner supports bounded processing, optional heartbeats, dry-run diagnostics, and handler-based execution in `src/modules/runtime/server/worker-runner-service.ts:42-170`.
- Runtime loops, allocator execution, claim windows, and worker-daemon coordination are already modeled as explicit persisted control-plane state rather than ad hoc background code.

### Worker-readiness gaps

#### `markRunning` and `extendLease` are not compare-and-swap safe

Both operations read the current job and then save an updated document outside a transaction in `src/modules/runtime/server/worker-lease-service.ts:32-70`.

That leaves a race:

- worker A reads the leased job
- lease expires
- worker B reclaims the job transactionally
- worker A still writes `running` or extends lease based on stale ownership

This is a serious readiness issue for true multi-worker continuous execution.

#### Provider sync run claiming is not lease-safe

Provider sync run claim/release currently just overwrites claim metadata in `src/server/services/provider-service.ts:691-725`. There is no lease expiry, no compare-and-swap ownership check, and no reclaim semantics.

That means the current sync run/checkpoint model is **not yet ready** to be the authoritative substrate for concurrent polling workers.

#### Missing tenant-safe resolution at an external ingress boundary

The Microsoft webhook route will fall back to `"org-1"` if it cannot resolve an organization from headers or payload in `src/app/api/provider-runtime/webhooks/microsoft/route.ts:21-24`.

That is not safe enough for autonomous multi-tenant runtime operation. External ingress must resolve tenant/organization canonically or reject the event.

Assessment: **The generic worker queue is close. The remaining blocker is not the queue itself, but lease mutation races and the weaker provider-sync claim model.**

## 7. Hidden coupling findings

1. `provider.receipt.process` can be enqueued from two places.
   Direct route-time enqueue exists in `src/app/api/provider-runtime/webhooks/microsoft/route.ts:41-58`, while the subscriber registry also maps `provider_receipt_recorded` to the same job in `src/modules/runtime/server/event-subscriber-registry.ts:250-278`.

2. Event-driven orchestration is only partially canonicalized.
   Some flows use durable events plus subscribers, but provider webhook handling still coordinates job enqueue directly in the route rather than relying on the subscriber bridge.

3. Review queue state is still a query-time projection.
   `listReviewQueue(...)` in `src/server/services/intake-service.ts:715-760` fans out across intake events and drafts at read time. That is acceptable for a human dashboard, but it is not a durable claimable queue for SLA or orchestration workers.

4. Attachment hydration success is not tied to guaranteed blob persistence.
   `hydrateAttachment(...)` can mark an attachment `hydrated` based on metadata/hash updates without a guaranteed canonical blob write in `src/server/services/provider-service.ts:1006-1046`.

5. Timeline consistency is canonical for work-order events, but not yet unified across all operational artifacts.
   `timeline-service` reads only domain events in `src/server/services/timeline-service.ts:29-38`. Intake/provider communication detail views still compose multiple stores at read time rather than reading one unified operational timeline.

## 8. Operational durability risks

### High risk

- Concurrent duplicate creation of runtime jobs, provider webhook events, provider receipts, and inbound provider receipts because idempotency is not enforced atomically.
- Partial canonical mutation sequences across events/audits/attempts/receipts/plans leading to replay ambiguity after crash or partial write failure.
- Missing compare-and-swap protection on worker lease mutation and provider sync run claim mutation.
- Subscriber definitions can enqueue unhandled job types, which would create dead-letter noise the moment autonomous event processing is turned on.
- External webhook fallback to `"org-1"` creates tenant-boundary risk.

### Medium risk

- Replay payload snapshots and raw ingestion payload storage are inline Firestore payloads rather than blob/artifact references.
- Review queue projection is not a durable operational queue and will not scale cleanly into claim/lease/SLA semantics.
- Attachment hydration does not guarantee durable content persistence before `hydrated` status is recorded.
- Event replay tooling is still coarse for large-scale operational recovery.

### Low risk

- The architecture docs are more mature than some implementation seams. That is a process risk because it can create a false sense of runtime readiness.

## 9. Recommended corrective actions

### Priority 0: block before autonomous runtime enablement

1. Make idempotent creation atomic for:
   - `runtimeJobs`
   - inbound `providerMessageReceipts`
   - outbound `providerReceipts`
   - `providerWebhookEvents`
   - any future replay/repair command records

   Recommended pattern:
   - stable deterministic document ids or dedicated unique-key documents written transactionally
   - no read-then-create without a transaction

2. Convert lease mutation operations to compare-and-swap transactions for:
   - `markRunning`
   - `extendLease`
   - provider sync run claim/release
   - any future checkpoint advancement tied to worker ownership

3. Remove the `"org-1"` fallback from webhook ingress and require canonical tenant/org resolution before any durable write.

4. Add production handlers or remove subscriber definitions for `provider.replay` and `intake.followup` before enabling continuous subscriber execution.

### Priority 1: make orchestration and replay truly durable

5. Introduce one canonical autonomous event-consumption cadence on top of the subscriber runtime, then delete or retire route-level direct enqueue paths that become redundant.

6. Wrap multi-record mutation bundles in a transactional/outbox-style pattern for:
   - transition audit + transition event + domain event
   - provider reconciliation convergence
   - inbound provider ingestion finalization
   - SLA timer creation + runtime job attachment

7. Add a reconciliation/repair path for partially completed provider ingestions so failed attempts can relink or supersede orphaned intake/communication artifacts rather than duplicating them.

### Priority 2: harden provider polling/runtime substrate

8. Add lease expiry, ownership checks, and reclaim rules to provider sync runs and checkpoint advancement.

9. Ensure checkpoints advance only after durable canonical ingestion completion and only by the active lease owner.

10. Add explicit retry policy, dead-letter model, and diagnostics for provider polling work before enabling unattended polling workers.

### Priority 3: improve recovery ergonomics and artifact durability

11. Move large replay payload snapshots and raw ingestion payloads to blob/artifact references rather than inline Firestore metadata.

12. Require attachment hydration to persist a canonical blob/artifact reference before marking `hydrated`.

13. Add richer replay tooling:
   - replay by subscriber key
   - replay failed-only windows
   - replay by time range/cursor
   - replay from an operator-selected checkpoint

14. Add concurrency tests specifically for:
   - simultaneous enqueue with same idempotency key
   - duplicate webhook delivery races
   - expired-lease reclaim versus stale heartbeat extension
   - provider sync run double-claim attempts
   - failed ingestion replay after partial canonical writes

## Final assessment

This codebase already has the shape of a real runtime platform:

- canonical queue
- dead-letter model
- durable events
- subscriber bridge
- SLA timers
- provider receipts
- scheduler and loop control plane
- repair/replay APIs

That is a strong foundation.

The remaining work is not “build a runtime from scratch.” It is “close the concurrency holes so the existing runtime is safe under duplicate delivery, crash recovery, and continuous autonomous execution.”

Current readiness by category:

- polling workers: **not ready**
- webhook workers: **partially ready**
- SLA timers: **partially ready**
- orchestration subscribers: **partially ready**
- retry/backoff: **mostly ready**
- dead-letter handling: **mostly ready**
- replay tooling: **partially ready**
- operational recovery: **partially ready**
