# Master Platform Runtime Audit

Date: 2026-05-07
Scope: consolidated assessment of all audit reports in `docs/audits/`
Method: synthesis of existing static architecture/runtime/security/UX audits only; no code changes

## 1. Executive summary

The platform is architecturally serious, not fragile. It already has the shape of a durable operational system: service/repository separation, canonical domain-event infrastructure, a real worker queue, lease/dead-letter concepts, intake review boundaries, communications primitives, role-aware portals, and a strong bias toward explicit domain services.

The limiting factor is not lack of ideas or missing foundational abstractions. The limiting factor is **incomplete canonicalization at the seams where automation would multiply mistakes**:

- work-order authority is still split across multiple mutation services
- route/service authorization is not enforced consistently
- event emission is not atomic with authoritative mutations
- some idempotency paths still use read-then-create instead of transactional uniqueness
- provider ingress is not tenant-safe enough yet
- communications/timeline visibility is not yet unified
- worker lease mutation and provider sync claim semantics are not yet strong enough for unattended multi-worker execution

Bottom line:

- The platform is ready for a disciplined stabilization program.
- It is ready for operator-driven runtime work and controlled internal evolution.
- It is **not yet ready for broad autonomous orchestration, SLA automation, or AI-driven operational coordination** without hardening the canonical mutation, authorization, replay, and tenant-boundary layers first.

## 2. Overall architecture maturity score

**6.1 / 10**

Reasoning:

- Strong bounded-context intent and service layering
- Meaningful canonical runtime/event/intake/provider foundations
- Still weakened by split lifecycle authority, duplicate mutation paths, and transitional authorization/persistence surfaces

## 3. Operational runtime maturity score

**5.4 / 10**

Assessment:

- good queue/dead-letter/diagnostics substrate
- partial runtime readiness for manual and operator-driven execution
- not yet fully safe for unattended concurrency, replay, and autonomous subscriber execution

## 4. AI governance maturity score

**6.0 / 10**

Assessment:

- good review-first architecture and no direct AI mutation of authoritative work orders
- still incomplete on AI actor attribution, decision durability, provenance validation, and post-conversion linkage

## 5. Provider/runtime maturity score

**5.1 / 10**

Assessment:

- correct architectural direction: providers normalize into canonical artifacts instead of mutating operational entities
- major ingress trust, atomicity, replay-window, and reconciliation weaknesses remain

## 6. Security/multi-tenant maturity score

**4.8 / 10**

Assessment:

- strong policy foundations
- current posture held back by authorization bypasses, over-broad portal/runtime projections, attachment leakage, and unauthenticated tenant-selectable provider ingress

## 7. Operational UX maturity score

**5.6 / 10**

Assessment:

- good low-volume readability and role separation
- weak queue ergonomics, weak internal timeline/communications experience, and low reviewer throughput at scale

## 8. Biggest architectural strengths

1. The platform already has a credible canonical spine: domain services, durable events, runtime jobs, leases, dead-letter handling, intake review, and visibility-aware read surfaces.
2. The architecture generally routes new operational domains in the right direction: provider ingestion to intake/communications, AI to review-first workflows, and downstream automation through events/jobs.
3. The runtime substrate is ahead of most systems at this stage. Queue state, retry scheduling, diagnostics, replay, and operator repair concepts already exist.
4. The codebase shows strong architectural intent toward explicit bounded contexts rather than accidental monolith coupling.
5. The audit corpus is internally consistent. Different reviews repeatedly identify the same canonical blockers, which makes prioritization unusually clear.

## 9. Biggest remaining architectural risks

1. Split work-order mutation authority across work-order, quote, assignment, and invoice services.
2. Authorization bypasses on active mutation routes plus service methods that trust callers.
3. Non-atomic mutation-plus-event persistence creating missing-event and partial-audit windows.
4. Non-atomic idempotency in runtime/provider/intake flows under concurrent delivery.
5. Unauthenticated tenant-selectable provider webhook ingress.
6. Separate timeline/communication/note/attachment read paths causing visibility drift and operator inconsistency.
7. Lease mutation races and weak provider sync claim semantics before continuous workers are enabled.

## 10. Hidden coupling findings

1. Quote, invoice, and assignment services embed work-order state side effects instead of publishing intent to a single work-order authority.
2. Provider webhook handling both records durable events and directly enqueues receipt-processing jobs, creating duplicate initiation authority.
3. Work-order attachments/notes still bridge legacy persistence plus newer communication/event surfaces, creating non-transactional multi-write behavior.
4. Intake review queue remains a read-time projection rather than a durable claimable operational queue.
5. Internal operational understanding still depends on UI composition across separate timeline, communication, note, attachment, quote, and finance paths.

## 11. Replay/idempotency findings

1. Subscriber replay is directionally safe because `(subscriberKey, sourceEventId)` processing is durable and jobs carry `idempotencyKey`, `correlationId`, `causationId`, and `sourceEventId`.
2. Event production is not replay-safe enough because authoritative state and corresponding events/audits do not commit atomically.
3. `recordTransition` can duplicate transition triplets on retry because writes are sequential and not idempotent by a stable transition key.
4. Core creation paths still use check-then-create instead of transactional uniqueness:
   - runtime jobs
   - provider webhook events
   - provider receipts
   - intake/provider ingress receipts
5. Replay/reconciliation for provider data is still bounded by recent-window scans, which is unsafe for long-lived tenants and deep threads.
6. Timeline ordering is not deterministic for same-timestamp writes because random document IDs act as tie-breakers.

## 12. Orchestration readiness findings

Assessment: **partial architecture readiness, low production readiness**

1. Durable events plus subscriber registry is the correct orchestration shape.
2. There is not yet one canonical always-on autonomous event-consumption loop.
3. Subscriber registry and worker handler registry are not fully closed; some job types can enqueue without production handlers.
4. Route-time direct enqueue behavior still exists in places that should eventually rely only on durable event subscribers.
5. Enabling autonomous subscribers now would create avoidable dead-letter churn and ambiguity about orchestration authority.

## 13. Worker-runtime readiness findings

Assessment: **close for controlled/manual use, not ready for unattended scale-out**

1. Queue, claim, dead-letter, retries, bounded execution, and diagnostics are materially real.
2. `claimNext`/`claimById` use transaction-backed claiming, which is a strong base.
3. `markRunning` and `extendLease` are not compare-and-swap safe, leaving stale-owner race windows.
4. Provider sync run claim/release does not yet meet the same lease-safe standard as the canonical worker queue.
5. External ingress tenant resolution is not safe enough to support autonomous provider work at scale.

## 14. SLA-runtime readiness findings

Assessment: **good substrate, incomplete operational chain**

1. SLA timer concepts, ids, supersession protection, and persisted evidence are strong.
2. The timer substrate depends on event-subscriber execution that is not yet continuously driven.
3. Timer/job attachment and some timer transitions are still separate writes rather than one atomic unit.
4. SLA automation is therefore architecturally promising but not yet operationally trustworthy end to end.

## 15. Recommended stabilization work before orchestration

1. Enforce one canonical work-order mutation service and remove direct work-order writes from quote, invoice, and assignment services.
2. Move authorization enforcement into canonical mutation services, then repair all route-level guards.
3. Replace read-then-create idempotency with transactional unique-key creation for jobs, receipts, webhook events, and replay commands.
4. Introduce an atomic mutation-plus-event boundary:
   - transaction where practical
   - durable outbox where cross-entity transactional limits apply
5. Remove route-level direct enqueue paths that duplicate subscriber authority.
6. Convert lease mutation operations and provider sync run claims to compare-and-swap semantics with reclaim safety.
7. Lock down provider ingress:
   - no caller-supplied organization selection
   - no `"org-1"` fallback
   - canonical provider authenticity validation
8. Close subscriber/handler gaps before continuous event consumption is enabled.
9. Unify operational timeline and communication visibility into one canonical projection model.
10. Add regression tests for duplicate delivery, replay, lease expiry, route authorization bypass, and external visibility boundaries.

## 16. Recommended next architecture programs

1. Canonical lifecycle and mutation authority consolidation
2. Security and tenant-boundary hardening
3. Transactional event/outbox and replay-hardening program
4. Worker lease and provider-sync substrate hardening
5. Unified operational timeline and communications consolidation
6. Durable orchestration subscriber productionization
7. SLA and escalation production runtime
8. Intake reviewer control-plane and AI governance hardening
9. Portal-safe projection and external collaboration maturity
10. Reporting, scorecards, and operational intelligence foundation

## 17. Recommended execution order

1. Security boundary fixes
2. Canonical mutation authority consolidation
3. Atomic event/idempotency hardening
4. Lease/claim/runtime substrate hardening
5. Subscriber/handler closure and event-consumption productionization
6. Unified timeline/communications model
7. SLA and escalation runtime
8. Intake/AI governance hardening
9. UX workbench and queue scalability improvements
10. Reporting/intelligence programs

## 18. Technical debt prioritization

**Tier 0: block before autonomous runtime**

1. Provider webhook tenant/auth weakness
2. Work-order mutation authorization bypasses
3. Split work-order mutation authority
4. Non-atomic idempotent creation paths
5. Lease mutation race windows
6. Missing worker handlers for subscriber-enqueued jobs

**Tier 1: block before orchestration scale**

1. Non-atomic mutation/event persistence
2. Timeline/communications visibility drift
3. Provider replay/reconciliation recent-window scans
4. Provider sync claim semantics
5. Legacy note/attachment persistence paths

**Tier 2: block before AI and external collaboration scale**

1. Incomplete intake reviewer permission model
2. Incomplete AI attribution and decision durability
3. Portal/runtime projection overexposure
4. Attachment visibility misalignment
5. Weak direct provenance links after intake conversion

**Tier 3: scale and intelligence debt**

1. Coarse replay tooling
2. Queue/workbench UX limits
3. Missing reporting projections and scorecards
4. Inline large payload storage instead of blob/artifact references

## 19. Runtime safety assessment

Current runtime safety is **acceptable for operator-driven bounded execution** and **not yet acceptable for unattended autonomous execution**.

Why:

- good dead-letter and bounded retry concepts exist
- duplicate delivery and replay safety are not yet fully guaranteed
- authoritative mutation and audit/event persistence can diverge under partial failure
- ingress trust and tenant binding are not yet strong enough at provider boundaries
- lease mutation races remain unresolved

## 20. Long-term scalability assessment

Long-term scalability is **good in architecture direction, moderate in current implementation maturity**.

The platform can scale into a multi-domain operations system because it already favors:

- explicit bounded contexts
- durable operational artifacts
- server-side permissions
- queue/event-driven runtime design
- review-first AI governance

The main scalability risk is not Firestore or Next.js by itself. The real risk is carrying forward **split authority and transitional paths** into a larger runtime. If those are removed now, the platform has a strong path to scale operationally, organizationally, and functionally.

## 21. Go / caution / no-go recommendations

### Worker runtime

**Caution**

- Go for manual/operator-driven processing and bounded internal rollout
- No-go for broad unattended multi-worker concurrency until lease and idempotency hardening lands

### SLA engine

**Caution**

- Go for continued substrate development and controlled non-autonomous evaluation
- No-go for production breach enforcement until continuous subscriber execution and timer/job atomicity are hardened

### Orchestration subscribers

**No-go**

- Subscriber architecture is right
- Production autonomous enablement should wait for handler closure, direct-enqueue removal, and atomic replay/idempotency fixes

### Autonomous coordination

**No-go**

- Too much split authority and visibility drift remains for safe autonomous operational action

### AI operational intelligence

**Caution**

- Go for read-only summaries, recommendations, and reviewer-assistive intelligence over canonical persisted artifacts
- No-go for authoritative AI-driven operational state changes or autonomous coordination

## 22. Recommended next 10 implementation phases/prompts

### Phase 1: External boundary lockdown

Prompt:
Lock down provider and portal trust boundaries by removing caller-selected tenant resolution, eliminating the `"org-1"` fallback, tightening external read projections, and adding regression tests for all identified authorization/visibility leaks.

### Phase 2: Canonical work-order mutation authority

Prompt:
Refactor work-order lifecycle mutation so all authoritative `workOrders` changes route through one canonical domain service, then delete direct mutation paths from quote, invoice, and assignment services.

### Phase 3: Authorization consolidation

Prompt:
Move actor authorization into canonical mutation services, repair route-level guards, collapse legacy/new policy split-brain, and add end-to-end tests for update, transition, and assignment denial paths.

### Phase 4: Atomic idempotency substrate

Prompt:
Replace read-then-create idempotency with transactional unique-key creation for runtime jobs, provider webhook events, provider receipts, and intake ingress artifacts, with duplicate-delivery tests under concurrency.

### Phase 5: Atomic event and audit persistence

Prompt:
Introduce a canonical mutation-plus-event boundary using transactions or an outbox so authoritative state, domain events, and transition audits cannot drift under partial failure or retry.

### Phase 6: Lease and claim hardening

Prompt:
Upgrade worker lease mutation and provider sync claim/release to compare-and-swap semantics with reclaim safety, expiry handling, and multi-worker crash/retry tests.

### Phase 7: Subscriber productionization

Prompt:
Close subscriber/handler gaps, introduce one canonical autonomous event-consumption loop, and delete redundant direct enqueue paths so orchestration has a single runtime authority.

### Phase 8: Unified operational timeline

Prompt:
Create one canonical operational timeline projection that merges domain events, communications, intake/provider provenance, and attachment/note history with role-consistent visibility filtering.

### Phase 9: Intake and AI governance hardening

Prompt:
Harden intake review permissions, make all reviewer-visible outcomes decision-durable, add explicit AI actor attribution and provenance validation, and persist strong back-references from converted work orders to intake approvals and drafts.

### Phase 10: SLA, escalations, and operator workbench

Prompt:
Enable SLA and escalation runtime on top of the hardened worker/event substrate, then add operator workbench UX for intake review, queue ownership, duplicate comparison, and timeline-centered coordination.

## Conclusion

The platform is closer to a production-grade operations architecture than to an early-stage app. The remaining gap is concentrated in a narrow set of runtime-critical seams: canonical mutation authority, authorization consistency, idempotent creation, atomic event durability, tenant-safe ingress, and lease-safe execution.

If those seams are stabilized first, the platform has a credible path to safe orchestration, operational AI assistance, and long-term scale. If they are deferred, every new automation layer will amplify drift that is already visible in the audit set.
