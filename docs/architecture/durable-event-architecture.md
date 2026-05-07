# Durable Event Architecture

Date: 2026-05-06

## 1. Event architecture overview

Phase 5 introduces one canonical operational event foundation for work-order history and future cross-domain automation.

Canonical runtime responsibilities:

- write immutable operational events through `src/server/services/domain-event-service.ts`
- persist all lifecycle transition audits in top-level Firestore collections
- project timeline history from durable events rather than from current entity state
- filter timeline reads through one canonical visibility model

Removed from the canonical runtime path:

- scattered activity-log writes as the primary operational history mechanism
- portal/dashboard history reads that queried `activityLogs` directly
- timeline inference from current work-order state

Retained but no longer canonical:

- `activityLogs` collection and compatibility service surface for legacy callers not yet deleted in this pass
- note and attachment subcollections for artifact storage, with timeline history now emitted through canonical events

## 2. Event persistence model

New top-level Firestore collections:

- `domainEvents`
- `transitionEvents`
- `transitionAudits`

Persistence rules:

- append-only
- immutable after create
- tenant-scoped with `organizationId` and `tenantId`
- work-order anchored with `workOrderId`
- actor-attributed
- timestamped with `occurredAt`
- lifecycle-aware with `lifecycleStatus` or transition fields
- visibility-scoped for portal-safe reads

## 3. Event type catalog

Implemented canonical event types:

- `work_order_created`
- `lifecycle_transitioned`
- `assignment_created`
- `assignment_accepted`
- `assignment_declined`
- `contractor_contacted`
- `quote_requested`
- `contractor_quote_received`
- `client_approval_requested`
- `client_approved`
- `work_started`
- `work_completed`
- `invoice_sent`
- `payment_recorded`
- `work_order_closed`
- `work_order_cancelled`
- `work_order_on_hold`
- `work_order_escalated`
- `note_added`
- `attachment_added`

Each event stores:

- typed payload
- actor metadata
- visibility metadata
- work-order linkage
- tenant linkage
- immutable summary text for timeline display

## 4. Transition audit model

Every canonical lifecycle transition now writes:

- `fromLifecycleStatus`
- `toLifecycleStatus`
- `actor`
- `occurredAt`
- `reason`
- `metadata`
- `holdContext` when applicable
- `escalationContext` when applicable

Transition writes now persist in this order:

1. `transitionAudits`
2. `transitionEvents`
3. `domainEvents` with `lifecycle_transitioned`

## 5. Timeline projection model

The unified timeline projection is the `TimelineEntry` shape returned by `timeline-service`.

Timeline entries include:

- `id`
- `workOrderId`
- `occurredAt`
- `type`
- `visibility`
- `actor`
- `summary`
- `lifecycleStatus`
- `entity`
- `payload`

Timeline content now originates from canonical events for:

- lifecycle transitions
- assignment creation and responses
- quote actions
- invoice actions
- notes
- attachments

The model is intentionally ready for future:

- communications
- AI actions
- SLA breaches
- escalations
- worker orchestration events

## 6. Visibility/security model

Canonical event visibility values:

- `internal`
- `client`
- `contractor`
- `finance`
- `system`

Read rules:

- internal actors can read `internal`, `client`, `contractor`, and `system`
- only finance roles read `finance`
- client actors read only `client`
- contractor actors read only `contractor`

This replaces ad-hoc portal filtering of raw activity logs as the canonical read path.

## 7. Actor attribution model

Canonical actor structure:

- `actorId`
- `actorType`
- `actorRole`
- `displayName`

Supported actor types:

- `user`
- `system`
- `ai`

Current runtime writes use `user` and `system`. `ai` is reserved for future intake and operational assistance flows.

## 8. Event writing flow

Canonical event writes now originate from:

- `work-order-service`
- `assignment-service`
- `quote-workflow-service`
- `invoice-service`
- runtime note creation
- runtime attachment creation

Integration rules:

- lifecycle changes persist transition audit/event records
- semantic business events are written through the same event service
- future side effects should consume durable events instead of reading transient in-memory mutation outcomes

## 9. Timeline read flow

Canonical timeline reads now flow through:

- `src/server/services/timeline-service.ts`
- `src/server/services/domain-event-service.ts`

Primary consumers updated in this phase:

- `GET /api/work-orders/[workOrderId]/activity`
- runtime work-order detail projection
- contractor portal work-order detail

## 10. Future communications integration points

Future communication providers should:

- persist communication records as domain events or communication-domain records that emit domain events
- link all messages to canonical `workOrderId`
- publish portal-visible timeline entries through the canonical visibility model

They should not:

- write directly into `workOrders`
- bypass the event layer with provider-specific timeline tables

## 11. Future AI integration points

Future AI systems should:

- attribute AI actions with actor type `ai`
- persist intake/extraction/recommendation results as durable events
- publish review checkpoints into the same timeline foundation

They should not:

- mutate work-order lifecycle directly without canonical transition auditing
- store approval history only in opaque metadata blobs

## 12. Future SLA/orchestration integration points

Future SLA and orchestration systems should:

- subscribe to durable transition and domain events
- persist their own durable timer/breach/action records separately
- project their outputs back into the canonical timeline through events

They should not:

- rely on direct service-to-service side-effect coupling
- infer missed history from current lifecycle snapshots
