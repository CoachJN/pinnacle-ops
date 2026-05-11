Date: 2026-05-07
Scope: mutation + event/audit persistence surfaces relevant to Phase 5
Method: static code audit plus implementation verification after atomic persistence hardening

# Atomic Persistence Surface Audit

## 1. Quick conclusion

Before Phase 5, the platform was broadly idempotent but still vulnerable to mutation/event drift because authoritative entity writes, transition audit writes, domain-event writes, and runtime dispatch intent were often persisted as separate steps.

After this pass:

1. canonical domain-event persistence has an atomic event + durable-outbox boundary
2. work-order creation and lifecycle transitions have an atomic authoritative mutation + audit/event boundary
3. assignment, quote, and invoice workflows can participate in the same shared transaction context when they bundle adjacent records with canonical work-order mutations
4. explicit durable outbox replay exists for subscriber/runtime recovery

## 2. Surface-by-surface status

### A. `WorkOrderService.transition(...)`

Authoritative mutation boundary:
`workOrders.save(...)`

Event/audit persistence:

1. `transitionAudits`
2. `transitionEvents`
3. lifecycle `domainEvents`
4. durable `durableOutbox` dispatch intent

Current transaction scope:
single atomic boundary when `atomicPersistence` is active

Drift risk:
removed for the authoritative mutation + audit/event bundle

Replay recovery:
pending outbox replay can re-drive subscriber processing

### B. `WorkOrderService.create(...)`

Authoritative mutation boundary:
`workOrders.create(...)`

Event persistence:

1. `work_order_created` domain event
2. durable outbox dispatch record

Current transaction scope:
single atomic boundary when `atomicPersistence` is active

Drift risk:
removed for work-order creation + event intent

### C. `DomainEventService.record(...)`

Authoritative boundary:
append-only canonical domain event

Event/audit persistence behavior:

1. immutable `domainEvents` record
2. matching durable outbox record

Current transaction scope:
single atomic boundary when `atomicPersistence` is active

Drift risk:
removed for event/outbox pairing

### D. `DomainEventService.recordTransition(...)`

Persistence bundle:

1. `transitionAudits`
2. `transitionEvents`
3. lifecycle `domainEvents`
4. durable outbox record

Current transaction scope:
single atomic boundary when `atomicPersistence` is active

Drift risk:
removed for transition audit/event intent

### E. Assignment workflow

Surfaces:

1. assignment create
2. assignment accept/decline status changes
3. canonical work-order assignment mutation

Current transaction scope:
assignment persistence can run inside the shared atomic boundary and route canonical work-order mutation through the same transaction context

Residual note:
reassign still composes multiple logical steps and remains more recovery-sensitive than the primary assign path

### F. Quote workflow

Surfaces:

1. contractor quote submission/review
2. client quote create/send/approve/reject
3. canonical work-order pointer and lifecycle changes

Current transaction scope:
quote persistence and canonical work-order mutation now share the same optional atomic context in the primary mutation paths

Residual note:
quote draft save remains a standalone draft write with no authoritative lifecycle advancement

### G. Invoice workflow

Surfaces:

1. invoice creation
2. invoice sent/paid/void transitions
3. canonical work-order finance lifecycle reactions

Current transaction scope:
invoice mutation and canonical work-order reaction now share the same optional atomic context in primary transition paths

### H. Intake approval conversion

Authoritative boundary:
human intake review decision plus canonical work-order conversion

Current status:
intake conversion still routes through canonical `WorkOrderService`

Residual note:
Phase 5 hardens the underlying work-order/event bundle, but the full intake review graph still has remaining opportunities for broader multi-record transactional consolidation in a later follow-up

### I. Provider webhook normalization and receipts

Authoritative boundary:
provider webhook event and canonical provider receipt persistence

Current status:
provider runtime remains duplicate-safe and replay-safe; full atomic bundling across every provider helper path is not yet universal

### J. Runtime orchestration and SLA scheduling

Current status:

1. runtime job enqueue remains durable and idempotent
2. canonical domain-event dispatch intent is now durably recorded in outbox
3. replay can explicitly re-drive subscriber processing from pending outbox state

This phase does not introduce autonomous outbox workers or redesign scheduler/runtime orchestration.

## 3. Remaining drift windows to monitor

1. intake communication-ingestion helper chains still contain multi-record sequences that would benefit from broader transaction-context propagation
2. provider webhook/runtime helper paths still rely on idempotent replay patterns in some branches rather than one universal atomic bundle
3. notification side effects remain intentionally outside the authoritative persistence transaction boundary

## 4. Verification references

Key regression coverage added/updated:

1. [atomic-persistence.test.mts](/home/craig/projects/pinnacle-ops/src/tests/atomic-persistence.test.mts:1)
2. [domain-event-service.test.mts](/home/craig/projects/pinnacle-ops/src/tests/domain-event-service.test.mts:1)
3. repo-wide `npm test` suite
