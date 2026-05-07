# AI Intake Readiness Audit

## Executive summary

The platform is not yet ready for safe AI-assisted work order creation from email, phone transcripts, portal requests, SMS, and internal notes.

The current platform is reasonably solid for human-driven internal intake through the dashboard create flow and active API path, but it is missing the core controls that AI intake requires:

- no intake-event or communication-thread domain
- no AI draft or review-queue model
- no confidence, evidence, or provenance storage
- no duplicate-detection workflow
- no pre-create human approval checkpoint
- no durable governance model for model output, prompt/versioning, or AI-originated actions

There is also an architectural risk: work-order types, statuses, and validation logic still exist in multiple active shapes, which raises the chance of AI features binding to the wrong model surface.

## 1. Current intake architecture

### Active create path

The active work-order create path appears to be:

- UI: [`src/components/work-orders/create/work-order-create-page.tsx`](/home/craig/projects/pinnacle-ops/src/components/work-orders/create/work-order-create-page.tsx)
- Form: [`src/components/work-orders/create/work-order-form.tsx`](/home/craig/projects/pinnacle-ops/src/components/work-orders/create/work-order-form.tsx)
- Route: [`src/app/api/work-orders/route.ts`](/home/craig/projects/pinnacle-ops/src/app/api/work-orders/route.ts)
- API orchestration: [`src/server/api/work-order-core.ts`](/home/craig/projects/pinnacle-ops/src/server/api/work-order-core.ts)
- Create service: [`src/server/services/work-order-core/create-work-order.service.ts`](/home/craig/projects/pinnacle-ops/src/server/services/work-order-core/create-work-order.service.ts)
- Validation and relationship checks: [`src/server/services/work-order-core/shared.ts`](/home/craig/projects/pinnacle-ops/src/server/services/work-order-core/shared.ts)
- Persistence: [`src/lib/repositories/work-order.repository.ts`](/home/craig/projects/pinnacle-ops/src/lib/repositories/work-order.repository.ts)

### What the current flow does well

- Route handlers are thin and delegate to services.
- Input validation happens at the API/service boundary.
- Client and location linkage is revalidated server-side.
- Access control is enforced server-side before creation.
- Requester metadata is already captured in the active domain model.
- Activity log infrastructure exists for downstream workflow actions.

### Current intake channels actually supported

The active source enum supports:

- `MANUAL`
- `CLIENT_PORTAL`
- `EMAIL`
- `PHONE`

Reference:

- [`src/modules/work-orders/domain/constants.ts`](/home/craig/projects/pinnacle-ops/src/modules/work-orders/domain/constants.ts)

However, only the internal dashboard create UI is clearly implemented today. I did not find a durable omnichannel intake architecture for:

- inbound email processing
- SMS ingestion
- transcript ingestion
- internal note ingestion as a create source
- communication thread storage
- message-to-work-order correlation

### Architecture concerns relevant to AI

The repo still carries multiple active work-order models and lifecycle representations:

- legacy/general types: [`src/types/work-order.ts`](/home/craig/projects/pinnacle-ops/src/types/work-order.ts)
- active module DTOs: [`src/modules/work-orders/domain/types.ts`](/home/craig/projects/pinnacle-ops/src/modules/work-orders/domain/types.ts)
- multiple lifecycle paths noted in [`docs/audits/system-architecture-audit.md`](/home/craig/projects/pinnacle-ops/docs/audits/system-architecture-audit.md)

That model split is a direct AI-readiness issue. AI intake needs one canonical create target and one canonical approval path.

## 2. Required fields and validation gaps

### Current required create fields

From the active create schema in [`src/modules/work-orders/domain/schemas.ts`](/home/craig/projects/pinnacle-ops/src/modules/work-orders/domain/schemas.ts), the required fields are:

- `title`
- `description`
- `clientOrganizationId`
- `locationId`
- `priority`
- `category`
- `requestedByName`
- `source`
- `createdByUserId`

Optional fields include:

- `requestedByContactId`
- `siteContactId`
- `requestedServiceDate`
- `requiresQuote`
- `quoteRequiredThresholdCents`
- `requestedByEmail`
- `requestedByPhone`
- `coordinatorUserId`
- `managerUserId`
- `dueDate`
- `status`

### Existing validation strengths

- strict payload validation with unknown-field rejection
- enum validation for priority, category, and source
- email validation for requester email
- date parsing for requested service date and due date
- server-side client/location relationship validation
- quote-threshold validation when `requiresQuote` is false

### Validation gaps for AI-safe intake

The current platform still needs the following before AI can safely draft records:

- `requestedByContactId` is not validated to belong to the selected client or location.
- `siteContactId` is not validated to belong to the selected location.
- `requestedByName` is required even when no contact match is found, but there is no structured distinction between:
  - matched existing contact
  - newly observed requester
  - unmatched free-text requester
- There is no `emergency` or `life_safety` field.
- There is no structured `severity_reason` or `priority_reason`.
- There is no `problem_summary` separate from the user-facing title.
- There is no `intake_channel_message_id`, `conversation_id`, `source_event_id`, or `thread_id`.
- There is no structured source payload reference back to the original email/transcript/SMS/note.
- There is no `duplicate_of_workOrderId` or `possible_duplicate_ids`.
- There is no `ai_confidence`, `ai_review_required`, or per-field confidence.
- There is no `approval_status` or `draft_status` for pre-create review.
- There is no field for suggested contractor/trade with rationale.
- Source enum does not cover `SMS` or `INTERNAL_NOTE`.

### Category and priority constraints

The active category model is a small fixed enum:

- `GENERAL_REPAIR`
- `ELECTRICAL`
- `PLUMBING`
- `HVAC`
- `CLEANING`
- `OTHER`

This is safe for manual intake, but too shallow for AI-assisted classification unless:

- category taxonomy is expanded, or
- the AI can propose a normalized top-level category plus a richer subcategory/problem code

## 3. Data quality risks

### Entity matching risks

- Client extraction is currently external to the work-order core. There is no intake matching layer for client organizations.
- Location matching depends on exact selected IDs today. There is no fuzzy location resolution workflow.
- Requester identity is split across free-text fields and optional contact IDs, which is good for flexibility but risky without explicit match-state tracking.

### Contact and requester risks

Contact records support email, phone, preferred method, and relationship links, but intake creation does not currently enforce requester/site-contact linkage to the chosen client/location.

Relevant files:

- [`src/server/services/contact-service.ts`](/home/craig/projects/pinnacle-ops/src/server/services/contact-service.ts)
- [`src/types/contact.ts`](/home/craig/projects/pinnacle-ops/src/types/contact.ts)
- [`src/tests/integration/api/contact-linking.test.ts`](/home/craig/projects/pinnacle-ops/src/tests/integration/api/contact-linking.test.ts)

### Duplicate and repeat issue risks

- The platform stores normalized `searchText`, which helps basic search.
- I did not find duplicate-detection logic in the active create flow.
- Search text currently includes title, description, requester text, and IDs, but not a structured issue fingerprint.

Relevant files:

- [`src/server/services/work-order-core/create-work-order.service.ts`](/home/craig/projects/pinnacle-ops/src/server/services/work-order-core/create-work-order.service.ts)
- [`src/lib/repositories/work-order.firestore.ts`](/home/craig/projects/pinnacle-ops/src/lib/repositories/work-order.firestore.ts)

### Workflow and lifecycle risks

- No pre-create draft state exists in the active create model.
- `POST /api/work-orders` creates the work order immediately after validation.
- Quote/client approval exists later in the lifecycle, but not for intake approval.

### Operational data quality risks

- No communication thread means investigators cannot reliably compare AI extraction to the original message stream.
- No structured evidence model means approvals would rely on untraceable prompt output.
- No transaction/idempotency pattern is obvious for future multi-entity intake flows, which matters when drafts, matches, logs, and approvals will be created together.

## 4. AI-safe draft model recommendation

AI should not write directly into `workOrders` as the first step.

### Recommended new bounded context

Add an intake domain separate from the canonical work-order record:

- `IntakeEvent`
- `IntakeArtifact`
- `AiIntakeDraft`
- `AiIntakeDecision`
- `IntakeApproval`

### Recommended draft shape

`AiIntakeDraft` should contain:

- `id`
- `organizationId`
- `sourceChannel`
  - `email`
  - `phone_transcript`
  - `portal`
  - `sms`
  - `internal_note`
- `sourceEventId`
- `conversationId` or `threadId`
- `rawArtifactIds`
- `normalizedText`
- `draftStatus`
  - `new`
  - `parsed`
  - `needs_review`
  - `approved`
  - `rejected`
  - `converted`
- extracted candidate fields:
  - `clientOrganizationId`
  - `locationId`
  - `requestedByContactId`
  - `requestedByName`
  - `requestedByEmail`
  - `requestedByPhone`
  - `category`
  - `priority`
  - `isEmergency`
  - `title`
  - `description`
  - `requestedServiceDate`
  - `requiresQuote`
  - `suggestedContractorOrganizationId`
  - `suggestedTrade`
- per-field confidence map
- per-field evidence spans
- candidate alternatives
- duplicate candidates
- model metadata:
  - `model`
  - `promptVersion`
  - `classifierVersion`
  - `generatedAt`
- review flags
- reviewer decision fields

### Key rule

Only after approval should the system map `AiIntakeDraft` into the canonical `workOrders` create DTO.

## 5. Human approval workflow recommendation

### Current gap

The current create route creates a work order immediately. There is no intake approval gate.

### Recommended workflow

1. Create `IntakeEvent` from the incoming channel.
2. Store raw artifacts and normalized text.
3. Run AI extraction and matching into `AiIntakeDraft`.
4. Run deterministic validation and duplicate screening.
5. Route the draft to a human review queue.
6. Reviewer can:
   - approve as-is
   - edit and approve
   - reject
   - merge into existing work order
   - mark as non-work-order communication
7. Only approval triggers `POST` into canonical work-order creation.
8. Dispatch/assignment must remain blocked until post-create human decisions are complete.

### Approval UI requirements

- side-by-side source evidence and extracted fields
- visible confidence and rationale per field
- candidate client/location/contact matches with alternates
- duplicate candidates with recent history
- explicit emergency flag acknowledgement
- clear “create new” vs “link existing” decision
- audit-visible reviewer identity, timestamp, and edits

## 6. Duplicate detection requirements

The platform needs explicit duplicate detection before AI-created intake is safe.

### Minimum duplicate signals

- same client organization
- same location
- same requester email or phone
- similar title/description
- same category
- close time window
- active open work orders in non-terminal states
- recent closed work orders for repeat-issue detection

### Recommended outputs

For each candidate duplicate:

- `workOrderId`
- match score
- reasons
  - same location
  - same requester
  - similar issue text
  - recent similar issue
- suggested action
  - attach note
  - reopen
  - create follow-up
  - create new work order

### Recommended implementation detail

Do not rely on `searchText` alone. Add a dedicated duplicate-screening service that combines:

- deterministic filters
- normalized text similarity
- recency windows
- status-aware weighting

## 7. Confidence scoring requirements

AI intake needs confidence at both overall and per-field levels.

### Required confidence dimensions

- client match confidence
- location match confidence
- requester match confidence
- category confidence
- priority confidence
- emergency confidence
- duplicate-risk confidence
- contractor/trade suggestion confidence
- response-draft confidence

### Required gating behavior

- low confidence on client or location must block auto-conversion
- any emergency-positive result must force human review
- any high duplicate-risk result must force merge/review flow
- unmatched requester should remain allowed, but clearly marked
- low category confidence should allow approval with manual correction

### Evidence requirements

Every confidence score should be explainable through:

- source text snippets
- deterministic rule hits
- alternative candidates
- model/version metadata

## 8. Audit and governance requirements

### What exists today

- request-scoped API logging
- safe error responses
- activity log service for work-order activity
- security audit primitives

Relevant files:

- [`src/server/api/work-orders.ts`](/home/craig/projects/pinnacle-ops/src/server/api/work-orders.ts)
- [`src/server/services/activity-log-service.ts`](/home/craig/projects/pinnacle-ops/src/server/services/activity-log-service.ts)
- [`src/lib/audit-log.ts`](/home/craig/projects/pinnacle-ops/src/lib/audit-log.ts)

### Gaps for AI governance

- no durable AI decision log
- no model/prompt/version persistence on intake results
- no stored evidence spans for extracted fields
- no reviewer decision model for draft approval
- no audit query surface for AI-originated actions
- no formal policy for retention of raw communications and transcripts
- no explicit correlation ID strategy spanning source event, AI draft, approval, and created work order

### Required governance additions

- durable AI intake audit records
- raw artifact retention policy by channel
- prompt/model/version capture on every draft
- per-field provenance and reviewer override capture
- clear distinction between:
  - source text
  - AI output
  - human edits
  - final created record
- reporting on:
  - approval rate
  - rejection rate
  - override rate
  - duplicate miss rate
  - emergency false positive/negative rate

## 9. Implementation phases for AI intake

### Phase 1: Canonical intake boundary

- choose one canonical work-order create model
- document the active create contract
- add missing source enums for `SMS` and `INTERNAL_NOTE`
- define intake-specific IDs and correlation strategy

### Phase 2: Intake domain foundation

- add `IntakeEvent`, `IntakeArtifact`, and `AiIntakeDraft`
- persist raw inbound messages/transcripts safely
- add normalized text and artifact references
- add draft statuses and review flags

### Phase 3: Matching and validation hardening

- build client/location/contact matching services
- enforce requester/site-contact linkage rules
- add emergency, duplicate, and severity validation rules
- add deterministic preflight checks before approval

### Phase 4: Human review workflow

- build review queue and reviewer UI
- show evidence, confidence, alternatives, and duplicate candidates
- require explicit approval before work-order creation
- add merge/link-to-existing decision paths

### Phase 5: Controlled conversion to work order

- map approved draft to canonical `CreateWorkOrderDto`
- write durable activity/audit records for conversion
- block assignment/dispatch until approval-complete invariants hold
- add idempotency and transactional safeguards

### Phase 6: Recommendations and response generation

- add contractor/trade suggestions using category and contractor-trade fit
- add customer response drafting with human review
- measure suggestion acceptance and correction rates

### Phase 7: Production governance and quality loop

- add dashboards for confidence, overrides, duplicates, and emergency misses
- tune prompt/model versions with evaluation datasets
- add regression tests for real intake samples across all channels

## Testing assessment

Current test coverage is a strength, but mostly around domain/service rules rather than omnichannel intake.

Strong existing coverage includes:

- work-order create/list service behavior
- location linkage validation
- contact linking normalization
- validation strictness

Relevant tests:

- [`src/tests/work-order-core-services.test.mts`](/home/craig/projects/pinnacle-ops/src/tests/work-order-core-services.test.mts)
- [`src/tests/integration/api/work-orders-location-linking.test.ts`](/home/craig/projects/pinnacle-ops/src/tests/integration/api/work-orders-location-linking.test.ts)
- [`src/tests/integration/api/contact-linking.test.ts`](/home/craig/projects/pinnacle-ops/src/tests/integration/api/contact-linking.test.ts)
- [`src/tests/unit/validation/work-orders.test.ts`](/home/craig/projects/pinnacle-ops/src/tests/unit/validation/work-orders.test.ts)

Missing test layers for AI readiness:

- inbound channel ingestion tests
- intake matching tests with ambiguous entities
- duplicate-detection evaluation tests
- confidence-threshold gating tests
- human approval conversion tests
- audit/provenance completeness tests
- end-to-end tests from source artifact to approved work-order creation

## Bottom line

The platform is ready to be the destination for approved intake, but it is not ready to let AI draft directly into canonical work orders.

The safest path is:

1. keep `workOrders` as the approved operational record
2. add a separate intake-and-draft bounded context
3. require human approval before conversion
4. add provenance, confidence, duplicate detection, and governance before any dispatch-adjacent automation
