# Microsoft Provider Ingestion

Date: 2026-05-06

## 1. Provider adapter overview

Phase 9 introduces the first production-grade external provider boundary through Microsoft 365 / Outlook via Microsoft Graph.

Canonical rule:

- Microsoft Graph is an ingestion source only in this phase.
- The adapter may create canonical communication records, communication attachments, intake events, intake artifacts, provider receipts, and provider thread mappings.
- The adapter may not mutate work-order lifecycle, assignments, approvals, finance state, or any other authoritative operational state.

Primary runtime components:

- `src/modules/providers/microsoft/graph-adapter.ts`
- `src/server/services/intake-service.ts`
- Firestore provider collections for connections, checkpoints, receipts, and thread mappings

## 2. Graph normalization architecture

The Microsoft adapter normalizes Graph message payloads into provider-agnostic email models before intake processing.

Normalized outputs:

- `NormalizedEmailMessage`
- `NormalizedEmailThread`
- `ProviderAttachmentReference`

The adapter preserves Graph-native message identity while converting message body content, sender/recipient metadata, references, conversation identity, and attachment metadata into canonical normalized records.

## 3. Email normalization model

Canonical normalized email data now preserves:

- subject
- body
- plain text body
- normalized text
- sender
- recipients
- cc
- bcc
- provider message id
- internet message id
- conversation id
- in-reply-to
- references
- received and sent timestamps
- attachment references

This model is provider-agnostic enough for future Gmail ingestion and future non-Outlook email channels while still preserving Outlook-specific conversation metadata in thread metadata.

## 4. Thread reconciliation architecture

Provider threads do not own runtime state.

Canonical reconciliation flow:

1. Normalize Microsoft conversation identity.
2. Resolve existing `providerThreadMappings` by provider key, connection id, and provider thread id.
3. Reuse the mapped canonical communication thread when present.
4. Create a new canonical communication thread when no mapping exists.
5. Upsert the provider thread mapping with the latest provider and canonical message linkage.

Reply linkage uses normalized `inReplyTo` and preserved internet message ids to resolve `referenceMessageId` against prior provider receipts when available.

## 5. Attachment ingestion architecture

Attachments are registered as canonical communication attachments plus immutable intake attachment references.

Current phase behavior:

- preserve provider attachment ids
- preserve file name, MIME type, size, content id, inline state, and storage path
- deduplicate attachments within a provider message
- link attachments to both communication and intake artifacts

OCR and extraction are intentionally deferred. The attachment model is shaped for future OCR, transcript, and AI extraction artifacts without requiring another provider-specific attachment path.

## 6. Idempotency architecture

Email ingestion is idempotent through `providerMessageReceipts`.

Idempotency inputs:

- provider message id
- internet message id
- provider connection id
- provider thread id
- normalized content fingerprint

Canonical behavior:

- first successful ingest writes one immutable `providerMessageReceipt`
- duplicate ingests resolve the existing receipt and return the already-created canonical communication and intake records
- duplicate detection emits `provider_duplicate_detected`
- malformed provider payloads are rejected with `provider_ingestion_rejected`
- runtime failures write failed receipts and emit `provider_ingestion_failed`

## 7. Provider visibility and security model

Provider ingestion inherits canonical communication and intake visibility rules.

Safety rules:

- default visibility remains `internal`
- visibility is applied consistently across communication messages, attachments, intake events, intake artifacts, and receipts
- all provider records are tenant-scoped by `organizationId` and `tenantId`
- provider data does not bypass portal-safe communication filtering
- finance visibility remains restricted to finance/owner internal actors

## 8. Communication and intake integration

Every accepted Microsoft email becomes:

- one canonical communication message
- one canonical intake event
- one immutable intake artifact
- zero or more canonical communication attachments
- one immutable provider message receipt

The email never creates a work order directly. Work-order creation continues to require the canonical human-reviewed intake conversion boundary.

## 9. Future outbound sync strategy

Outbound email delivery is intentionally not implemented in this phase.

Future outbound sync should:

- originate from canonical communication events
- persist provider delivery attempts separately from canonical communication records
- reuse provider connections and thread mappings
- never mutate authoritative operational state as a delivery side effect

## 10. Future multi-provider strategy

The provider model is intentionally provider-agnostic.

Future providers should reuse:

- `providerConnections`
- `providerSyncCheckpoints`
- `providerMessageReceipts`
- `providerThreadMappings`
- normalized email models

New providers should add adapters, not alternate communication or intake runtime paths.

## 11. Future OCR and AI extraction integration

Attachments and intake artifacts now preserve enough provenance for future OCR and AI extraction systems to operate only on canonical persisted artifacts.

Future AI/OCR systems should:

- read canonical intake artifacts and communication attachments
- persist non-authoritative extraction artifacts
- remain outside authoritative lifecycle and work-order mutation paths

## 12. Future SLA and orchestration integration points

Future workers should subscribe to:

- `provider_message_ingested`
- `provider_thread_linked`
- `provider_attachment_registered`
- intake review events
- communication creation events

Workers should persist their own durable state and project outcomes back through canonical events rather than mutating provider-owned runtime state directly.
