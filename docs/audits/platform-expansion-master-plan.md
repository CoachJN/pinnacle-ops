# Platform Expansion Master Plan

Date: 2026-05-06

## 1. Executive summary

The Work Order Platform has strong structural foundations for expansion: thin routes, meaningful service/repository separation, normalized Firestore persistence, role-aware portals, activity logging, internal notifications, and a substantial workflow library. The platform is not yet ready to scale directly into a full communications and AI operations system because the operational core is still split across multiple lifecycle models, multiple authorization paths, and multiple persistence patterns.

The expansion strategy should therefore be additive but disciplined:

1. stabilize the canonical work order domain and authorization runtime
2. harden event, audit, and automation durability
3. introduce communications as a first-class bounded context
4. introduce intake and AI as review-first systems on top of communications
5. productionize SLA, escalation, and orchestration once the event foundation is durable

The future-state platform should be a unified operations system where work orders remain the primary operational aggregate, while communications, intake, AI artifacts, approvals, events, and automation operate as first-class adjacent bounded contexts with explicit linking, governance, and visibility rules.

## 2. Current readiness assessment

Overall readiness: `6/10` for platform expansion.

What is ready now:

- service/repository architecture is mature enough to support new bounded contexts
- server-side auth and role-aware access controls are materially present
- Firestore entity boundaries are mostly normalized for current operations
- workflow and SLA library primitives already exist
- internal notifications and activity logging are real reusable foundations
- test coverage is relatively strong in domain and service layers

What is only partially ready:

- lifecycle unification across work orders, quotes, invoices, and portals
- quote runtime integration with the canonical workflow engine
- durable event persistence for transitions, SLA timers, orchestration actions, and execution attempts
- external communications, consent, delivery tracking, and threading
- AI governance, provenance, confidence, and review workflows
- enterprise-grade auditability, observability, and transactional integrity

Bottom line:

- The platform is ready for a structured expansion program.
- It is not ready for direct omnichannel or autonomous AI rollout without a stabilization phase.

## 3. Major blockers

1. No canonical lifecycle model is enforced across dashboard, quote, invoice, workflow engine, and reporting surfaces.
2. Quote runtime remains split and is not fully supported end-to-end in the canonical transition runtime.
3. Workflow automation primitives exist, but durable persistence and worker runtime are missing.
4. There is no canonical communications domain for threads, messages, participants, deliveries, or consent.
5. There is no intake domain for AI-safe draft creation, evidence, confidence, duplicate screening, and human approval.
6. Authorization is conceptually centralized but still fragmented across multiple active policy paths.
7. External data boundaries have known leaks in contact and client detail access.
8. Security audit logging is not clearly durable by default.
9. Multi-entity workflow mutations do not yet show a clearly standardized transaction/idempotency strategy.
10. Reporting and analytics cannot be trusted at future-state depth while status and event models remain split.

## 4. Major opportunities

1. The existing workflow library provides a strong base for canonical transition, SLA, and orchestration behavior once persistence is added.
2. Activity logs, internal notifications, contacts, and attachment infrastructure can be reused as foundations for communications and unified timeline work.
3. Role-aware portal shaping already proves that visibility-scoped projections can support external communications safely once the model is formalized.
4. The work order domain already contains enough business structure to support AI-assisted intake if a review-first intake layer is introduced.
5. The platform can evolve into an operations command center with queue-based work, event history, escalations, scorecards, and AI summaries without replacing the current application architecture.

## 5. Required stabilization work

The following work should be treated as mandatory before major expansion:

1. Choose and enforce one authoritative lifecycle model across work orders, quotes, invoices, permissions, UI, and tests.
2. Normalize the active work order model to include canonical lifecycle, quote summary, invoice summary, and current quote/invoice linkage.
3. Unify quote runtime architecture so contractor quote, client quote, and approval flow have one operational source of truth.
4. Consolidate authorization into one canonical server-side evaluator and one projection strategy by actor type.
5. Fix external-boundary leaks in contact APIs and client organization detail APIs.
6. Require a canonical active user profile for authorization, not token claims alone.
7. Add durable security audit persistence and standard correlation IDs.
8. Define transaction and idempotency patterns for cross-entity workflows.
9. Productionize workflow execution with durable repositories, scheduler entrypoints, workers, retries, and dead-letter handling.
10. Add baseline observability for workflow execution, failures, queue health, and escalations.

## 6. Recommended canonical architecture

Recommended architectural direction: a hybrid domain platform with first-class current-state aggregates, append-only domain events, and projection/read models.

### Bounded contexts

- `work-orders`
  - operational aggregate root
  - lifecycle state, role ownership, assignment readiness, quote/invoice summary status
- `quotes`
  - canonical quote aggregate or normalized wrapper over contractor/client quote history
- `invoices`
  - finance lifecycle and payment state
- `communications`
  - threads, messages, participants, deliveries, attachments, linking, consent
- `intake`
  - intake events, raw artifacts, AI drafts, review decisions, approval flow
- `workflow-runtime`
  - transition events, orchestration actions, execution attempts, SLA timers, escalations
- `approvals`
  - approval requests and approval decisions for quote, AI, finance, and override workflows
- `reporting`
  - timeline projections, reporting snapshots, contractor performance facts, scorecards
- `security-governance`
  - durable security audit, data classification, retention, override logging

### Runtime responsibilities

- route handlers remain thin
- application services own business mutations
- repositories own persistence contracts
- workflow runtime generates events, timers, and automation intents
- worker runtimes execute scheduled actions and external delivery
- projection builders create timeline, queue, and reporting views

### Canonical platform rule

No new feature should introduce a fourth workflow path or a second communications/intake path. All future expansion should enter through canonical bounded contexts and link back to the work order aggregate through explicit services and events.

## 7. Recommended data model changes

### Normalize core entities

`WorkOrder` should gain:

- `lifecycleStatus`
- `approvalStatus`
- `quoteSummaryStatus`
- `invoiceSummaryStatus`
- `currentQuoteId`
- `currentInvoiceId`
- `lastActivityAt`
- workflow timestamps:
  - `quoteRequestedAt`
  - `quoteReceivedAt`
  - `clientApprovalRequestedAt`
  - `clientApprovedAt`
  - `readyForInvoicingAt`
  - `invoiceSentAt`
  - `paidAt`
  - `closedAt`
- exception metadata:
  - `holdReason`
  - `escalationReason`
  - `previousLifecycleStatus`
- optional owners:
  - `quoteReviewerUserId`
  - `financeOwnerUserId`

`Quote` should be canonicalized using one of two acceptable models:

- preferred: one `Quote` aggregate with `quoteType`, `sourceQuoteId`, `status`, `approvalStatus`, price fields, and timestamps
- fallback: retain separate contractor/client quote records, but add a normalized wrapper or event model so quote history is queryable and governed as one lifecycle

`Invoice` should keep finance detail but align Firestore fields with canonical invoice timing/status vocabulary.

### Add first-class event and workflow durability

Add immutable collections for:

- `domainEvents`
- `transitionAudits`
- `transitionEvents`
- `workflowOrchestrationActions`
- `workflowExecutionAttempts`
- `workflowSlaTimers`
- `workflowSlaBreaches`
- `workflowEscalations`

### Add approvals

- `approvalRequests`
- `approvalDecisions`

### Add reporting projections

- `timelineEntries`
- `reportingSnapshots`
- `contractorPerformanceFacts`
- `contractorScorecards`

## 8. Recommended communication model

Create a new canonical `communications` bounded context and avoid adding omnichannel behavior to legacy note/attachment paths.

### Core entities

- `communicationThreads`
- `communicationMessages` or `communicationRecords`
- `communicationParticipants`
- `communicationLinks`
- `communicationDeliveries`
- `communicationAttachments`
- `communicationMatchSuggestions`
- `communicationConsentPreferences`

### Required capabilities

- omnichannel support for `email`, `sms`, `portal_message`, `internal_note`, then later `call`, `voicemail`, `slack`, `teams`
- thread-level and message-level linking to work orders and related entities
- direction-aware records: inbound, outbound, internal, system
- delivery-state tracking and retry visibility
- endpoint normalization for email and phone
- confidence-scored auto-link and manual review queue
- visibility classification stronger than current `internal/client/contractor/all`
- retention, redaction, and consent enforcement by channel

### Recommended rollout model

1. Build the canonical communications model and services.
2. Unify internal timeline reads across activity, notes, attachments, and status changes.
3. Add email and SMS before voice, Slack, or Teams.
4. Add portal messaging as just another channel on the same model.
5. Add AI summaries only after source visibility and provenance are enforced.

## 9. Recommended AI intake architecture

AI should not create work orders directly.

### New intake bounded context

Add:

- `intakeEvents`
- `intakeArtifacts`
- `aiIntakeDrafts`
- `aiIntakeDecisions`
- `intakeApprovals`
- optionally `aiRuns` and `aiApprovalCheckpoints` if shared with other AI use cases

### Required draft behavior

Each AI draft should store:

- source channel and source event/thread references
- normalized source text and raw artifact references
- extracted candidate fields for work order creation
- per-field confidence scores
- per-field evidence spans
- alternate candidates for client/location/contact
- duplicate candidates and duplicate risk
- model, prompt, classifier, and generation metadata
- review flags and reviewer decision outcomes

### Required approval flow

1. create intake event from inbound communication or manual source
2. store raw artifacts and normalized text
3. run AI extraction and matching into an AI draft
4. run deterministic validation and duplicate screening
5. place draft in human review queue
6. reviewer approves, edits and approves, rejects, merges into existing work order, or marks as non-work-order communication
7. only approved drafts convert into canonical `CreateWorkOrderDto`

### Governance rules

- low confidence on client or location blocks auto-conversion
- any emergency-positive result forces human review
- high duplicate risk forces merge/review flow
- evidence must be explainable and stored
- prompts, models, versions, and reviewer overrides must be durably logged

## 10. Recommended SLA/automation architecture

The platform should use a policy-driven workflow automation subsystem backed by durable persistence and workers.

### Required architecture

- durable workflow repositories for timers, breaches, actions, attempts, and escalations
- explicit scheduler jobs:
  - `sla-breach-monitor`
  - `scheduled-action-worker`
  - optional `staleness-rebuilder`
- worker capabilities:
  - idempotent claim/process
  - lease expiry
  - retry with backoff
  - dead-letter handling
  - metrics and structured logs
- delivery adapters for in-app, email, then Slack/Teams/SMS as later channels

### Recommended policy model

`SlaPolicy`:

- entity type and scope
- start, stop, and pause triggers
- threshold levels
- business-hours/calendar settings
- enabled flag

`EscalationStage`:

- delay rules
- condition
- channel
- audience resolver
- acknowledgement behavior
- auto-close behavior
- dedupe window

`EscalationRecord`:

- current stage
- status
- opened, acknowledged, resolved timestamps
- last attempt and delivery history

### Automation safety controls

- durable transition event storage before side effects
- idempotency keys for scheduled actions and deliveries
- per-action dedupe windows
- system actor attribution
- suppression when target entity is resolved or terminal
- circuit breakers for broken channel adapters
- manual pause, snooze, dismiss, and resolve controls
- backfill/reconciliation jobs for missed timers
- tenant-safe routing and environment gating
- concurrency protections for cross-entity updates

## 11. Security/RBAC requirements

### Immediate hardening requirements

1. scope contact APIs to actor-owned client/contractor boundaries, not tenant-only membership
2. redact client organization detail for external users
3. require a canonical active user profile for authorization
4. replace open authenticated attachment uploads with server-issued scoped uploads
5. make security audit logging durable
6. require explicit reasons and durable logging for owner overrides and high-risk finance actions

### Role model expansion

Split the current coarse roles into:

- Owner
- Manager
- Coordinator
- Finance/Admin
- Client Head Office
- Client Store
- Contractor Admin
- Contractor Technician

### Control-plane requirements for expansion

- one canonical authorization runtime
- reusable scope guards by actor type
- resource projections classified by visibility and sensitivity
- communication-specific visibility rules
- AI-safe projections and redaction pipelines
- retention and deletion policies for notes, attachments, communications, and AI artifacts
- durable audit query/reporting capability for denials, overrides, sensitive access, AI actions, and communication linking

## 12. Phased implementation roadmap

### Phase 0: Approval and architecture freeze

- approve the canonical expansion direction
- freeze new workflow/status additions outside the chosen canonical model
- agree bounded-context ownership and migration stance

Exit criteria:

- approved master plan
- named canonical lifecycle authority
- no new net-new logic on legacy workflow paths

### Phase 1: Security and platform stabilization

- fix external contact and client-detail exposure
- require canonical active profile presence
- harden attachment upload path
- configure durable security audit sink
- standardize correlation IDs and request IDs

Exit criteria:

- external boundary issues closed
- durable audit logging in place
- identity enforcement consistent

### Phase 2: Canonical lifecycle and domain unification

- adopt one authoritative lifecycle
- map legacy lowercase and Phase 3 uppercase statuses
- normalize work order fields for lifecycle, quote summary, invoice summary, and current linked records
- define role/action matrix per lifecycle state
- unify quote runtime directionally

Exit criteria:

- one lifecycle vocabulary
- one transition matrix
- unified work order schema

### Phase 3: Authorization and workflow runtime consolidation

- converge permission logic into one canonical runtime
- move lifecycle mutations behind one orchestration path
- add transaction/idempotency standards for multi-entity workflows
- reduce duplicate repository/service paths

Exit criteria:

- one mutation authority for lifecycle transitions
- one permission evaluator
- documented consistency strategy

### Phase 4: Event, timeline, and observability foundation

- add durable event, transition, and automation collections
- add unified timeline projection
- backfill timeline from activity, notes, attachments, and status changes
- add queue health, worker metrics, and failure dashboards

Exit criteria:

- immutable event foundation live
- one internal timeline API
- operational visibility into workflow runtime

### Phase 5: Communications foundation

- create `communications` bounded context
- implement threads, messages, participants, links, attachments, consent
- add communication review and matching queue
- support internal note/manual call log on canonical model

Exit criteria:

- one communication repository/service path
- one communication timeline tied to work orders

### Phase 6: Provider integrations and portal communication

- add inbound/outbound email
- add inbound/outbound SMS
- add delivery sync and retry workers
- add client and contractor portal messaging on same model

Exit criteria:

- messages round-trip through canonical communications model
- external messaging respects visibility and consent rules

### Phase 7: Intake and AI review layer

- create intake domain and AI draft model
- add duplicate detection and confidence/evidence storage
- build human review queue
- support controlled conversion into work order creation

Exit criteria:

- no AI-created work order bypasses review
- all drafts retain provenance and reviewer decision history

### Phase 8: SLA, escalation, and automation productionization

- add durable SLA repositories and worker runtime
- implement policy-driven escalation model
- launch first-response, unassigned, quote-aging, client-approval, and invoice-aging policies
- add manual resolve/snooze/ack controls

Exit criteria:

- timed follow-up runs outside user-facing requests
- duplicate-delivery prevention and dead-letter handling proven

### Phase 9: Reporting, optimization, and intelligence

- add reporting snapshots, performance facts, and contractor scorecards
- add AI summaries with provenance
- tune queues and automations using real event data

Exit criteria:

- trusted reporting on lifecycle, SLA, quote conversion, invoice aging, and contractor performance

## 13. Priority order

1. Security boundary fixes and durable audit enforcement
2. Canonical lifecycle decision and work order model normalization
3. Quote runtime unification
4. Authorization consolidation
5. Durable event and workflow persistence
6. Unified timeline foundation
7. Communications bounded context
8. Email/SMS provider integrations
9. Intake domain and AI review workflow
10. SLA/escalation worker runtime
11. Reporting and scorecards
12. AI summaries and recommendation features

## 14. Risks and mitigations

### Risk: migration drift during active refactor state

Mitigation:

- use additive schema changes first
- keep backward-compatible adapters during rollout
- define explicit cutover criteria and reconciliation reports

### Risk: automation amplifies existing lifecycle inconsistency

Mitigation:

- block production automation rollout until canonical lifecycle and transition authority are in place
- launch SLA policies only after event persistence is durable

### Risk: communications create new data exposure paths

Mitigation:

- introduce channel-specific visibility, consent, retention, and audit rules before provider rollout
- start with internal timeline and human-reviewed linking

### Risk: AI introduces bad matches, duplicates, or unsafe escalation

Mitigation:

- make AI review-first
- require evidence and confidence per field
- block direct state-changing AI actions

### Risk: quote/invoice split delays roadmap

Mitigation:

- treat quote runtime unification as a hard prerequisite
- allow wrapper/projection compatibility if full entity collapse must be phased

### Risk: worker runtime causes duplicate actions or missed timers

Mitigation:

- require idempotency keys, retry caps, dead-letter queues, reconciliation jobs, and monitoring from day one

### Risk: role expansion causes permission drift

Mitigation:

- move to one permission evaluator and one projection strategy before adding new roles
- add regression tests for each actor type and resource boundary

## 15. First 10 Codex implementation prompts to execute after audit approval

1. `Create a canonical lifecycle specification for the Work Order Platform by reconciling Phase 3 statuses, legacy lowercase statuses, and the workflow-library lifecycle. Produce a status mapping table, transition matrix, role ownership matrix, and required schema fields without changing runtime behavior yet.`

2. `Implement Priority 0 RBAC hardening: lock down contact API reads to actor-owned client/contractor scope, redact client organization detail for external users, require a canonical active user profile for authorization, and add focused regression tests.`

3. `Design and implement durable security audit persistence with correlation IDs and request IDs, wiring existing authorization/security audit events into Firestore-backed storage and adding repository-level tests.`

4. `Add the first-stage canonical work order schema expansion: lifecycleStatus, quoteSummaryStatus, invoiceSummaryStatus, currentQuoteId, currentInvoiceId, lastActivityAt, and key workflow timestamps. Keep compatibility with existing reads and writes.`

5. `Audit and consolidate server-side authorization so work order, quote, invoice, client portal, and contractor portal access resolve through one canonical runtime evaluator. Do not change UI behavior beyond security fixes.`

6. `Design and implement durable workflow persistence collections for transition events, transition audits, orchestration actions, execution attempts, SLA timers, and SLA breaches, including repository interfaces and integration tests.`

7. `Create a unified internal timeline read model that aggregates activity logs, notes, attachments, and status changes for a work order. Implement it as a canonical service/API without removing legacy write paths yet.`

8. `Create the communications bounded context with initial entities, repositories, and services for communication thread, message, participant, link, and attachment records. Support internal_note as the first channel only.`

9. `Create the intake bounded context for AI-safe review-first intake: IntakeEvent, IntakeArtifact, AiIntakeDraft, and IntakeApproval, including schemas, repositories, and a review queue service with no model inference yet.`

10. `Build the first workflow worker runtime skeleton with claim/process/retry/dead-letter support plus a scheduler entrypoint for SLA evaluation, but keep all policies disabled by default until lifecycle unification is complete.`

## Files changed

- `docs/audits/platform-expansion-master-plan.md`

## Assumptions made

- The audit reports in `docs/audits` are the authoritative source for current-state assessment and target-state recommendations.
- The near-term goal is an execution roadmap and not an immediate architecture rewrite.
- Additive migration is preferred over disruptive replacement because the platform is already mid-migration.

## Risks/blockers

- Quote runtime split remains the most significant structural blocker to a clean future-state workflow.
- Communications and AI should not be implemented directly on top of the current split lifecycle/state model.
- Security hardening must land before broader external communications or AI data processing rollout.

## Checks/tests run

- Reviewed:
  - `docs/audits/system-architecture-audit.md`
  - `docs/audits/work-order-lifecycle-audit.md`
  - `docs/audits/communications-readiness-audit.md`
  - `docs/audits/ai-intake-readiness-audit.md`
  - `docs/audits/rbac-security-expansion-audit.md`
  - `docs/audits/data-model-event-architecture-audit.md`
  - `docs/audits/sla-notifications-automation-audit.md`
- No code or automated tests were run because this task was documentation-only.
