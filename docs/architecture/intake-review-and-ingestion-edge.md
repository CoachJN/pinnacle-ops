# Intake Review And Ingestion Edge

Date: 2026-05-06

## 1. Review architecture overview

Phase 8 promotes intake review from a draft-only foundation into an operational workflow.

Canonical rules:

- external providers may create only canonical `intakeEvents`, `intakeArtifacts`, communication records, and communication attachments
- external providers may not create work orders
- external providers may not mutate lifecycle state
- human reviewers remain authoritative for assignment, escalation, duplicate resolution, rejection, and conversion

Canonical review runtime now lives in:

- `src/server/services/intake-service.ts`
- `src/app/api/intake/review/*`
- `src/app/(app)/dashboard/intake/page.tsx`

Deprecated review-flow vocabulary:

- phase-7 review completion events `ai_intake_reviewed`, `ai_intake_approved`, `ai_intake_merged`, and `ai_intake_escalated` are no longer the canonical review events

Replacement path:

- review progress now emits `intake_review_started`, `intake_review_assigned`, `intake_review_decision_recorded`, `intake_review_escalated`, `duplicate_reviewed`, `duplicate_marked_false_positive`, `duplicate_merged`, `intake_conversion_requested`, and `intake_conversion_completed`

## 2. Queue projection model

The intake review queue projects from canonical `intakeEvents` plus the latest `AiIntakeDraft`.

Supported filters:

- `reviewStatus`
- confidence range
- `escalationState`
- duplicate risk
- `sourceType`
- assigned reviewer
- created-at window
- urgency
- lifecycle recommendation

Deterministic ordering:

- primary sort by requested queue sort
- secondary sort by immutable `generatedAt`
- final tie-break by stable draft id

This keeps the queue future-safe for SLA workers and orchestration workers without coupling review state to background processors.

## 3. Duplicate comparison architecture

Duplicate comparison reads from canonical duplicate candidates on the intake draft and resolves candidate work orders through canonical repositories and services.

Each duplicate comparison view can show:

- candidate work-order identity
- lifecycle and priority
- client and location snapshots
- canonical work-order timeline
- canonical communication timeline
- communication attachment visibility

No duplicate action mutates the target work order directly beyond an approved merge decision.

## 4. Merge workflow architecture

Supported duplicate workflow actions:

- `merge_into_existing`
- `false_positive`
- `escalate`
- `create_new`

Canonical behavior:

- `false_positive` updates duplicate candidate status without converting intake
- `merge_into_existing` records an `IntakeDecision`, an `IntakeApproval`, and emits `duplicate_merged`
- `create_new` routes through the human-approved conversion boundary and emits `intake_conversion_requested` then `intake_conversion_completed`
- `escalate` records a durable review decision and emits `intake_review_escalated`

## 5. Provider ingestion boundary model

Provider adapters are provider-agnostic inputs to one canonical ingestion boundary.

Canonical ingestion contract:

- `NormalizedIngestionPayload`

Current provider boundary responsibilities:

- normalize provider message content
- normalize sender and recipient metadata
- normalize thread references
- normalize provider metadata
- normalize attachment metadata
- create canonical intake records
- create canonical communication records
- link communications explicitly to intake entities

Non-responsibilities:

- provider polling
- provider sync
- delivery retries
- work-order creation
- lifecycle mutation
- autonomous operational actions

## 6. Normalized ingestion payload model

`NormalizedIngestionPayload` stores:

- source type
- provider channel
- received and sent timestamps
- normalized message content
- normalized sender metadata
- normalized recipients
- normalized thread references
- normalized provider metadata
- normalized attachment metadata
- organization scope
- optional summary
- extensible metadata

Prepared providers:

- Outlook
- Gmail
- Twilio
- Teams
- Slack
- voicemail pipelines
- OCR pipelines

## 7. Attachment ingestion foundation

Attachment ingestion is now canonical at the intake edge.

Current behavior:

- communication attachments are created as top-level communication records
- intake artifacts persist canonical attachment references
- attachment references store provider id, content metadata, storage path, and upload time
- attachment linkage is explicit between communication and intake

Not implemented yet:

- OCR extraction
- attachment text extraction
- autonomous enrichment

## 8. Communication/intake bridging model

Phase 8 makes communication and intake linkage explicit.

Canonical bridge behavior:

- provider-safe communication records can be created before a work order exists
- intake events can reference communication thread and message ids
- communication links can target `intake_event`
- communication events remain durable timeline events
- intake detail reads can render the linked communication payload and attachments

This preserves deterministic ordering while keeping pre-work-order communication activity out of authoritative work-order state.

## 9. Review event model

Canonical review events now include:

- `intake_review_started`
- `intake_review_assigned`
- `intake_review_decision_recorded`
- `intake_review_escalated`
- `duplicate_reviewed`
- `duplicate_marked_false_positive`
- `duplicate_merged`
- `intake_conversion_requested`
- `intake_conversion_completed`

All review events are:

- actor-attributed
- visibility-scoped
- tenant-scoped
- timeline-compatible
- durable-event-safe for future orchestration consumers

## 10. Future provider integration strategy

Future provider adapters should:

- normalize payloads into `NormalizedIngestionPayload`
- call the canonical ingestion boundary
- persist only communications, communication attachments, intake events, and intake artifacts
- emit no provider-owned shadow timeline tables

They should not:

- create work orders directly
- attach directly to lifecycle services
- mutate authoritative entities through side effects

## 11. Future AI inference strategy

Future AI systems should continue to:

- read canonical intake and communication records
- write non-authoritative suggestions, evidence, confidence, and candidate matches
- remain decoupled from operational mutations

They should not:

- bypass human review
- submit authoritative merge or conversion actions
- write directly into lifecycle state

## 12. Future SLA/orchestration integration points

Future workers should subscribe to:

- intake review events
- duplicate resolution events
- communication creation and linkage events
- lifecycle events after conversion

Workers should persist their own timer or orchestration records separately, then project outcomes back into the canonical event stream.
