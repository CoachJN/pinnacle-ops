# Communications Bounded Context

Date: 2026-05-06

## 1. Architecture overview

Communications are now a first-class operational bounded context. They are not modeled as comments on work orders and they do not write directly into `workOrders`.

Canonical runtime responsibilities:

- persist top-level communication threads, messages, participants, links, attachments, and match suggestions
- emit durable domain events for communication creation and linking
- project portal-safe communication reads through one canonical query service
- converge new internal notes into the communications model

Communications attach to operational events and work orders. They do not replace lifecycle, assignment, quote, invoice, or transition event records.

## 2. Thread and message model

Top-level collections:

- `communicationThreads`
- `communicationMessages`
- `communicationParticipants`
- `communicationLinks`
- `communicationAttachments`
- `communicationMatchSuggestions`

Canonical thread responsibilities:

- work-order linkage
- channel identity
- participant grouping
- inherited visibility
- omnichannel-ready external ids
- deterministic last-message tracking

Canonical message responsibilities:

- immutable append-only message records
- channel, direction, and visibility
- normalized and plain-text bodies
- actor attribution
- participant linkage
- work-order, entity, and event linkage
- future provider ids and timestamps

## 3. Visibility and security model

Canonical communication visibility values:

- `internal`
- `client`
- `contractor`
- `finance`
- `system`

Read rules:

- internal actors can read `internal`, `client`, `contractor`, and `system`
- finance visibility is limited to finance/owner internal actors
- client actors can read only `client`
- contractor actors can read only `contractor`

This matches the canonical timeline visibility model and keeps portal reads tenant-safe and actor-safe.

## 4. Participant model

Participants are top-level records linked to threads. They can represent:

- internal users
- client-linked contacts
- contractor-linked organizations or contacts
- future system and AI actors

Participants carry actor/contact/organization linkage plus visibility scope so future omnichannel routing can resolve recipients without introducing alternate identity paths.

## 5. Channel and direction model

Channels implemented now:

- `internal_note`
- `portal_message`
- `system_message`

Reserved for future expansion:

- `email`
- `sms`
- `slack`
- `teams`
- `voicemail`
- `call`

Directions implemented now:

- `inbound`
- `outbound`
- `internal`
- `system`

## 6. Timeline integration

Communications enter the unified timeline through durable domain events:

- `communication_thread_created`
- `communication_message_created`
- `communication_message_linked`
- `communication_visibility_changed`

Timeline ordering remains deterministic through immutable event timestamps plus stable ids. Portal consumers do not reconstruct notes directly; they read canonical communication projections filtered by actor visibility.

## 7. Event integration

Communication writes now emit canonical domain events from the communication service. This keeps future automation, AI review, SLA timers, and provider syncs anchored to durable events instead of direct service coupling.

## 8. Linking architecture

Communication links are explicit top-level records. Supported entity targets now:

- `work_order`
- `quote`
- `invoice`
- `assignment`
- `event`
- `communication_thread`
- `communication_message`

All communications are explicitly linked to the canonical work order when work-order scoped. Additional cross-domain links are additive, not inferred-only.

## 9. Future provider integration strategy

Provider-specific delivery, sync, retries, and threading are intentionally not part of this phase. The bounded context is prepared with:

- `externalProvider`
- `externalThreadId`
- `externalMessageId`
- provider-safe participant and attachment records

Future provider integrations should write canonical communication records and emit the same domain events rather than inventing provider-owned timeline tables.

## 10. Future AI integration strategy

AI is not implemented in this phase, but the model now supports:

- normalized message content for analysis
- explicit match suggestions with confidence and review state
- future AI actor attribution
- message and thread linkage review queues

AI should propose links and summaries against canonical records, with approvals captured as durable events.

## 11. Future SLA and orchestration strategy

SLA and orchestration workers should subscribe to durable communication and lifecycle events, then persist their own timer/escalation records separately. They should project outcomes back into the canonical timeline through events instead of mutating communication state through hidden side effects.

## 12. Convergence summary

Current convergence in this phase:

- new internal notes are written through the canonical communication service
- work-order attachment creation mirrors canonical communication attachment records
- client and contractor portal detail pages now render communication history from canonical communication queries

Legacy note and attachment stores still exist for compatibility during the convergence window, but they are no longer the target architecture.
