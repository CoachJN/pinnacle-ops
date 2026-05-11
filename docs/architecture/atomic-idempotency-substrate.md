# Atomic Idempotency Substrate

Date: 2026-05-07
Phase: 4
Scope: replay-safe and duplicate-safe creation for critical runtime and intake artifacts

## 1. Canonical pattern

Phase 4 standardizes one canonical creation pattern for replay-sensitive artifacts:

1. Build a stable logical identity from the canonical idempotency inputs.
2. Persist the artifact at that stable document id.
3. Treat create conflicts as duplicate delivery, then reload the canonical record.
4. Reject duplicate reuse only when the same idempotency identity is rebound to a different payload.

This replaces vulnerable read-then-create behavior on the critical paths hardened in this phase.

Helper utilities:

- `src/lib/idempotency/stable-entity-id.ts`
- `src/lib/idempotency/already-exists.ts`

## 2. Hardened surfaces

| Surface | Canonical key | Previous uniqueness behavior | Phase 4 behavior | Replay / duplicate result |
| --- | --- | --- | --- | --- |
| Runtime jobs | `organizationId + type + idempotencyKey` | read-then-create via `findJobByIdempotencyKey(...)` | stable job id + create-or-reload in `WorkerRuntimeService.enqueue(...)` | duplicate enqueue returns existing job |
| SLA timers | `organizationId + timer type + idempotencyKey` | read-then-create via `findByIdempotencyKey(...)` | stable timer id + create-or-reload in `SlaTimerService.createFirstResponseTimer(...)` | duplicate schedule returns existing timer |
| Provider webhook events | `organizationId + webhook idempotency key` | read-then-create in webhook runtime | stable webhook id + create-or-reload | duplicate webhook returns existing event |
| Provider reconciliation receipts | `organizationId + provider receipt idempotency key` | read-then-create in webhook runtime and adapter receipt capture | stable receipt id + create-or-reload | duplicate receipt returns existing receipt |
| Intake provider message receipts | provider message identity or fingerprint inputs | read-first duplicate lookup, then create | stable receipt id + create-or-reload in `createProviderReceipt(...)` | duplicate ingestion reuses canonical receipt |
| Intake review decisions | `aiIntakeDraftId` | generated decision ids; duplicate approvals could fan out | stable decision id + create-or-reload | replayed approval reuses existing decision |
| Intake approvals | `aiIntakeDraftId` | generated approval ids | stable approval id + create-or-reload | replayed approval reuses existing approval |
| Intake-created work orders | `organizationId + aiIntakeDraftId` | random work-order id from canonical create path | deterministic `requestedWorkOrderId` passed into `WorkOrderService.create(...)` | duplicate conversion reuses one authoritative work order |
| Domain events with request scope | `organizationId + requestId + type + entity` | random ids | stable domain event id when `requestId` is present | duplicate retry noops at event persistence |
| Transition audit triplet | `organizationId + workOrderId + requestId/correlationId + from + to` | random transition audit/event/domain-event ids | stable ids + create-or-reload in `recordTransition(...)` | duplicate retry cannot create duplicate transition triplets |

## 3. Replay/runtime determinism

Replay safety now depends on stable persisted identities rather than timing:

- event replay uses the same durable job and timer identities on reprocessing
- duplicate runtime enqueue attempts converge on the same runtime job
- duplicate webhook deliveries converge on the same webhook event and receipt
- replayed intake approval converges on the same review decision, approval, and work order
- duplicate transition retries converge on the same transition audit, transition event, and durable domain event

`src/modules/runtime/server/event-replay-service.ts` was also hardened to tolerate direct replay-by-id lookups without depending on a specific repository stub shape.

## 4. Current audit summary

### Runtime jobs

- Key: `organizationId + type + idempotencyKey`
- Transactional uniqueness: yes at artifact identity level through stable document id
- Duplicate race risk: bounded to create conflict + reload
- Replay determinism: yes

### Replay commands

- Event replay itself does not create authoritative business entities directly.
- Replay safety now comes from downstream stable identities for jobs, timers, transition records, and intake approval conversion.

### Provider webhook events

- Key: normalized webhook idempotency key
- Transactional uniqueness: yes through stable webhook event id and Firestore `create(...)`
- Duplicate race risk: bounded to existing-record reload
- Replay determinism: yes

### Provider receipts

- Key: normalized provider receipt idempotency key
- Transactional uniqueness: yes through stable receipt id and Firestore `create(...)`
- Duplicate race risk: bounded to existing-record reload
- Replay determinism: yes

### Intake ingress artifacts

- Key owner: provider message receipt identity and intake review draft identity
- Transactional uniqueness: partial but canonical for receipt, decision, approval, and work-order conversion
- Duplicate race risk: bounded for authoritative receipt and conversion artifacts
- Replay determinism: yes for receipt reuse and review conversion reuse

### Subscriber processing records

- Processing records already use stable record ids.
- Duplicate job fan-out is now bounded by stable runtime job ids and stable timer ids even if processing records are retried.
- Remaining gap: processing record persistence itself is still save-based rather than explicit claim-state acquisition.

### Transition audit persistence

- Key: work-order transition retry context
- Transactional uniqueness: yes at the record identity layer through stable ids
- Duplicate retry risk: bounded to create conflict + reload
- Remaining gap: the transition audit/event/domain-event triplet is not committed as one Firestore transaction.

## 5. Duplicate delivery behavior

The canonical duplicate behavior is now:

- first writer creates the canonical record
- overlapping or replayed writers hit `already exists`
- duplicate writers reload and return the canonical record
- payload mismatch on the same logical identity fails explicitly

This is the intended bounded no-op model for:

- runtime enqueue
- SLA timer creation
- provider webhook normalization
- provider receipt capture
- intake approval conversion
- transition audit retries

## 6. Retry safety behavior

- Duplicate enqueue and replay attempts do not create duplicate runtime jobs.
- Duplicate SLA scheduling does not create duplicate timers.
- Duplicate provider receipts do not create duplicate reconciliation records.
- Duplicate intake approval conversion does not create duplicate work orders.
- Duplicate transition retries do not create duplicate transition records when the retry context is stable.

## 7. Remaining risks deferred to later phases

Phase 4 intentionally does not redesign event/outbox persistence.

Remaining non-atomic risks:

1. Multi-record event bundles still persist as separate writes even when each record id is now stable.
2. Intake provider ingestion still creates several canonical communication/intake records around the receipt boundary; the authoritative receipt is idempotent, but full bundle atomicity remains a later concern.
3. Subscriber processing record persistence is durable and bounded by downstream idempotent artifacts, but it is not yet a formal claim/lease protocol.

These remain Phase 5+ concerns:

- Phase 5: atomic event / outbox persistence
- Phase 6: lease / claim hardening
- Phase 7: subscriber runtime productionization

## 8. Verification targets

Regression coverage added or updated for:

- duplicate runtime enqueue
- overlapping duplicate runtime enqueue
- replay-by-id and replay-by-batch determinism
- duplicate transition retry idempotency
- duplicate webhook delivery
- overlapping duplicate webhook delivery
- replayed intake approval conversion reuse

Core checks run for this phase:

- `npm run typecheck`
- `npm test`
