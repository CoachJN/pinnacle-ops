# SLA / Notifications / Automation Audit

Date: 2026-05-06

## 1. Current SLA/notification architecture

### Executive summary

The platform is **partially ready in architecture, but not yet operationally ready** for reliable SLA monitoring and automated follow-up.

What exists today:

- A typed workflow transition model for work orders and invoices in `src/lib/workflows/transition-service/*`.
- Typed SLA timer definitions, breach evaluation, scheduled action claiming, retry handling, and worker batch processing in `src/lib/workflows/execution/*`.
- Typed orchestration and reaction layers for notifications and automation in:
  - `src/lib/workflows/reactions/*`
  - `src/lib/workflows/orchestration/*`
- Durable internal notification persistence and alert-feed shaping in:
  - `src/server/services/notification-service.ts`
  - `src/modules/notifications/*`
- Durable activity logging in `src/server/services/activity-log-service.ts`.
- Workflow verification and scenario coverage in `src/tests/workflow-*.test.mts` and `src/lib/workflows/verification/*`.

What does not exist yet:

- No concrete production repository implementation for:
  - transition event storage
  - orchestration action storage
  - scheduled workflow execution storage
  - SLA timer storage
  - SLA breach storage
- No background worker entrypoint, no cron runner, and no scheduler boundary.
- No Slack, Teams, or outbound email delivery integration.
- No implemented escalation runtime that executes timed reminders or breach follow-up.
- Quote runtime remains explicitly deferred in the workflow engine.

### Important architectural split

There are currently **two active workflow paths**:

1. Legacy/domain service path
- `src/server/services/work-order-service.ts`
- `src/server/services/invoice-service.ts`
- `src/server/services/quote-workflow-service.ts`
- `src/server/services/assignment-service.ts`

2. New canonical transition/orchestration/SLA path
- `src/lib/workflows/transition-service/*`
- `src/lib/workflows/reactions/*`
- `src/lib/workflows/orchestration/*`
- `src/lib/workflows/execution/*`

The new path is more suitable for SLA automation, but live API routes still use the legacy/domain service path in multiple places. That means SLA/event behavior is **not yet uniformly enforced from one canonical runtime**.

### Current notification architecture

Implemented today:

- Internal notifications are persisted to Firestore via `internalNotifications`.
- Notification recipients are resolved by internal role and work-order ownership context.
- The UI has an operational alert feed with due/at-risk/breached states.

Current channel support:

- In-app internal notifications: **implemented**
- Client/internal notification intents: **typed**
- Email: **not implemented**
- Slack: **not implemented**
- Teams: **not implemented**
- SMS/voice/pager: **not implemented**

### Current automation architecture

Implemented as library/runtime primitives:

- transition audits
- transition events
- notification intents
- automation intents
- orchestration rules
- scheduled execution records
- SLA timers
- SLA breach evaluation
- retry scheduling

But production runtime is incomplete because the codebase lacks:

- durable execution repositories
- a worker runtime
- a scheduler trigger
- delivery adapters
- monitoring/operations surfaces for failed jobs

## 2. Current timestamp/event coverage

### Work orders

Persisted fields found:

- `createdAt`, `updatedAt`
- `submittedAt`
- `approvedAt`
- `completedAt`
- `closedAt`
- `requestedServiceDate`

Coverage notes:

- Work-order status changes are logged in activity logs.
- Work-order transition timestamps are only partially first-class.
- There is **no dedicated first-response timestamp**.
- There is **no dedicated first-assigned timestamp** on the work order itself.
- There is **no dedicated last-activity-at field** on the work order.
- There is **no dedicated waiting-on-client-started-at / waiting-on-contractor-started-at / dispatched-at / scheduled-at / in-progress-started-at** field on the work order model.

### Assignments

Persisted fields found:

- `assignedAt`
- `acceptedAt`
- `declinedAt`
- `completedAt`
- `scheduledDate`
- `timeWindowStart`
- `timeWindowEnd`

Coverage notes:

- Assignment timing is one of the stronger areas.
- This supports assignment-response SLAs reasonably well if assignment records are treated as the SLA source.
- There is still no explicit `reassignedAt`, `cancelledAt`, or “awaiting acknowledgement since” field.

### Quotes

Persisted fields found:

- Contractor quote:
  - `submittedAt`
  - `reviewedAt`
- Client quote:
  - `sentAt`
  - `respondedAt`
  - `approvedAt`
  - `rejectedAt`

Coverage notes:

- Quote timestamps are relatively strong in the legacy quote service.
- However, the workflow engine explicitly marks quote runtime as deferred.
- This means quote timing exists in data, but **quote SLA automation is not yet fully unified into the canonical transition/SLA runtime**.

### Invoices

Persisted fields found:

- `issuedDate`
- `dueDate`
- `sentAt`
- `viewedAt`
- `overdueAt` in canonical type, but not clearly represented in the Firestore document model shown
- `disputedAt` and `resolvedAt` in canonical type, but not clearly represented in the Firestore document model shown
- `paidAt`
- `voidedAt`

Coverage notes:

- Invoice timing coverage is strong enough for aging and collection workflows.
- There is some model inconsistency between canonical invoice types and Firestore model fields that should be cleaned up before production SLA reporting.

### Activity logs

Implemented:

- Durable work-order scoped activity logs with actor, event type, occurred-at, visibility, metadata, and change details.

Strengths:

- Good for auditability and fallback reconstruction.
- Good source for operator-facing history.

Limitations:

- Activity logs are not a replacement for first-class SLA timestamps.
- “No recent activity” SLA is possible, but currently would rely on log reads rather than a denormalized `lastActivityAt`.

### Transition events

The new workflow stack depends on persisted `TransitionEventRecord`s. If transition event recording is unavailable, downstream reactions, orchestration, and SLA timer creation are skipped by design.

This is a good safety control, but today it also means:

- readiness depends on a repository implementation that I did not find in production storage code
- the transition-engine path is not yet the universal operational source of truth

## 3. Missing SLA triggers

### Future use cases already partially supported

These have some foundational support:

- Quote aging
  - Quote timestamps exist.
  - Work-order SLA `awaiting-quote` exists.
  - Canonical quote runtime is still deferred.
- Client waiting too long
  - Client quote `sentAt` and `respondedAt` exist.
  - Work-order `awaiting-client-approval` SLA exists.
- Invoice aging
  - Invoice `sent`, `dueDate`, `paidAt`, `overdue` logic exist.
  - Invoice SLA definitions exist.
- Emergency escalation
  - Severity model exists.
  - Critical SLA breach severity exists.
  - No real escalation execution path exists.

### Missing or incomplete triggers by requested use case

#### New request first response

Missing:

- explicit `firstRespondedAt`
- explicit definition of what counts as first response
- SLA timer start/stop rule tied to request creation and first human/system acknowledgement

#### Unassigned work order

Partially present:

- work order has `assignedContractorId`
- assignment records have `assignedAt`

Missing:

- canonical “unassigned too long” SLA definition
- explicit timer starting from request intake or approved-to-proceed
- worker to evaluate and escalate

#### Contractor no-response

Partially present:

- `assignedAt`, `acceptedAt`, `declinedAt`

Missing:

- active SLA definition based on assignment acknowledgement deadline
- automatic reminder/escalation schedule
- reassignment/escalation policy model

#### Quote aging

Partially present:

- work-order awaiting-quote SLA exists
- contractor quote timestamps exist

Missing:

- canonical quote transition events
- quote-specific runtime execution
- follow-up execution worker

#### Client waiting too long

Partially present:

- client quote timestamps
- work-order awaiting-client-approval SLA exists

Missing:

- reminder sequencing across channels
- acknowledgement tracking
- escalation ladder after repeated non-response

#### Supplier ETA overdue

Missing:

- supplier entity workflow
- ETA promise timestamp model
- supplier communication/event log
- overdue ETA SLA definition

#### Technician overdue

Partially present:

- assignment `scheduledDate`
- assignment completion timestamps

Missing:

- promised arrival ETA / onsite window breach model
- technician check-in/check-out timestamps
- overdue technician escalation triggers

#### No recent activity

Partially present:

- activity log exists

Missing:

- denormalized `lastActivityAt`
- inactivity timer creation/reset behavior
- scoped policy by work-order state and priority

#### Invoice aging

Mostly present:

- sent, due date, overdue, paid timestamps
- invoice SLAs exist

Missing:

- production breach monitor runtime
- automated collection reminders
- channel delivery and escalation tracking

#### Emergency escalation

Partially present:

- priority/severity concepts exist

Missing:

- emergency-specific policy model
- multi-stage timed escalation
- after-hours routing
- channel redundancy
- acknowledgement timers

## 4. Missing notification channels

### Implemented

- In-app internal notifications persisted in Firestore

### Missing

- Slack integration
- Microsoft Teams integration
- outbound transactional email
- inbound email/webhook handling
- SMS/push/voice escalation channels
- delivery status tracking
- bounce/failure handling
- acknowledgement capture across channels
- per-tenant routing configuration
- per-user notification preferences
- quiet hours/on-call routing

### Current recommendation

Build channels in this order:

1. Email
2. Slack or Teams
3. SMS/voice only for emergency workflows

Reason:

- Email is the lowest-friction baseline for clients and external parties.
- Slack/Teams is highest value for internal escalations.
- SMS/voice should be reserved for urgent flows and only after safety controls exist.

## 5. Required background worker architecture

### Current state

I found:

- worker batch-processing primitives
- scheduled action claiming
- retry policy
- monitoring summary builders

I did not find:

- a persistent scheduled-action repository in the Firestore repository layer
- a worker service entrypoint
- a cron/scheduler trigger
- dead-letter handling
- operational dashboards for worker failures

### Recommended production architecture

#### A. Durable persistence layer

Add concrete persistence for:

- `workflowTransitionAudits`
- `workflowTransitionEvents`
- `workflowOrchestrationActions`
- `workflowExecutionAttempts`
- `workflowSlaTimers`
- `workflowSlaBreaches`
- `workflowEscalations`

#### B. Scheduler entrypoints

Create explicit server-side jobs for:

- `sla-breach-monitor`
  - scans due active SLA timers
  - records breaches
  - emits escalation/notification actions
- `scheduled-action-worker`
  - claims due scheduled actions
  - processes reminders/rechecks/escalations
- `staleness-rebuilder`
  - optional denormalization job for `lastActivityAt`, queue health, and stuck records

#### C. Worker execution model

Minimum capabilities:

- idempotent claim-and-process flow
- lease/claim expiry
- retry with backoff
- max-attempt handling
- dead-letter status
- structured worker logs
- metrics by queue/action type

#### D. Trigger mechanism

Use one of:

- Cloud Scheduler -> API/worker endpoint
- Cloud Run jobs
- background function/job runner

Do not trigger SLA evaluation from user-facing requests except as a fallback.

#### E. Ownership boundary

Recommended split:

- route handlers: accept requests only
- services: mutate business state
- workflow transition runtime: generate events/intents/timers
- worker runtime: execute timed follow-up and escalation actions
- notification adapters: deliver messages and record delivery outcomes

## 6. Escalation rule model recommendation

Use a **policy-driven escalation model**, not hard-coded per use case.

### Recommended model

#### `SlaPolicy`

Fields:

- `policyKey`
- `entityType`
- `scope`
  - organization
  - client
  - location
  - priority
  - work category
- `startTrigger`
- `stopTriggers`
- `pauseTriggers`
- `breachThresholds`
  - warning
  - breach
  - severe breach
- `businessHoursMode`
- `calendar/timezone`
- `enabled`

#### `EscalationStage`

Fields:

- `policyKey`
- `stageNumber`
- `delayFromStartMinutes` or `delayFromPreviousStageMinutes`
- `condition`
- `channel`
  - in-app
  - email
  - slack
  - teams
  - sms
- `audienceResolver`
  - assigned coordinator
  - manager
  - finance
  - owner
  - contractor contact
  - client contact
  - on-call roster
- `requiresAcknowledgement`
- `autoCloseOnResolution`
- `dedupeWindowMinutes`

#### `EscalationRecord`

Fields:

- `escalationId`
- `policyKey`
- `entityType`
- `entityId`
- `currentStage`
- `status`
  - active
  - acknowledged
  - resolved
  - cancelled
  - failed
- `openedAt`
- `acknowledgedAt`
- `resolvedAt`
- `lastAttemptedAt`
- `lastDeliveredAt`
- `deliveryFailures`

### Why this model fits this platform

- It aligns with the existing service/repository pattern.
- It keeps route handlers thin.
- It allows organization-specific tuning without changing code.
- It separates business rules from delivery channels.

## 7. Automation safety controls

These are required before production SLA automation should be trusted.

### Required controls

- Idempotency keys for all scheduled actions and escalation deliveries
- Per-action dedupe windows
- Actor attribution for system actions
- Durable transition event storage before side effects
- Retry caps with dead-letter state
- Circuit breaker for broken delivery adapters
- Manual pause/snooze/dismiss controls
- Escalation suppression when entity is already terminal/resolved
- Optimistic concurrency or transaction protection for cross-entity updates
- Backfill/reconciliation jobs for missed timers
- Tenant-safe routing boundaries
- Environment gating so test/staging automations do not notify real recipients

### Current safety posture

Present:

- warning-based graceful degradation
- side effects skipped when transition event logging is unavailable
- retry primitives for scheduled execution
- role-aware recipient resolution for internal alerts

Missing:

- durable idempotent delivery ledger
- real channel failure handling
- dead-letter operations
- reconciliation tooling
- transactionally safe multi-entity automation

## 8. Testing requirements

### Current strengths

Verified during this audit:

- `src/tests/notifications-operational-alerts.test.mts`
- `src/tests/workflow-execution.test.mts`
- `src/tests/transition-reactions.test.mts`
- `src/tests/workflow-orchestration.test.mts`
- `src/tests/workflow-verification.test.mts`
- `npm run verify:workflow`

Coverage strengths today:

- typed SLA timer behavior
- breach evaluation logic
- scheduled execution retry behavior
- orchestration rule evaluation
- notification/automation intent generation
- workflow scenario verification harness

### Missing test categories

- Firestore-backed persistence tests for transition events, SLA timers, breaches, and scheduled actions
- end-to-end job execution tests against real repositories
- route-to-worker integration tests
- delivery adapter contract tests for email/Slack/Teams
- idempotency and duplicate-processing tests
- concurrency and claim-race tests
- recovery/replay tests after worker crash
- timezone/business-hours SLA tests
- tenant-specific policy tests
- emergency escalation acknowledgement tests
- quote-runtime integration tests after quote unification

### Minimum testing bar before launch

1. Repository integration tests for every new automation collection.
2. End-to-end scheduled reminder flow test.
3. End-to-end SLA breach escalation flow test.
4. Duplicate-delivery prevention test.
5. Worker retry/dead-letter test.
6. Manual resolution/acknowledgement test.
7. Failure-injection tests for channel adapters.

## 9. Implementation phases

### Phase 1: Canonical event and timestamp readiness

Build:

- canonical transition event persistence
- canonical transition audit persistence
- explicit timestamps for:
  - first response
  - last activity
  - waiting-on-client entered
  - waiting-on-contractor entered
  - scheduled-at
  - dispatched-at
  - first assigned-at on work order

Outcome:

- reliable inputs for SLA measurement

### Phase 2: Durable SLA and orchestration persistence

Build:

- Firestore repositories for:
  - orchestration actions
  - scheduled executions
  - execution attempts
  - SLA timers
  - SLA breaches
- basic monitoring queries

Outcome:

- the current typed workflow engine becomes durable

### Phase 3: Worker runtime and scheduler

Build:

- scheduled worker entrypoint
- SLA breach monitor entrypoint
- retry and dead-letter behavior
- operational logging/metrics

Outcome:

- timed automations actually run

### Phase 4: Channel delivery adapters

Build:

- email delivery adapter
- Slack or Teams adapter
- delivery receipt/failure recording
- notification preference/routing configuration

Outcome:

- escalations can leave the app

### Phase 5: Policy and escalation engine

Build:

- policy tables/models
- stage-based escalation rules
- acknowledgement and snooze controls
- emergency routing and severity-specific handling

Outcome:

- configurable, tenant-safe escalation behavior

### Phase 6: Quote runtime unification

Build:

- canonical quote transition persistence
- quote event generation
- quote orchestration activation
- quote SLA timer activation

Outcome:

- quote aging and client-decision SLAs become first-class

### Phase 7: Operational hardening

Build:

- reconciliation jobs
- admin tooling for replay/cancel/requeue
- dashboards for worker health, queue depth, breach counts, and delivery failures
- runbooks and alerting

Outcome:

- production-grade operational reliability

## Bottom line

The platform is **not yet ready for operationally reliable SLA monitoring and automated follow-up in production**, but it is **well scaffolded for it**.

The most important next steps are:

1. unify around one canonical transition/event runtime
2. persist workflow events, timers, breaches, and scheduled actions
3. add worker/scheduler infrastructure
4. add real delivery channels
5. introduce policy-driven escalation rules and safety controls

Once those are in place, the existing workflow abstractions should support the requested SLA use cases cleanly.
