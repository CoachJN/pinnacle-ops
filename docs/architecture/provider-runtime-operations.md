# Provider Runtime Operations

Date: 2026-05-06

## 1. Provider runtime overview

Phase 10 adds the operational runtime around canonical provider ingestion.

Canonical scope in this phase:

- provider connection management
- durable sync checkpoints
- sync run auditing
- replay and reconciliation tooling
- provider attachment hydration foundations
- worker-safe polling and webhook boundaries
- internal diagnostics and recovery APIs

Non-scope:

- lifecycle mutation
- assignment mutation
- approval mutation
- finance mutation
- SLA workers
- orchestration workers
- outbound delivery

Provider runtime continues to write only canonical provider, communication, intake, attachment, and event records.

## 2. Connection model

`providerConnections` is the canonical provider connection record.

Each connection persists:

- tenant and organization scope
- provider key
- provider tenant/account identity
- mailbox identity
- granted scopes
- scope metadata
- owner user id
- status
- health status
- expiry and disable timestamps
- last sync and last healthy timestamps
- last error snapshot

Canonical statuses:

- `active`
- `disabled`
- `error`
- `expired`
- `reconnect_required`

Health statuses are operational and separate from connection status:

- `healthy`
- `degraded`
- `unhealthy`
- `unknown`

## 3. Checkpoint model

`providerSyncCheckpoints` is the durable mailbox progress record.

Each checkpoint persists:

- connection id
- provider key
- mailbox and folder scope
- delta cursor / provider cursor
- last processed received timestamp
- last attempted sync
- last successful sync
- failure count
- last error snapshot
- next retry time

Checkpoints are upserted by connection plus mailbox scope and are safe to reuse during replay or future worker restarts.

## 4. Sync run model

`providerSyncRuns` is the durable sync attempt audit record.

Each sync run persists:

- connection id
- provider
- mailbox scope
- start and completion timestamps
- status
- messages seen
- messages ingested
- duplicates skipped
- failures
- checkpoint snapshot before
- checkpoint snapshot after
- error summary
- claim/release metadata for future workers

This gives polling and webhook workers a canonical run ledger before any background scheduler exists.

## 5. Replay and reconciliation model

Replay now runs through one canonical path:

1. locate provider receipt
2. read the stored normalized replay payload snapshot
3. re-enter canonical intake ingestion
4. let receipt-based idempotency reuse existing canonical records or create one new replay receipt when retrying failed ingestion

Supported recovery actions:

- replay by provider message id
- replay by provider receipt id
- replay an entire provider thread
- retry failed ingestion
- mark failed ingestion reviewed
- reconcile provider thread mappings
- reconcile provider receipts against canonical communication and intake records

Replay requests and completions emit provider runtime events for diagnostics and future recovery workflows.

## 6. Attachment hydration model

Communication attachments now persist provider hydration state directly.

Hydration fields:

- `hydrationStatus`
- `hydratedAt`
- `hydrationError`
- `contentHash`

Current statuses:

- `pending`
- `hydrated`
- `failed`
- `not_requested`

Phase 10 adds a provider attachment acquisition contract and a hydration update path without requiring live provider credentials in every environment. MIME and size validation happen before the attachment record is marked hydrated.

## 7. Webhook and polling boundary model

This phase adds worker-safe DTO and boundary shapes, not background execution.

Added runtime boundary shapes:

- `ProviderSyncRequest`
- `PollMailboxRequest`
- `ProviderWebhookEventEnvelope`
- `ProviderSyncRunClaim`
- `ProviderReplayJobRequest`

These boundaries keep provider ingress operationally replayable without coupling mailbox transport directly to work-order services.

## 8. Diagnostics model

Provider diagnostics reads are now served through one canonical service.

Supported diagnostics:

- connection health
- recent sync runs
- failed ingestions
- duplicate detections
- receipt lookup
- thread mapping lookup
- attachment hydration status

Diagnostics are organization-scoped and internal-admin only at the API boundary.

## 9. Runtime event model

Phase 10 adds the following provider runtime events:

- `provider_connection_created`
- `provider_connection_status_changed`
- `provider_sync_started`
- `provider_sync_completed`
- `provider_sync_failed`
- `provider_replay_requested`
- `provider_replay_completed`
- `provider_reconciliation_completed`
- `provider_attachment_hydration_started`
- `provider_attachment_hydration_completed`
- `provider_attachment_hydration_failed`

These events are operational diagnostics and future orchestration inputs. They are not authoritative workflow mutations.

## 10. Operational recovery strategy

Recovery is intentionally manual-first in this phase.

Operators can:

- inspect connection health
- inspect sync runs
- inspect failed receipts
- replay failed or suspicious ingestions
- reconcile thread mappings
- hydrate missing attachments
- mark failed ingestions reviewed

The canonical recovery source is the persisted replay payload snapshot on the provider receipt plus the canonical communication/intake records already created by prior successful runs.

## 11. Future worker strategy

Future polling and webhook workers should:

- claim sync work using the sync run claim model
- read checkpoints before mailbox fetch
- update checkpoints only after durable canonical ingestion outcomes
- emit runtime events for starts, completions, failures, and recoveries
- remain idempotent across retries and process restarts

Workers should never infer authoritative operational state from UI projections or unmanaged provider text.

## 12. Future SLA and orchestration integration points

SLA and orchestration systems should subscribe to canonical provider, communication, intake, and lifecycle events rather than coupling directly to mailbox runtimes.

Valid future integration points include:

- provider sync failure monitoring
- intake backlog monitoring
- attachment hydration backfills
- review queue prioritization
- operator escalation tooling

They must continue to project outcomes back through durable canonical events instead of mutating work orders through provider runtime paths.
