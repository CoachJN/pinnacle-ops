# Data Model And Event Architecture Audit

Date: 2026-05-06

## Scope

This audit reviews the current persisted Firestore model, TypeScript domain model, validation layer, workflow/event architecture, and readiness for the next platform capabilities:

- unified activity timeline
- immutable event history
- communication events
- AI-generated drafts and summaries
- human approval tracking
- SLA timers
- workflow state transitions
- reporting snapshots
- contractor scorecards

Primary source areas reviewed:

- `src/server/repositories/firestore/models.ts`
- `src/server/repositories/firestore/collections.ts`
- `src/server/repositories/firestore/repositories.ts`
- `src/types/*.ts`
- `src/lib/validation/*.ts`
- `src/lib/workflows/**/*`
- `src/server/services/**/*`
- `src/lib/core-relationship-integrity.ts`
- `docs/data-entity-standards.md`

## 1. Current Entity Map

### Canonical top-level Firestore collections

Defined in `src/server/repositories/firestore/collections.ts`:

- `userProfiles`
- `contacts`
- `clientOrganizations`
- `clientOrganizationContactLinks`
- `locations`
- `locationContactLinks`
- `contractorOrganizations`
- `contractorContactLinks`
- `workOrders`
- `contractorQuotes`
- `clientQuotes`
- `quotes`
- `invoices`
- `assignments`
- `activityLogs`
- `internalNotifications`

### Runtime-persisted business entities

Based on `src/server/repositories/firestore/models.ts` and active repositories/services:

- `UserProfile`
  - tenant-scoped access identity
  - optional linkage to client org, contractor org, and visible locations
- `Contact`
  - canonical reusable person/contact record
- `ClientOrganization`
  - client account / customer organization
- `ClientOrganizationContactLink`
  - normalized many-to-many contact linkage
- `Location`
  - client-owned service site
- `LocationContactLink`
  - normalized many-to-many contact linkage
- `ContractorOrganization`
  - service provider / vendor organization
- `ContractorContactLink`
  - normalized many-to-many contact linkage
- `WorkOrder`
  - primary operational workflow entity
  - holds current workflow state and current quote/invoice pointers
  - embeds client/location/contractor snapshots
- `ContractorQuote`
  - contractor-submitted quote record
- `ClientQuote`
  - client-facing approval quote record derived from contractor quote or internal drafting
- `ClientInvoice`
  - receivables invoice record
- `Assignment`
  - execution/dispatch assignment record
- `ActivityLog`
  - append-only operational activity record, currently work-order anchored
- `InternalNotification`
  - role/user-targeted operational alert

### Additional runtime-persisted records outside the main Firestore entity map

These exist, but not as canonical top-level entities:

- `WorkOrderNote`
  - subcollection under work order via `src/lib/repositories/work-order-note.repository.ts`
- `WorkOrderAttachment`
  - subcollection under work order via `src/lib/repositories/work-order-attachment.repository.ts`

### Typed but not clearly canonicalized in persistence

- `Comment` and `Attachment` in `src/types/collaboration.ts`
  - modeled as reusable cross-entity business records
  - not mapped into the central Firestore repository layer today
- `ContractorInvoice` in `src/types/invoice.ts`
  - typed as a future payables entity
  - not present in `src/server/repositories/firestore/models.ts` or collection definitions
- workflow transition audit/event records
  - typed in `src/lib/workflows/audit/types.ts`
  - no concrete Firestore collections for transition audit log, transition event log, orchestration action log, SLA timers, or SLA breaches

### Model duplication / parallel domain surfaces

There are at least two overlapping model layers:

- the Firestore repository model in `src/server/repositories/firestore/models.ts`
- older or alternate module/domain shapes such as `src/modules/work-orders/domain/types.ts`

Notable differences include:

- older work-order shape includes `requiresQuote`, `quoteRequiredThresholdCents`, requester fields, `source`, `searchText`, and `isArchived`
- Firestore repository work-order shape instead uses snapshots and a narrower lifecycle timestamp set

This indicates the current platform has not fully converged on one canonical domain model.

## 2. Relationship Map

### Tenant / ownership baseline

Most top-level records inherit common audit fields:

- `organizationId`
- `recordStatus`
- `isDeleted`
- `createdAt`, `updatedAt`
- `createdByUserId`, `updatedByUserId`
- optional delete metadata

This is a strong baseline for multi-tenant ownership and record lifecycle tracking.

### Core operational relationships

- `ClientOrganization` 1-to-many `Location`
- `ClientOrganization` many-to-many `Contact` through `ClientOrganizationContactLink`
- `Location` many-to-many `Contact` through `LocationContactLink`
- `ContractorOrganization` many-to-many `Contact` through `ContractorContactLink`
- `WorkOrder` belongs to exactly one `ClientOrganization`
- `WorkOrder` belongs to exactly one `Location`
- `WorkOrder` optionally references:
  - `requestedByContactId`
  - `coordinatorUserId`
  - `managerUserId`
  - `assignedContractorId`
  - `currentQuoteId`
  - `currentInvoiceId`
- `Assignment` belongs to one `WorkOrder`
- `Assignment` belongs to one `ContractorOrganization` in the canonical types, but repository model currently allows `contractorOrganizationId: null`
- `ContractorQuote` belongs to one `WorkOrder`
- `ContractorQuote` should belong to one `ContractorOrganization`, but repository model currently allows `contractorOrganizationId: null`
- `ClientQuote` belongs to one `WorkOrder`
- `ClientQuote` belongs to one `ClientOrganization`
- `ClientQuote` belongs to one `Location`
- `ClientQuote` may reference one `sourceContractorQuoteId`
- `ClientInvoice` belongs to one `WorkOrder`
- `ClientInvoice` belongs to one `ClientOrganization`
- `ClientInvoice` belongs to one `Location`
- `ActivityLog` currently belongs to one `WorkOrder` even when the resource/entity is another object
- `InternalNotification` references an entity tuple and optional direct work-order / invoice / quote / assignment ids

### Existing integrity controls

`src/lib/core-relationship-integrity.ts` enforces important invariants:

- location must point to an existing client organization
- work order must align to existing client organization and location
- assignments, quotes, and invoices must align to work order ownership
- client quote to contractor quote lineage must stay tenant/work-order aligned

This is good application-level protection while Firestore lacks relational foreign keys.

### Relationship map summary

The core graph is operationally sensible:

- client organization -> location -> work order
- contractor organization -> assignment / contractor quote
- work order -> client quote / invoice / activity log / notifications

The main weakness is not missing basic references. The weakness is that current relationships primarily model present-state operations, not longitudinal history, communications, approvals, analytics, or derived reporting.

## 3. Missing Entities

The current model can support core work-order execution, but it does not yet have canonical entities for the future platform requirements below.

### Missing for unified timeline and immutable history

- `DomainEvent` / `EventEnvelope`
  - durable append-only event store for lifecycle, communication, AI, approval, and automation events
- `EntityStatusTransition`
  - normalized transition history table/collection if a full event stream is not adopted immediately
- `TimelineEntryProjection`
  - read model for a unified actor-visible timeline across work order, quote, invoice, assignment, communication, AI, and approval events

### Missing for communications

- `CommunicationThread`
- `CommunicationMessage`
- `CommunicationParticipant`
- `CommunicationDelivery`
- `CommunicationArtifact` or reusable attachment linkage

There is no current canonical model for inbound/outbound email, SMS, portal messaging, or call summaries. Internal notifications are not a substitute for communication history.

### Missing for AI intake and AI assistance

- `IntakeSubmission`
  - source payload from portal/email/SMS/manual entry/API
- `AiArtifact`
  - generated draft, summary, extraction, classification, or recommendation
- `AiRun`
  - model/provider execution metadata
- `AiApprovalCheckpoint`
  - human review and approval/rejection of AI output before operational commitment

### Missing for approvals and governance

- `ApprovalRequest`
- `ApprovalDecision`
- `ApprovalPolicySnapshot`

Today approval is mostly encoded as status changes and timestamps like `approvedAt`, but not as a first-class approval record with approver, payload version, reason, and evidence.

### Missing for SLA and automation durability

Typed interfaces exist for these, but there is no visible canonical persistence model:

- `WorkflowSlaTimer`
- `WorkflowSlaBreach`
- `WorkflowOrchestrationAction`
- `WorkflowExecutionAttempt`
- durable `TransitionEventRecord`
- durable `TransitionAuditRecord`

### Missing for reporting and analytics

- `ReportingSnapshot`
  - entity snapshot taken at key business transitions
- `MetricFact` / `AnalyticsFact`
  - denormalized facts for throughput, SLA, quote conversion, aging, approval cycle time, invoice cycle time
- `ContractorScorecard`
  - periodic scorecard aggregate
- `ContractorPerformanceFact`
  - on-time response, acceptance rate, completion time, rework, approval rate, invoice dispute rate

### Missing for future portals

- reusable `PortalConversation` or `PortalThread`
- cross-entity `Comment` / `Attachment` persistence aligned to `src/types/collaboration.ts`
- portal-visible timeline projection with visibility scoping

## 4. Weak Or Overloaded Fields

### Work order

- `status`
  - overloaded as the single representation of operational state, quote gate, approval gate, dispatch state, completion state, and finance state
  - several statuses represent orthogonal concerns that would be cleaner as separate dimensions
- `currentQuoteId` and `currentInvoiceId`
  - useful shortcuts, but they make the work order double as an aggregate root plus a projection cache
- lifecycle timestamps such as `submittedAt`, `approvedAt`, `completedAt`, `closedAt`
  - useful operationally
  - weak as canonical history because they only preserve latest-known milestone, not the full sequence or actor context
- embedded snapshots:
  - `clientSnapshot`
  - `locationSnapshot`
  - `contractorSnapshot`
  - helpful for reporting and display
  - but these are partial snapshots, not versioned business snapshots

### Quotes

- split between `ContractorQuote` and `ClientQuote`
  - operationally understandable
  - architecturally the biggest blocker to a clean quote lifecycle
- `quotes` collection exists in collection constants, but the canonical repository model is split into `contractorQuotes` and `clientQuotes`
  - this suggests an unfinished or partially migrated quote architecture
- status models are separate and do not roll into one unified quote aggregate lifecycle

### Invoice

- `qboInvoiceId` and `qboSyncStatus`
  - acceptable as summary integration markers
  - insufficient for audit-grade sync history
- missing dedicated external-sync event/history entity

### Assignment

- `contractorOrganizationId` nullable in repository model
  - weakens a relationship that standards describe as required
- one status dimension must currently carry assignment offer, acceptance, decline, and completion states without a fuller assignment event history

### Activity log

- `action` and `eventType` are both free strings
  - too weak for canonical enterprise event taxonomy
- `workOrderId` required on all activity logs
  - over-anchors the log around work orders and weakens future cross-entity use
- both `resource*` and `entity*` fields are present
  - likely redundant or under-defined
- `metadata: Record<string, unknown>`
  - flexible, but can become a dumping ground without schema contracts
- `changes` values are untyped `unknown`
  - limits analytics, compliance review, and stable rendering

### Notifications

- `InternalNotification`
  - useful as an alert inbox
  - overloaded if it is ever expected to serve as automation queue, SLA evidence, or communication history

## 5. Event Sourcing / Readiness Assessment

### Overall assessment

Current readiness: **partial foundation, not event-source ready**

### What is already strong

- append-only `ActivityLog` exists
- workflow transition engine exists
- typed `TransitionAuditRecord` and `TransitionEventRecord` exist
- orchestration and SLA runtime types already exist
- transition service integrates:
  - authorization
  - transition validation
  - audit attempt/success logging
  - reaction hooks
  - orchestration hooks
  - SLA hooks

This is a good architectural direction.

### What blocks event-sourcing readiness

- no visible durable collection for transition events
- no visible durable collection for transition audit attempts/results
- no durable Firestore persistence for orchestration actions, SLA timers, SLA breaches, or workflow execution attempts
- quote transition runtime is explicitly deferred in `src/lib/workflows/transition-service/apply-quote-transition.ts`
- quote orchestration and quote SLA runtime are explicitly marked deferred in workflow modules
- business entities still rely on mutable current-state records as source of truth
- activity log is work-order-centric and not a true event envelope

### Interpretation

The platform is closer to:

- state-based CRUD plus operational logs
- with typed workflow/event scaffolding

It is not yet:

- event-sourced
- or even fully event-driven with durable event persistence across all core lifecycles

### Practical conclusion

Do not attempt full event sourcing as the first stabilization move.

The right near-term target is:

1. one canonical current-state model per entity
2. one durable append-only event model
3. one derived timeline projection
4. one durable automation/SLA persistence layer

That creates event-driven readiness without the migration cost of rebuilding the whole platform as a pure event-sourced system.

## 6. Auditability Gaps

### Current strengths

- base audit fields exist on core top-level entities
- soft deletion pattern is standardized
- `ActivityLog` preserves actor, action, timestamp, visibility, and field changes
- workflow transition types distinguish success/failure/rejection

### Gaps

- no immutable, durable transition event store is visible
- no durable record of failed transition attempts unless an optional audit repository is configured
- no canonical approval record:
  - who approved
  - what artifact version was approved
  - why
  - under what policy/rules
- no canonical AI action record or human override record
- no communication audit trail for messages, deliveries, or read/reply history
- no versioned snapshot capture at critical decisions
- no explicit concurrency/version field on high-churn entities
- work-order notes and attachments are work-order-only artifacts, not generalized auditable business records
- `ActivityLog.action` and `eventType` are stringly typed and therefore weaker for compliance-grade querying
- no explicit retention model for audit/event records

## 7. Reporting Readiness Gaps

### What is currently report-friendly

- top-level collections for major business entities
- embedded work-order and invoice snapshots help preserve some display context
- dashboard and finance queue modules already derive operational summaries from canonical records

### What is not yet reporting-ready for future requirements

- no snapshot/fact layer for historical reporting as entities change over time
- activity log is not sufficient as a reporting fact table
- no normalized event catalog for:
  - communication events
  - approval events
  - AI events
  - SLA start/stop/breach events
  - automation actions and outcomes
- contractor rating is only a small `ratingSummary` object, not a scorecard/performance model
- no explicit facts for:
  - quote turnaround
  - approval latency
  - assignment acceptance rate
  - time-to-dispatch
  - time-in-status
  - invoice aging
  - rework / reopen rate
  - portal response performance
- nullable / duplicate timestamp fields across entities make historical metric definitions fragile
- split quote model complicates quote funnel reporting

### Reporting conclusion

The platform can support basic operational dashboards now, but not trustworthy long-horizon analytics for SLA, automation effectiveness, contractor performance, AI governance, or communications intelligence without additional canonical event and snapshot layers.

## 8. Recommended Canonical Data Model

### Architectural direction

Adopt a **hybrid canonical model**:

- current-state business entities remain first-class for application reads/writes
- append-only domain events become first-class for history, automation, SLA, audit, and analytics
- read models/projections support portals, timelines, and reporting

### A. Core current-state entities

Retain and stabilize:

- `UserProfile`
- `Contact`
- `ClientOrganization`
- `Location`
- `ContractorOrganization`
- `WorkOrder`
- `Assignment`
- `Quote`
- `Invoice`

Recommended adjustment:

- collapse split quote persistence into a canonical `Quote` aggregate with:
  - `quoteType`: `contractor` | `client`
  - `sourceQuoteId`
  - `workOrderId`
  - `contractorOrganizationId`
  - `clientOrganizationId`
  - `locationId`
  - `status`
  - `approvalStatus`
  - price fields
  - timestamps

If keeping separate contractor/client quote records is operationally preferred, introduce a wrapper aggregate or a normalized event model that makes quote history queryable as one lifecycle.

### B. Canonical event envelope

Add a top-level immutable collection such as `domainEvents` with fields like:

- `eventId`
- `organizationId`
- `aggregateType`
- `aggregateId`
- `entityType`
- `entityId`
- `eventType`
- `eventVersion`
- `occurredAt`
- `recordedAt`
- `actor`
- `correlationId`
- `causationId`
- `requestId`
- `visibility`
- `payload`
- `metadata`

Event types should cover:

- work order lifecycle
- quote lifecycle
- invoice lifecycle
- assignment lifecycle
- communication events
- AI generation and approval events
- SLA timer events
- workflow automation actions
- portal actions

### C. Approval model

Add:

- `approvalRequests`
- `approvalDecisions`

Key fields:

- `subjectEntityType`
- `subjectEntityId`
- `approvalType`
- `requestedAt`
- `requestedBy`
- `decisionStatus`
- `decidedAt`
- `decidedBy`
- `artifactVersionId` or approved snapshot id
- `decisionReason`

### D. Communication model

Add:

- `communicationThreads`
- `communicationMessages`
- `communicationParticipants`
- `communicationDeliveries`

This should support:

- email/SMS/portal/internal message channels
- thread-to-work-order linkage
- message direction
- delivery status
- inbound/outbound payload references
- visibility controls

### E. AI artifact model

Add:

- `aiArtifacts`
- `aiRuns`
- `aiApprovalCheckpoints`

Support:

- intake extraction
- summary generation
- draft quote/invoice/note creation
- recommendation artifacts
- human approval or rejection
- provenance to source communication/intake/event

### F. SLA and automation durability

Persist the already-designed workflow records as top-level collections:

- `transitionAudits`
- `transitionEvents`
- `workflowOrchestrationActions`
- `workflowExecutionAttempts`
- `workflowSlaTimers`
- `workflowSlaBreaches`

### G. Timeline and reporting projections

Add read models:

- `timelineEntries`
  - one unified timeline projection
- `reportingSnapshots`
  - snapshots at key milestones
- `contractorPerformanceFacts`
- `contractorScorecards`

### H. Work order model normalization

Keep work order as the aggregate root for operations, but separate concerns:

- `status`
  - execution/workflow state
- `approvalStatus`
  - none / pending / approved / rejected
- `quoteStatus`
  - none / requested / received / client_pending / resolved
- `invoiceStatus`
  - none / draft / sent / overdue / paid
- `slaState`
  - projection field, not source of truth

These can remain projections if the event model is authoritative for history.

## 9. Migration / Stabilization Considerations

### Key risks

- current repo is mid-migration already, with many modified files and overlapping model paths
- quote model split is the highest-risk structural issue
- parallel work-order type systems can create silent drift in validation, routing, workflow logic, and reporting
- activity log semantics may be relied upon by UI and QA as “timeline”

### Recommended migration stance

Prefer additive stabilization over disruptive replacement:

1. stabilize canonical types first
2. add missing event/history collections second
3. build projections third
4. migrate UI and reporting to projections
5. deprecate legacy model surfaces last

### Specific migration considerations

- do not remove current `ActivityLog` immediately
  - instead, reframe it as a timeline projection source or legacy activity feed
- add event persistence alongside current services first
- treat `currentQuoteId` and `currentInvoiceId` as projection shortcuts, not historical truth
- backfill transition events from current entity timestamps and activity logs where feasible
- decide whether `quotes` becomes:
  - the new unified canonical quote collection
  - or is removed after confirming `contractorQuotes` + `clientQuotes` remain permanent
- align `Comment` / `Attachment` types with persistence before expanding portals/communications
- introduce version or revision fields on high-churn entities
- define visibility model for timeline/event records before exposing unified portal timelines

### Backfill limits

Some future analytics cannot be reconstructed perfectly from current data, especially:

- approval decision lineage
- communication history
- AI provenance
- precise time-in-status for all entities
- workflow attempt failures not durably persisted today

That should be called out explicitly in future reporting expectations.

## 10. Implementation Phases

### Phase 1: Canonical model stabilization

- choose and document one canonical current-state model for:
  - work order
  - quote
  - invoice
  - assignment
- reconcile `src/server/repositories/firestore/models.ts`, `src/types/*.ts`, and `src/modules/**/domain/types.ts`
- decide final quote aggregate strategy
- make required relationships non-null where business rules require them

### Phase 2: Durable event and audit foundation

- add canonical collections for:
  - `transitionAudits`
  - `transitionEvents`
  - `domainEvents`
- persist successful and failed lifecycle transitions durably
- standardize event taxonomy and correlation metadata

### Phase 3: SLA and automation persistence

- add persistence for:
  - `workflowSlaTimers`
  - `workflowSlaBreaches`
  - `workflowOrchestrationActions`
  - `workflowExecutionAttempts`
- wire current workflow libraries to concrete Firestore repositories
- remove “repository unavailable” and “runtime deferred” gaps for active lifecycles

### Phase 4: Unified timeline and collaboration records

- create canonical `comments` and `attachments` top-level collections
- create `timelineEntries` projection
- feed timeline from:
  - activity logs
  - transition events
  - comments
  - attachments
  - notifications
  - later communications and AI artifacts

### Phase 5: Communication and portal readiness

- add communication thread/message model
- support inbound and outbound communication events
- define portal-safe visibility projections
- tie communication records to work orders, quotes, invoices, and clients

### Phase 6: AI intake and approval governance

- add intake submission, AI artifact, AI run, and AI approval entities
- require human approval checkpoints for operationally sensitive AI actions
- emit durable AI provenance events

### Phase 7: Reporting and contractor performance

- add reporting snapshots/facts
- implement contractor performance facts and scorecards
- formalize KPI definitions from canonical events, not from UI heuristics

## Bottom Line

The platform already has a solid operational core:

- top-level business collections
- shared audit fields
- normalized contact links
- workflow transition scaffolding
- SLA/orchestration type design

But it is not yet structurally ready for communications, AI intake, immutable event history, enterprise-grade auditability, or advanced reporting without a new canonical event layer and a small set of missing supporting entities.

The most important next move is not adding more statuses or more activity log messages. It is stabilizing one canonical entity model and making event, approval, SLA, and communication records first-class persisted data structures.
