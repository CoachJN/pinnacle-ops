Date: 2026-05-07
Phase: 5 - Atomic Event & Audit Persistence

# Atomic Event & Audit Persistence

## 1. Canonical transaction boundary model

Phase 5 introduces a canonical datastore-backed mutation boundary in [atomic-persistence-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/atomic-persistence-service.ts).

The model is:

1. Authoritative mutation services build all authoritative entities and immutable event/audit records first.
2. Related writes are staged inside one transaction context.
3. Canonical domain-event dispatch intent is persisted as a durable outbox record in the same commit.
4. Downstream subscriber/job dispatch is replayed from durable persisted state rather than trusted as an in-memory side effect.

This preserves the existing canonical mutation and authorization architecture while removing the previous mutation/event drift window.

## 2. Authoritative mutation persistence strategy

The preferred hierarchy is now:

1. Single Firestore transaction for authoritative entity mutation plus immutable event/audit records.
2. Durable outbox creation in the same transaction for each persisted canonical domain event.
3. Explicit replay of pending outbox entries into subscriber processing when runtime dispatch must be recovered.

The hardened canonical surfaces now use this strategy:

1. `DomainEventService.record(...)`
2. `DomainEventService.recordTransition(...)`
3. `WorkOrderService.create(...)`
4. `WorkOrderService.transition(...)`
5. `WorkOrderService.apply*Workflow*` mutation methods when invoked inside a shared transaction boundary
6. Assignment create/status mutation paths
7. Quote submission/review/client-quote mutation paths
8. Invoice create/transition paths

## 3. Durable outbox model

Durable outbox entries are persisted in the `durableOutbox` collection.

Each record carries:

1. `correlationId`
2. `causationId`
3. `sourceEventId`
4. `idempotencyKey`
5. actor/entity context
6. durable status fields: `pending | processed | failed`
7. replay diagnostics: `processedAt`, `failureCount`, `lastError`

Current Phase 5 topic:

1. `domain_event_dispatch`

That topic represents durable intent to replay canonical domain events into subscriber processing.

## 4. Replay and recovery guarantees

Replay now relies on persisted canonical state, not best-effort in-process fan-out.

The explicit recovery path is [durable-outbox-replay-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/durable-outbox-replay-service.ts).

Guarantees:

1. If authoritative mutation commit fails, no corresponding event/audit/outbox records are committed.
2. If event/audit/outbox commit fails, the authoritative mutation transaction rolls back.
3. If runtime subscriber dispatch is interrupted after commit, the pending outbox record remains durable and replayable.
4. Replay remains bounded by existing event-processing idempotency and worker-job idempotency keys.

## 5. Mutation/event drift prevention strategy

The previous high-risk pattern was:

1. save authoritative mutation
2. then persist transition audit
3. then persist domain event
4. then hope later fan-out succeeds

The new canonical pattern is:

1. stage authoritative mutation
2. stage transition audit/event/domain event
3. stage durable outbox
4. commit once

This removes the partial-failure window where authoritative state could advance without its matching audit/event history.

## 6. Runtime scheduling durability model

Phase 5 does not introduce autonomous subscribers or a new scheduler architecture.

Instead it establishes a durable dispatch contract:

1. canonical domain events are persisted with outbox intent
2. subscriber processing can be replayed explicitly from outbox state
3. existing event-processing and worker-job idempotency continue to bound duplicate dispatch

This is the foundation for later subscriber productionization and orchestration hardening phases.

## 7. Intake/provider persistence guarantees

Phase 5 preserves the existing canonical intake/provider boundary:

1. providers create canonical intake/provider artifacts only
2. providers do not directly mutate authoritative work orders
3. intake review conversion still routes through `WorkOrderService`

Current hardening focus:

1. intake conversion now shares the same atomic-capable work-order/event persistence boundary
2. provider runtime keeps canonical receipts/events replay-safe and duplicate-safe

## 8. Transition audit atomicity guarantees

For work-order lifecycle changes, the following records are now staged together whenever the atomic boundary is active:

1. authoritative `workOrders` mutation
2. `transitionAudits` record
3. `transitionEvents` record
4. lifecycle `domainEvents` record
5. durable outbox dispatch intent

This applies to direct lifecycle transitions and to assignment/quote/invoice workflow-driven transitions when they participate in the shared atomic context.

## 9. Remaining known limitations

Phase 5 intentionally does not implement:

1. autonomous subscriber workers
2. lease/claim redesign
3. SLA runtime redesign
4. timeline projection unification
5. AI governance durability changes

Additional notes:

1. Some provider/intake communication-ingestion helper flows still rely on canonical idempotency and replay safety more than full multi-record transactional grouping.
2. Outbox replay is explicit operator/runtime service behavior, not yet an always-on autonomous loop.

## 10. Relationship to later phases

Phase 5 is the persistence foundation for:

1. Phase 6 - lease/claim hardening
2. Phase 7 - subscriber productionization
3. Phase 8 - unified operational timeline
4. Phase 9 - SLA runtime
5. Phase 10 - AI governance

Those later phases can now assume persisted canonical events and transition audits are trustworthy and replayable.
