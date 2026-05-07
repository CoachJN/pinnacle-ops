# Communications Readiness Audit

Date: 2026-05-06

## 1. Current communication-related architecture

The platform already has several communication-adjacent capabilities, but they are implemented as separate concerns rather than as a unified communications domain.

### Current persisted communication-adjacent records

- Work-order activity logs exist as top-level immutable Firestore records in `activityLogs` and are persisted through `src/server/services/activity-log-service.ts` and `src/server/repositories/firestore/*`.
- Internal notifications exist as top-level Firestore records in `internalNotifications` and are persisted through `src/server/services/notification-service.ts`.
- Work-order notes exist, but only in the Phase 3 path, as Firestore subcollections under `workOrders/{id}/notes` through `src/lib/repositories/work-order-note.repository.ts`.
- Work-order attachments exist, but only in the Phase 3 path, as Firestore subcollections under `workOrders/{id}/attachments` plus Firebase Storage objects under `work-orders/{workOrderId}/attachments/*`.

### Work-order timeline surfaces

- Internal activity timeline already exists through `GET /api/work-orders/[workOrderId]/activity` and is filtered by actor visibility in `src/lib/work-orders/quote-api-helpers.ts`.
- Notes and attachments are not part of that same canonical timeline entity. They are fetched independently through:
  - `GET/POST /api/work-orders/[workOrderId]/notes`
  - `GET/POST /api/work-orders/[workOrderId]/attachments`
- Contractor portal detail already exposes a filtered activity feed, which proves visibility-scoped timeline shaping is feasible.

### Contact and participant architecture

- Canonical contacts already exist in `contacts`.
- Client organizations, locations, and contractor organizations link to canonical contacts through normalized link tables:
  - `clientOrganizationContactLinks`
  - `locationContactLinks`
  - `contractorContactLinks`
- User profiles already distinguish internal, client, and contractor actors and support role-scoped visibility.

### API/service structure

- The app mostly follows a service/repository pattern with thin route handlers.
- There are two active work-order stacks:
  - A newer `src/server/repositories/firestore` + `src/server/services/*` stack with top-level activity logs and internal notifications.
  - A legacy/Phase 3 `src/lib/repositories/*` + `src/server/api/work-order-core.ts` stack for notes and attachments.
- This split is the main architectural warning sign for communications readiness.

### Audit and observability

- Security audit structures exist in `src/types/audit.ts` and `src/lib/audit-log.ts`.
- Operational logging exists through structured service/API loggers.
- Security audit persistence is not clearly durable by default; `src/lib/audit-log.ts` can fall back to process-local memory unless a sink is configured.

### Existing integrations/import/analytics

- There is no active email, SMS, voice, Slack, Teams, or chat provider integration in the repo.
- There is no existing communication import pipeline or webhook worker.
- Existing import-like and analytics-like capabilities are limited to:
  - QA seed ingestion in `scripts/seed-qa-data.mts`
  - workflow verification scenarios under `src/lib/workflows/verification/*`
  - QBO planning docs and invoice sync markers, but not implemented communication sync

## 2. Existing reusable pieces

These are the strongest foundations to reuse rather than replace:

- `ActivityLog` already provides:
  - append-only event storage
  - actor metadata
  - visibility scoping: `internal`, `client`, `contractor`, `all`
  - resource/entity linking
  - change metadata
- `InternalNotification` already provides:
  - recipient targeting
  - event typing
  - due/read/acknowledged/resolved lifecycle fields
  - operational alert feed patterns
- Canonical contacts plus contact-link entities already provide:
  - reusable people/org relationship modeling
  - preferred contact method and language
  - client/location/contractor participant association
- Work-order attachments already provide:
  - validated metadata persistence
  - signed-read URL generation
  - file type and size validation
  - storage path conventions
- Existing role-aware portal shaping already proves:
  - client-safe views
  - contractor-safe views
  - internal-only data separation
- Service/repository patterns are already mature enough for a new communications bounded context.

## 3. Missing canonical communication entity model

The platform does not yet have a canonical entity that represents a communication item independent of channel.

Current gap:

- `ActivityLog` is a workflow/audit event model, not a message model.
- `InternalNotification` is a recipient alert model, not a conversation or delivery model.
- `WorkOrderNote` is an internal note model, not a generalized communication record.
- `WorkOrderAttachment` is an attachment metadata model, not a first-class communication part.

What is missing is a canonical `CommunicationRecord` or equivalent that can represent:

- message/call/voicemail/SMS/portal/system/AI summary events
- inbound and outbound direction
- external provider metadata
- participants
- thread/conversation membership
- work-order link status
- delivery state
- privacy/visibility classification
- content/body plus normalized excerpts
- attachments as children or parts

Without this entity, adding email/SMS/phone/chat will fragment across multiple special-case tables and APIs.

## 4. Required data models

Recommended minimum canonical models before omnichannel rollout:

### CommunicationRecord

One row/document per timeline item.

Suggested fields:

- `id`
- `organizationId`
- `channel`: `email | sms | call | voicemail | portal_message | internal_note | slack | teams | ai_summary | status_change`
- `direction`: `inbound | outbound | internal | system`
- `kind`: `message | event | summary | alert | note`
- `status`: `received | queued | sent | delivered | failed | read | summarized | linked | unlinked`
- `visibility`: `internal | client | contractor | all | restricted`
- `subject`
- `bodyText`
- `bodyHtml`
- `excerpt`
- `occurredAt`
- `provider`
- `providerMessageId`
- `providerThreadId`
- `providerConversationId`
- `inReplyToProviderMessageId`
- `sourceSystem`
- `correlationKey`
- `createdByUserId` or system actor
- `aiGenerated`
- `containsPii`
- `containsSensitiveContent`
- `retentionClass`

### CommunicationParticipant

Normalized participants so one message can involve internal users, client contacts, contractor contacts, and raw external endpoints.

Suggested fields:

- `communicationId`
- `role`: `from | to | cc | bcc | participant | owner`
- `partyType`: `user | contact | client_organization | contractor_organization | raw_endpoint`
- `partyId`
- `displayName`
- `email`
- `phone`
- `externalIdentity`

### CommunicationLink

Many-to-many linking between communications and business entities.

Suggested fields:

- `communicationId`
- `entityType`: `work_order | assignment | quote | invoice | client_organization | contractor_organization | location`
- `entityId`
- `linkType`: `primary | related | suggested | derived`
- `linkConfidence`
- `linkReason`
- `linkedBy`
- `linkedAt`

### CommunicationThread

Optional but strongly recommended before email/chat.

Suggested fields:

- `id`
- `organizationId`
- `channel`
- `subject`
- `canonicalParticipantKey`
- `providerThreadId`
- `lastMessageAt`
- `primaryWorkOrderId`

### CommunicationAttachment

Do not overload current work-order attachment metadata for omnichannel.

Suggested fields:

- `communicationId`
- `fileName`
- `contentType`
- `sizeBytes`
- `storagePath`
- `providerAttachmentId`
- `sha256`
- `scanStatus`

### CommunicationMatchSuggestion

Needed for automated WO linking and human review.

Suggested fields:

- `communicationId`
- `candidateEntityType`
- `candidateEntityId`
- `score`
- `signals`
- `status`: `pending | accepted | rejected | expired`
- `reviewedBy`
- `reviewedAt`

### CommunicationConsentPreference

Current contacts only store preferred contact method, not compliance-grade consent.

Suggested fields:

- `contactId` or external endpoint key
- `channel`
- `consentStatus`
- `consentSource`
- `consentCapturedAt`
- `revokedAt`
- `doNotContact`
- `quietHours`

## 5. Required API/services

Recommended new bounded context: `src/modules/communications` with thin routes and explicit services.

### Core services

- `communication-service`
  - create inbound/outbound records
  - persist participants
  - persist provider metadata
  - update delivery states
- `communication-thread-service`
  - resolve/create threads
  - append timeline items
  - load unified work-order timeline views
- `communication-linking-service`
  - link/unlink to work orders and related entities
  - manage confidence and manual overrides
- `communication-attachment-service`
  - register and serve attachments
  - enforce scanning and signed access
- `communication-consent-service`
  - channel preference and opt-out enforcement
- `ai-summary-service`
  - create summaries over selected communications
  - persist summaries as timeline items with provenance

### APIs

- `POST /api/communications/inbound/email`
- `POST /api/communications/inbound/sms`
- `POST /api/communications/inbound/call-events`
- `POST /api/communications/inbound/slack`
- `POST /api/communications/inbound/teams`
- `POST /api/communications`
  - internal note, portal message, manual log, outbound draft
- `GET /api/communications/[communicationId]`
- `POST /api/communications/[communicationId]/link`
- `POST /api/communications/[communicationId]/unlink`
- `POST /api/communications/[communicationId]/attachments`
- `GET /api/work-orders/[workOrderId]/communications`
  - canonical unified communication timeline
- `POST /api/work-orders/[workOrderId]/communications`
  - add internal note, portal message, outbound email/SMS draft, manual call log
- `POST /api/communication-threads/[threadId]/summaries`

### Important design rule

Do not attach omnichannel logic directly to the current Phase 3 note/attachment endpoints. Build a canonical communications surface, then optionally project existing notes/status changes into that timeline.

## 6. Required background workers

The current repo has workflow execution primitives, but no communication worker runtime. You will need workers for:

- inbound webhook normalization
  - provider payload -> canonical communication record
- outbound dispatch
  - queued email/SMS/Slack/Teams sends
- delivery/status sync
  - sent/delivered/read/failed updates
- attachment processing
  - download, dedupe, malware scan, storage registration
- communication matching
  - auto-link to work orders and related entities
- AI summarization
  - summarize thread/work-order communication windows
- retry/dead-letter handling
  - provider failure recovery
- retention/redaction jobs
  - privacy and legal hold support

Recommended pattern:

- Add a dedicated communications job table/collection instead of overloading current workflow action queues.
- Use system actors for worker-generated timeline entries.
- Ensure idempotency keys exist for all webhook and delivery callbacks.

## 7. WO matching/linking strategy recommendations

Use a layered strategy, not a single heuristic.

### Strong-match signals

- explicit work-order number in subject/body, for example `WO-12345678`
- reply-to existing provider thread already linked to a work order
- portal message created from a work-order context
- communication initiated from an existing work-order UI action

### Medium-match signals

- sender email/phone matches a linked client/location/contractor contact
- recipient mailbox/number maps to a client or contractor channel
- subject/location/store number matches a known location
- recent conversation thread already linked to same client/location

### Weak-match signals

- fuzzy text similarity on title/location/address
- attachment filename patterns
- historical requester/contact behavior

### Recommended operating model

1. Auto-link only when confidence is very high and explainable.
2. Create `suggested` links for medium-confidence matches.
3. Queue ambiguous cases for internal review.
4. Preserve manual override history permanently.
5. Keep thread-level and message-level linking separate.

Also recommended:

- store the exact matching signals used
- make work-order number parsing a first-class parser
- maintain a normalized endpoint index for emails and phone numbers
- treat cross-client ambiguous contacts as unsafe for auto-linking

## 8. Security/privacy risks

The communications expansion will materially increase risk surface. Key concerns:

- The current attachment flow allows any signed-in user to upload valid files to the work-order attachment path; server-side metadata validation exists, but storage writes are not scoped by work-order authorization.
- Current activity visibility is good, but a unified communications timeline will require stricter classification than `internal/client/contractor/all` alone.
- Contacts do not yet model consent, opt-out, lawful basis, or channel-specific restrictions.
- Security audit persistence is not clearly durable enough yet for enterprise communication compliance.
- Omnichannel payloads will bring PII, contractual data, billing data, and possibly regulated content into the platform.
- AI summaries can leak restricted content across role boundaries unless source visibility is enforced at summary-build time.
- Slack/Teams channels can contain mixed-tenant or mixed-work-order content; naive ingestion could overexpose internal discussion.
- Email threading can accidentally merge unrelated jobs if contact-only matching is used.
- Voice and voicemail transcripts may create high-sensitivity text data that needs retention and redaction controls.

Minimum controls before rollout:

- durable audit sink for communication access and link/unlink actions
- channel-specific authorization rules
- malware scanning and attachment hashing
- consent and opt-out enforcement
- encrypted provider secrets and webhook verification
- redaction strategy for sensitive fields
- summary provenance and source-item access checks
- retention policy by channel and content type

## 9. Recommended implementation phases

### Phase 1: Canonical foundation

- Create `communications` bounded context.
- Define canonical communication, participant, link, thread, and attachment entities.
- Choose one active persistence strategy and avoid adding more logic to both the legacy and newer stacks.
- Add durable audit/event persistence for communication actions.

Exit criteria:

- one canonical communication repository/service path
- one work-order timeline query surface for communication items

### Phase 2: Internal-first timeline unification

- Project existing internal notes, attachments, activity logs, and status changes into a unified work-order communication timeline view.
- Keep legacy note/attachment write paths temporarily, but read through the new timeline aggregator.
- Add manual call log and internal message entry support.

Exit criteria:

- a single timeline UI/API for internal users
- no separate “notes vs activity vs attachments” mental model for operators

### Phase 3: Linking and matching

- Implement communication link model and confidence-scored matching.
- Add review queue for ambiguous communications.
- Add participant and endpoint normalization.

Exit criteria:

- inbound items can be linked, suggested, or queued safely

### Phase 4: Provider integrations

- Add inbound/outbound email and SMS first.
- Defer voice, Slack, and Teams until the canonical model is proven.
- Add delivery status sync, idempotency, and retry workers.

Exit criteria:

- provider messages round-trip into canonical timeline without special-case storage

### Phase 5: Portals and external collaboration

- Add client portal messaging and contractor messaging on top of the same communication model.
- Ensure portal messages are just another channel with strict visibility.

Exit criteria:

- portal messages live in the same communication timeline as email/SMS/internal notes

### Phase 6: AI summaries and intelligence

- Add thread and work-order AI summarization with provenance.
- Add human review for automation suggestions before action-taking features.

Exit criteria:

- summaries are visibility-safe, reproducible, and audit-linked

## Bottom line

The platform is not yet ready to add all communications directly, but it is ready to support a communications foundation project.

Best reusable foundation:

- activity logs
- internal notifications
- canonical contacts and contact links
- attachment storage/signing
- role-aware portal visibility
- service/repository boundaries

Main blockers:

- no canonical communication entity
- split work-order architecture between old and new stacks
- no communication worker runtime
- no consent/compliance model
- no durable omnichannel linking/threading model

Recommendation:

Build a canonical communications bounded context first, unify read models second, then add providers channel by channel.
