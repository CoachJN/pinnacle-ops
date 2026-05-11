# Event & Timeline Integrity Audit

Date: 2026-05-07

## Scope

Reviewed:

- `src/server/services/domain-event-service.ts`
- `src/server/services/timeline-service.ts`
- `src/server/repositories/firestore/repositories.ts`
- `src/server/services/work-order-service.ts`
- `src/server/services/assignment-service.ts`
- `src/server/services/communication-service.ts`
- `src/server/services/intake-service.ts`
- `src/server/services/provider-service.ts`
- `src/modules/provider-runtime/server/*`
- `src/modules/runtime/server/*`
- `src/modules/sla/server/*`
- `src/modules/escalation/server/*`
- `src/modules/delivery/server/*`
- `src/modules/transport/server/*`
- related tests under `src/tests/*`

## 1. Event architecture assessment

Assessment: Partially sound foundation, not yet operationally trustworthy as a single canonical architecture.

What is strong:

- Canonical durable `domainEvents` exist and are append-only by API shape (`src/server/services/domain-event-service.ts:101-123`).
- Lifecycle transitions also write dedicated `transitionEvents` and `transitionAudits` (`src/server/services/domain-event-service.ts:125-201`).
- Runtime subscriber processing is durable and idempotency-aware through `runtimeEventProcessings` (`src/modules/runtime/server/event-subscriber-service.ts` and `docs/architecture/event-subscriber-runtime.md`).
- Provider webhook and receipt ingestion use stable idempotency keys before creating runtime artifacts (`src/modules/provider-runtime/server/provider-webhook-runtime.ts:35-76, 103-138`).

What is structurally weak:

- Event production is not atomic with authoritative state mutation. Services persist domain state first, then write events afterward. A failed event write can leave canonical state changed without a matching event.
  - Work order create: `src/server/services/work-order-service.ts:321-339`
  - Work order transition: `src/server/services/work-order-service.ts:639-685`
  - Assignment create/status change: `src/server/services/assignment-service.ts:170-208, 409-430`
  - Communication message create: `src/server/services/communication-service.ts:352-422`
  - Intake event/artifact/draft flows: `src/server/services/intake-service.ts:380-389, 444-453, 2152-2166`
- `recordTransition` writes three durable records sequentially, not transactionally (`transitionAudits`, then `transitionEvents`, then `domainEvents`) (`src/server/services/domain-event-service.ts:193-195`).
- There are still parallel event architectures in the repo:
  - active canonical `DomainEventService`
  - legacy transition-service stack under `src/lib/workflows/transition-service/*`
  - legacy `activityLogs`
  These are not all part of one canonical runtime path.

## 2. Timeline architecture assessment

Assessment: Not unified; currently split across multiple read paths.

Current shape:

- Work-order activity timeline is just `domainEvents` filtered by `workOrderId` (`src/server/services/timeline-service.ts:27-38`, `src/server/services/domain-event-service.ts:204-218`).
- Communication timeline is queried separately from immutable communication messages and attachments (`src/server/services/communication-service.ts:575-613`).
- Intake review uses an entity timeline for `intake_event` plus separately loaded linked communication (`src/server/services/intake-service.ts:781-808`).

Integrity implications:

- There is no single unified durable timeline projection for operations, communications, intake, and provider evidence.
- Timeline reconstruction depends on querying different stores and manually combining them in callers, which invites role-specific inconsistency.
- Pre-work-order intake/provider communications are not visible from the later work-order timeline because those events are recorded with `workOrderId: null` (`src/server/services/intake-service.ts:1778-1818`), while the work-order timeline only queries by `workOrderId` (`src/server/services/domain-event-service.ts:204-209`).

## 3. Event emission coverage

Covered well:

- Work order creation (`src/server/services/work-order-service.ts:321-339`)
- Work order lifecycle transitions (`src/server/services/work-order-service.ts:639-685`)
- Assignment creation, accept, decline (`src/server/services/assignment-service.ts:170-208, 409-430`)
- Communication thread/message/link creation (`src/server/services/communication-service.ts:354-422`)
- Intake creation, artifact creation, review decisions, conversion events (`src/server/services/intake-service.ts:380-389, 444-453, 1337-1430, 2152-2166`)
- Provider connection and sync run milestones (`src/server/services/provider-service.ts:398-411, 603-617, 638-687`)
- Provider webhook/receipt capture (`src/modules/provider-runtime/server/provider-webhook-runtime.ts:78-97, 150-169`)
- Runtime worker lifecycle events (`src/modules/runtime/server/worker-runtime-service.ts:448-487`)
- SLA, escalation, delivery, transport runtime emissions

Partially covered:

- Quote and invoice workflows emit business milestone events, but not complete per-status transition audit records for quote/invoice status themselves (`src/server/services/quote-workflow-service.ts:276-285, 464-473, 542-551`; `src/server/services/invoice-service.ts:495-520`).

## 4. Missing event coverage

High-signal gaps:

- Work order updates do not emit events (`src/server/services/work-order-service.ts:353-423`).
- Internal staff reassignment does not emit events (`src/server/services/work-order-service.ts:426-467`).
- Direct work-order contractor assignment mutates assignment state and can mutate lifecycle state without any event (`src/server/services/work-order-service.ts:469-528`).
- `addNote` mutates the work order audit fields without creating a note event or note record (`src/server/services/work-order-service.ts:530-555`).
- Assignment reassignment silently cancels the current assignment with no cancellation event (`src/server/services/assignment-service.ts:279-289`).
- Assignment completion does not emit a canonical event; only accepted/declined do (`src/server/services/assignment-service.ts:409-430`).
- Communication attachment persistence does not emit a distinct canonical attachment event in the communication service (`src/server/services/communication-service.ts:440-487`).
- `communication_visibility_changed` exists in the event model but I did not find an active writer for it.
- Provider checkpoint lifecycle changes do not emit events:
  - checkpoint upsert/create/update (`src/server/services/provider-service.ts:459-566`)
  - sync run claim/release (`src/server/services/provider-service.ts:691-725`)
- Invoice draft creation/update and quote draft/rejection paths do not emit corresponding canonical events (`src/server/services/invoice-service.ts:264-356, 406-431`; `src/server/services/quote-workflow-service.ts:367-399, 525-604, 667-736`).

## 5. Replay/idempotency assessment

Assessment: Subscriber replay is reasonably safe; event production is not replay-safe enough yet.

Strong points:

- Subscriber processing skips succeeded `(subscriberKey, sourceEventId)` pairs unless forced (`src/modules/runtime/server/event-subscriber-service.ts`).
- Job enqueue uses stable idempotency keys and preserves `correlationId`, `causationId`, and `sourceEventId` (`src/modules/runtime/server/event-subscriber-service.ts`, `src/modules/runtime/server/event-to-job-service.ts`).
- Provider duplicate ingestion handling is explicit and tested (`src/server/services/intake-service.ts:884-920`, `src/tests/provider-webhook-deduplication.test.mts`).

Gaps:

- Event emission itself is not protected by an outbox/transactional boundary, so retried mutations can produce missing-event or duplicate-event outcomes depending on where failure happens.
- `recordTransition` is not idempotent by key and can produce duplicate triplets on retry (`src/server/services/domain-event-service.ts:125-201`).
- Batch replay only replays the most recent `N` organization events and has no cursor/watermark for full historical replay (`src/modules/runtime/server/event-replay-service.ts:36-57`).
- Replay ordering is only as stable as `occurredAt`; same-timestamp ordering falls back to random document IDs, which is not deterministic across independently written records (`src/server/services/domain-event-service.ts:316-323`).

## 6. Timeline consistency findings

- The main work-order timeline is not actually unified with communications.
  - domain events: `src/server/services/timeline-service.ts:27-38`
  - communications: `src/server/services/communication-service.ts:575-613`
- Intake review context exposes timeline and linked communication separately, so operator views can diverge depending on which screen they use (`src/server/services/intake-service.ts:781-808`).
- Duplicate-candidate review also loads work-order timeline and communications separately (`src/server/services/intake-service.ts:842-869`).
- Communication visibility is multi-valued, but event visibility is collapsed to a single enum via `toEventVisibility`, so the event stream can disagree with the canonical communication record about who should see it (`src/server/services/communication-service.ts:355-381` and `src/server/services/communication-service.ts:731-744`).
- Ordering is unstable for same-millisecond writes because both event and communication timeline sorts use random IDs as tie-breakers:
  - event timeline: `src/server/services/domain-event-service.ts:316-323`
  - communication timeline: `src/server/services/communication-service.ts:590-612, 722-730`
- Intake/provider-originated communication events recorded before work-order creation are not later re-anchored to the created work order (`src/server/services/intake-service.ts:1778-1818`).

## 7. Visibility/security findings

What is good:

- Domain-event visibility filtering is enforced server-side for internal/client/contractor/finance views (`src/server/services/domain-event-service.ts:297-314`).
- Communication visibility filtering is also enforced server-side on message reads (`src/modules/communications/domain/types.ts:186-209`, `src/server/services/communication-service.ts:590-612`).

Findings:

- Communication event visibility is lossy. A message with multiple audiences is flattened into one event visibility. Example: `["client", "contractor"]` becomes `client`, so contractor users may lose the corresponding timeline event even though they can read the underlying message.
- Because timeline and communications are separate, any screen that wants a “single timeline” must merge two differently filtered sources. That creates a recurring risk of accidental visibility drift.
- Finance-only communication visibility is modeled, but work-order timeline and communication timeline are still separate paths, so there is no single audited read model proving role-consistent merged output.

## 8. Actor attribution findings

- Domain events only support `system` or `user` at service-boundary level:
  - `ServiceActor` is `UserRole | "system"` only (`src/server/services/types.ts:10-17`)
  - `toEventActor` maps every non-system actor to `actorType: "user"` (`src/server/services/domain-event-service.ts:256-271`)
- Intake stored-actor helpers do the same (`src/server/services/intake-service.ts:2172-2205`).
- The event model includes `actorType: "ai"` and AI event types, but the writer layer cannot faithfully emit them. AI-generated operational artifacts would currently be attributed as user or require bypassing the service contract.
- Display names are generic role labels, not concrete principals, in the canonical event stream (`src/server/services/domain-event-service.ts:274-295`).

## 9. Operational auditability assessment

Assessment: Good building blocks, incomplete audit trail.

Strong points:

- Work-order lifecycle transitions have a dedicated audit record plus transition event plus domain event (`src/server/services/domain-event-service.ts:125-201`).
- Runtime jobs, provider receipts, delivery attempts, SLA timers, and escalations all emit meaningful operational events.

Weak points:

- Transition audit completeness is limited to work-order lifecycle transitions. Quote status changes, invoice status changes, assignment status changes, checkpoint changes, and sync-run claim/release do not have equivalent durable transition audits.
- Hidden side effects still exist without events, especially on mutable service methods noted above.
- There is no transaction/outbox boundary guaranteeing “authoritative mutation and audit/event emission succeeded together.”
- Legacy `activityLogs` remain present beside `domainEvents`, which weakens the claim that one canonical audit surface exists.

## 10. Architectural risks

1. Missing-event risk after successful authoritative mutation due to non-atomic write ordering.
2. Partial transition durability risk because `transitionAudits`, `transitionEvents`, and `domainEvents` are written sequentially.
3. Non-deterministic timeline ordering for same-timestamp events.
4. Unified timeline inconsistency because communications, intake provenance, and work-order events are split across separate query models.
5. Visibility drift because communication visibility is multi-valued but event visibility is single-valued.
6. Incomplete transition audit coverage outside work-order lifecycle.
7. Actor attribution drift for future AI-authored operations.
8. Replay incompleteness because batch replay only processes the newest bounded slice.

## 11. Recommended corrective actions

Priority 0:

- Adopt a single canonical event write boundary for all authoritative mutations.
- Use a transaction or durable outbox so domain mutation and event/audit persistence commit together.
- Make transition triplet writes atomic.

Priority 1:

- Define one canonical “operational timeline” read model that merges:
  - domain events
  - communication messages/attachments
  - intake/provider provenance
  - transition audits where needed
- Stop relying on screen-specific query composition for “unified” timeline behavior.

Priority 2:

- Fill emission gaps for:
  - work-order update
  - internal staff assignment
  - contractor assignment mutation on work order
  - assignment cancellation/completion/reassignment
  - communication attachment creation
  - provider checkpoint attempt/success/failure
  - provider sync claim/release
  - quote rejection and draft lifecycle
  - invoice draft lifecycle and void/viewed/overdue transitions

Priority 3:

- Replace single-valued communication-derived event visibility with a visibility model that preserves all audiences, or stop projecting communication visibility into a lossy event enum.
- Re-anchor intake/provider-originated pre-work-order provenance to the resulting work order through canonical linkage so the eventual work-order timeline can show full provenance.

Priority 4:

- Add stable ordering metadata to events written in the same logical unit.
  - example: sequence number within correlation scope or transaction-local ordinal
- Do not rely on random Firestore IDs as ordering tie-breakers.

Priority 5:

- Extend the service audit actor contract to support `ai` directly.
- Preserve concrete actor identity and display metadata in event writers, not just generic role labels.

Priority 6:

- Either fully retire the legacy transition-service/activity-log path from runtime architecture or explicitly mark it as non-canonical and remove remaining operational dependencies.

## Bottom line

The current platform has a credible canonical event foundation and a strong replay-safe subscriber substrate, but it does not yet meet the bar for deterministic, unified, fully auditable event/timeline integrity. The biggest blockers are non-atomic event production, incomplete emission coverage, split timeline projections, lossy visibility projection for communications, and incomplete actor/transition audit fidelity outside the work-order lifecycle.
