# AI Intake Foundation

Date: 2026-05-06

## 1. Intake architecture overview

Phase 7 introduces a canonical intake bounded context for AI-safe operational intake.

Core rule:

- AI may extract, classify, summarize, score confidence, and suggest actions.
- AI may not directly create or mutate authoritative operational state.
- Humans remain authoritative for approval, rejection, merge, escalation, and operational judgment.

Canonical runtime responsibilities:

- persist intake events as provider-agnostic intake aggregates
- persist immutable intake artifacts for normalized source content and provenance
- persist AI intake drafts with confidence, evidence, candidate matches, and governance metadata
- persist human review decisions and approvals as durable records
- convert approved intake through one controlled boundary into canonical `workOrders`
- emit durable domain events for intake creation and review milestones

## 2. Intake event model

Top-level collection:

- `intakeEvents`

Responsibilities:

- source identity and provider-agnostic linkage
- intake review state
- related artifact, draft, decision, and work-order linkage
- tenant-safe visibility metadata
- durable intake aggregate id for intake timeline/history

Canonical statuses:

- `received`
- `drafted`
- `under_review`
- `approved`
- `rejected`
- `merged`
- `escalated`
- `converted`

Supported source types now:

- `communication_message`
- `portal_submission`
- `internal_manual`
- `system_generated`

Reserved for future expansion:

- `email`
- `sms`
- `voicemail`
- `ocr`
- `attachment`
- `transcript`

## 3. Intake artifact model

Top-level collection:

- `intakeArtifacts`

Artifacts are immutable append-only intake records.

Responsibilities:

- normalized content
- optional raw payload snapshot
- structured metadata
- source linkage
- communication linkage
- attachment linkage
- future transcript and OCR storage

Artifact kinds now:

- `normalized_content`
- `structured_submission`
- `attachment_reference`
- `transcript`
- `ocr_text`
- `extracted_snippet`

## 4. AI draft model

Top-level collection:

- `aiIntakeDrafts`

Draft responsibilities:

- extracted title, description, priority, category, location, client, contacts, trade, urgency, and suggested lifecycle
- overall and per-field confidence
- evidence spans and extracted snippets
- candidate matches for location, contacts, duplicates, and work orders
- governance fields for model, prompt version, run id, and generation time
- reviewer attribution, decision, notes, and conversion outcomes

Canonical review states:

- `pending_review`
- `approved`
- `approved_with_edits`
- `rejected`
- `merged_into_existing`
- `escalated`
- `converted`

## 5. Evidence model

Evidence is persisted inside `AiIntakeDraft.evidence`.

Each evidence record stores:

- extracted field
- source type
- artifact or communication reference
- excerpt
- start and end offsets when known
- confidence
- rationale
- metadata

This supports:

- explainability
- reviewer traceability
- operational auditability

## 6. Confidence model

Confidence is persisted in two layers:

- `overallConfidence`
- `perFieldConfidence`

Confidence is reviewable data, not authoritative data. Human reviewers remain responsible for approval decisions even when confidence is high.

## 7. Duplicate detection model

Duplicate screening is intentionally foundational, not autonomous.

Current persisted model:

- `duplicateCandidates` on `AiIntakeDraft`
- `workOrderMatchSuggestions` on `AiIntakeDraft`
- reviewer false-positive handling through `IntakeApproval` and draft updates

Each duplicate candidate stores:

- candidate work order id
- candidate work order number
- confidence
- rationale
- review status

No autonomous merge occurs in this phase.

## 8. Review workflow model

Top-level collections:

- `intakeApprovals`
- `intakeDecisions`

Supported review decisions:

- `approve`
- `approve_with_edits`
- `reject`
- `merge_into_existing`
- `escalate`

Workflow rules:

- every review action writes an `IntakeDecision`
- approval and merge checkpoints also write an `IntakeApproval`
- reviewer attribution, notes, timestamps, and duplicate-resolution metadata are persisted
- non-internal actors do not receive intake queue data

## 9. Conversion safety model

Authoritative conversion path:

`AiIntakeDraft` -> `IntakeDecision` / `IntakeApproval` -> approved DTO -> `workOrders.create`

Safety rules:

- AI drafts never call canonical work-order mutation directly
- only human review can trigger conversion
- approved data is materialized into an explicit approved DTO before work-order creation
- conversion writes both work-order and intake audit events

## 10. Timeline and event integration

New canonical domain event types:

- `intake_event_created`
- `intake_artifact_created`
- `ai_intake_draft_created`
- `ai_intake_reviewed`
- `ai_intake_approved`
- `ai_intake_rejected`
- `ai_intake_merged`
- `ai_intake_escalated`

Important architectural update:

- domain events now support entity-scoped intake events before a work order exists
- pre-approval intake events are anchored to the `intake_event` entity
- post-approval intake events can also carry `workOrderId` so approved intake appears on the canonical work-order timeline

This resolves the pre-existing conflict where durable events were previously hard-anchored only to `workOrderId`.

## 11. Future provider integration strategy

Future Outlook, SMS, voicemail, OCR, and attachment providers should:

- write canonical `intakeEvents` and `intakeArtifacts`
- link to canonical communication records when applicable
- emit the same intake domain event types

They should not:

- write directly into `workOrders`
- bypass intake review by creating authoritative operational state

## 12. Future AI orchestration strategy

Future AI workers may:

- generate drafts
- update candidate matches
- enrich evidence and confidence
- suggest review priority

They should not:

- approve their own output
- merge duplicates autonomously
- transition work-order lifecycle directly

## 13. Future SLA and escalation integration points

Future SLA and orchestration systems should subscribe to:

- `intake_event_created`
- `ai_intake_draft_created`
- `ai_intake_reviewed`
- `ai_intake_escalated`

Potential future extensions:

- review aging timers
- escalation routing
- intake queue prioritization
- provider retry orchestration

These should remain separate bounded contexts that consume durable events rather than directly coupling to intake-service internals.
