# Provider Runtime Safety Audit

Date: 2026-05-07

## Executive summary

The provider runtime is directionally aligned with the intended architecture:

- inbound provider ingestion writes canonical communication, intake, attachment, thread-mapping, and provider-receipt records rather than directly mutating work orders
- outbound provider delivery receipts reconcile through transport attempts and delivery plans rather than bypassing transport state
- replay, sync, checkpoint, and diagnostics concepts exist as durable persisted records
- worker runtime infrastructure already provides leases, retries, and dead-letter handling for receipt-processing jobs

However, the current implementation is not yet fully operationally safe under duplicate delivery, malformed payloads, replay storms, and hostile or misrouted webhook traffic.

The highest-risk issues are:

1. the Microsoft webhook endpoint is effectively unauthenticated and tenant-selectable by caller input
2. inbound ingestion is not atomic, so partial failures can leave orphaned canonical communication/intake records that later replays do not reconcile
3. several provider dedupe and reconciliation lookups are bounded to recent windows (`50`, `200`, `500`) instead of using stable indexed keys, which weakens replay safety and long-thread correctness
4. thread mappings can be silently reassigned to a different canonical thread without an explicit conflict workflow
5. diagnostics under-report or mis-measure some provider failure modes because they inspect only recent windows and compute duplicate counts from already-deduped stored data

## 1. Provider runtime architecture assessment

### What is solid

- Inbound provider ingestion is routed through `src/server/services/intake-service.ts`, which creates:
  - `intakeEvents`
  - `intakeArtifacts`
  - `communicationThreads`
  - `communicationMessages`
  - `communicationAttachments`
  - `providerMessageReceipts`
  - `providerThreadMappings`
- That inbound path does not directly create or mutate work orders. Work-order creation happens later through human review in the intake review flow, which preserves the intended canonical boundary.
- Outbound provider delivery receipts are handled separately in `src/modules/provider-runtime/server/provider-webhook-runtime.ts` and reconciled through `src/modules/provider-runtime/server/provider-reconciliation-service.ts`, which updates delivery attempts and delivery plans, not work-order lifecycle state.
- Runtime receipt processing is pushed through durable worker jobs (`provider.receipt.process`) from [`src/app/api/provider-runtime/webhooks/microsoft/route.ts`](/home/craig/projects/pinnacle-ops/src/app/api/provider-runtime/webhooks/microsoft/route.ts:41), so provider receipts are not reconciled inline with request handling.

### Architectural assessment

Assessment: mostly correct canonical separation, but the safety model is undermined by weak ingress trust boundaries and non-atomic multi-entity ingestion.

## 2. Ingestion boundary assessment

### Positive findings

- The inbound provider path correctly terminates at communication and intake artifacts rather than mutating operational entities directly.
- Malformed payloads with empty message bodies are rejected and still generate a provider receipt for auditability in `src/server/services/intake-service.ts:927`.
- Replay payload snapshots are persisted on provider message receipts in `src/server/services/intake-service.ts:1918`, which is the right direction for replayable ingress.

### Findings

#### Finding 1: Microsoft webhook ingress is not tenant-safe or provider-authenticated

Evidence:

- [`src/app/api/provider-runtime/webhooks/microsoft/route.ts`](/home/craig/projects/pinnacle-ops/src/app/api/provider-runtime/webhooks/microsoft/route.ts:18) accepts POSTs without any auth or signature verification.
- `organizationId` is taken from `x-organization-id`, request payload, or defaults to `"org-1"` at lines 21-24.
- The normalizer reads `clientState`, `subscriptionId`, and `tenantId`, but nothing validates them before persistence in `src/modules/provider-runtime/server/provider-receipt-normalizer.ts:67-107`.

Impact:

- A caller can inject provider webhook receipts into an arbitrary tenant.
- A missing tenant hint silently routes traffic to `org-1`.
- Spoofed or replayed external webhook traffic can create durable provider receipts and enqueue canonical runtime jobs.

Assessment: critical boundary violation.

#### Finding 2: inbound ingestion is not atomic and can leave orphaned canonical records

Evidence:

- `ingestProviderPayload` performs duplicate check first, then creates intake event, communication records, artifact, and only later writes the final successful provider receipt in `src/server/services/intake-service.ts:964-1055`.
- `createProviderCommunicationRecords` writes threads, messages, links, participants, attachments, and thread mappings incrementally in `src/server/services/intake-service.ts:1591-1826`.
- On exception, the catch block creates a failed provider receipt with `canonicalThreadId`, `canonicalMessageId`, and `intakeEventId` all null in `src/server/services/intake-service.ts:1058-1099` and `1875-1927`.

Conceptual failure simulation:

- If attachment creation, artifact persistence, or a later event write fails after the thread/message/link was already created, the system records only a failed receipt with no canonical linkage.
- A subsequent `retry_failed_receipt` replay creates a second intake event/message/thread path instead of repairing the partial first attempt.

Impact:

- duplicate canonical communications
- orphaned intake events
- thread mapping drift
- replay that amplifies corruption instead of repairing it

Assessment: major replay-safety and durability gap.

## 3. Replay/reconciliation assessment

### What is solid

- Replay uses persisted payload snapshots rather than UI projections through `requireReplayPayload` in `src/server/services/provider-service.ts:1279`.
- Successful outbound receipt reconciliation suppresses late/out-of-order regressions in `src/modules/provider-runtime/server/provider-reconciliation-service.ts`.
- Worker substrate and runtime loops are already built for bounded retries, leasing, and dead-letter handling.

### Findings

#### Finding 3: replay and reconciliation coverage is window-bounded rather than canonical-key based

Evidence:

- `replayThread` reads only the most recent 500 receipts before filtering in `src/server/services/provider-service.ts:792-809`.
- `reconcileThreadMapping` also scans only 500 receipts in `src/server/services/provider-service.ts:881-923`.
- `findReceipt(providerMessageId)` scans only 500 org receipts in `src/server/services/provider-service.ts:1140-1143`.
- `findByProviderMessage` scans only the latest 50 provider receipts in `src/server/repositories/firestore/repositories.ts:1683-1705`.

Impact:

- old messages in long-lived threads can fall out of replay/reconciliation visibility
- duplicate polling or delayed provider delivery can bypass prior receipts if the matching receipt is outside the recent window
- reply/reference linkage can degrade over time

Assessment: major correctness gap for long-running tenants and replay storms.

## 4. Idempotency assessment

### What is solid

- Outbound provider webhook receipts and runtime jobs use explicit idempotency keys:
  - webhook events: `provider.webhook:*`
  - provider receipts: `provider.receipt:*`
  - runtime jobs: `provider.receipt.process:*`
- Runtime job enqueue rejects same idempotency key with different payloads in `src/modules/runtime/server/worker-runtime-service.ts`.
- Tests already cover some duplicate webhook and out-of-order receipt behavior.

### Findings

#### Finding 4: check-then-create dedupe is not race-safe

Evidence:

- Inbound ingestion dedupes via `findExistingProviderReceipt` before creating canonical records in `src/server/services/intake-service.ts:881-925`.
- Webhook receipt handling checks `findByIdempotencyKey` and then creates records in `src/modules/provider-runtime/server/provider-webhook-runtime.ts:38-151`.
- No transaction, compare-and-set, or uniqueness-enforcing write is visible in either path.

Conceptual duplicate delivery simulation:

- two duplicate poll/webhook deliveries arrive concurrently
- both requests miss the existing receipt before either write commits
- both create receipts and canonical records

Impact:

- duplicate communication messages
- duplicate intake events
- inconsistent thread mapping counts
- duplicate provider webhook records

Assessment: major idempotency gap under concurrent delivery.

#### Finding 5: message fingerprint fallback is useful but not sufficient as a sole backstop

Evidence:

- Fingerprint is built from provider key, connection, message id or fallback key, thread id, and normalized text in `src/server/services/intake-service.ts:2308-2324`.

Risk:

- if provider IDs are missing or unstable and message text changes slightly during normalization/provider resend, the fallback fingerprint may not collapse true duplicates
- if two different messages share thread and normalized body, the fallback can over-collapse

Assessment: acceptable as a secondary signal, not strong enough as the only durable uniqueness contract.

## 5. Thread reconciliation assessment

### What is solid

- Inbound messages attempt to reuse existing provider thread mappings before creating new communication threads.
- Reply linkage uses prior provider receipts through `findReferenceReceipt`.
- Dedicated reconciliation endpoints and runtime events exist.

### Findings

#### Finding 6: thread mappings can be silently reassigned without conflict protection

Evidence:

- Existing mappings are overwritten with the new `canonicalThreadId` in `src/server/services/intake-service.ts:1996-2008`.
- There is no guard that prevents an existing provider thread from being rebound to a different canonical thread.

Impact:

- partial-ingestion retries or concurrent duplicates can move a provider thread to a different canonical thread
- reconciliation then reports conflict after corruption rather than blocking the corrupting write

Assessment: major reconciliation weakness.

#### Finding 7: reply/reference resolution degrades on older conversations

Evidence:

- `findReferenceReceipt` depends on `findByProviderMessage`, which scans only the latest 50 receipts for that provider/org in `src/server/services/intake-service.ts:1854-1872` and `src/server/repositories/firestore/repositories.ts:1683-1705`.

Impact:

- replies to older messages can fail to resolve `referenceMessageId`
- canonical message threading becomes progressively less accurate for long-lived mailboxes

Assessment: moderate-to-major correctness gap.

## 6. Attachment handling assessment

### What is solid

- Attachments are registered as canonical communication attachments first, with explicit hydration state.
- Hydration validates MIME allow-lists and maximum size before marking success in `src/server/services/provider-service.ts:1006-1046`.
- Attachment failures are persisted as `hydrationStatus: "failed"` with provider runtime events.

### Findings

#### Finding 8: hydrated state does not guarantee durable persisted content

Evidence:

- `hydrateAttachment` receives raw bytes from `attachmentSource.getAttachmentContent`, but the service itself does not write those bytes anywhere.
- It marks the attachment hydrated using `hydrated.storagePath ?? attachment.storagePath` in `src/server/services/provider-service.ts:1019-1033`.

Impact:

- an attachment can be marked `"hydrated"` with a hash and metadata even if no canonical blob was durably written by the hydration path
- content availability depends on out-of-band behavior of the hydration source contract

Assessment: moderate durability gap.

#### Finding 9: default attachment storage paths are not tenant-scoped

Evidence:

- default attachment paths are generated as ``${providerKey}/${providerThreadId ?? "message"}/${attachment.id}`` in `src/server/services/intake-service.ts:1711-1714`.

Impact:

- future blob writes that rely on this default risk cross-tenant namespace collisions or ambiguous operator recovery paths

Assessment: moderate tenant-isolation and recoverability gap.

## 7. Diagnostics/observability assessment

### What is solid

- The system persists:
  - provider connections
  - sync checkpoints
  - sync runs
  - provider message receipts
  - provider thread mappings
  - provider webhook events
- Runtime loops and operator endpoints exist for diagnostics and explicit reconciliation.
- Provider runtime emits domain events for connection, sync, replay, reconciliation, and hydration milestones.

### Findings

#### Finding 10: duplicate webhook metrics are effectively blind

Evidence:

- Duplicate webhooks are skipped and not re-created in `src/modules/provider-runtime/server/provider-webhook-runtime.ts:48-56`.
- Diagnostics compute duplicate count as `recentWebhookEvents.length - unique(idempotencyKey)` in `src/modules/provider-runtime/server/provider-receipt-diagnostics-service.ts:64-67` and `src/modules/provider-runtime/server/provider-health-service.ts:48-50`.

Impact:

- because duplicates are deduped before persistence, those metrics trend toward zero even when duplicate deliveries are occurring

Assessment: observability bug.

#### Finding 11: provider health and diagnostics are recent-window summaries, not durable totals

Evidence:

- Diagnostics inspect only recent windows:
  - receipts/webhooks default 50 in `provider-receipt-diagnostics-service.ts:39-48`
  - health uses 200 in `provider-health-service.ts:27-30`
  - connection health uses 20/200 in `provider-service.ts:1079-1089`

Impact:

- replay storms, sync corruption, and chronic failure trends can fall outside the visible window
- operator reads may falsely indicate health after enough new traffic arrives

Assessment: moderate blind spot.

## 8. Tenant/security assessment

### Positive findings

- Most repository/service reads check `organizationId` before returning or mutating records.
- Provider connections, checkpoints, runs, message receipts, and thread mappings all carry `organizationId` and `tenantId`.
- Internal diagnostics routes are gated through operational runtime authorization in `src/server/api/provider-runtime.ts`.

### Findings

#### Finding 12: external webhook ingress bypasses tenant trust boundaries

This is the same root issue as Finding 1, but it is important enough to restate in security terms.

Impact:

- cross-tenant provider visibility leakage through injected receipts
- cross-tenant runtime work creation
- spoofed delivery status changes against transport attempts if identifiers are guessed or correlated

Assessment: critical.

## 9. Runtime durability assessment

### What is solid

- Provider receipt processing jobs run on the canonical worker substrate with:
  - idempotent enqueue keys
  - lease/claim handling
  - bounded attempts
  - dead-letter routing
  - retry scheduling and jitter from the shared runtime
- Provider reconciliation loop and sweep job are cadence-bounded and tested for replay-safe scheduling.

### Findings

#### Finding 13: provider sync run claims are not true lease semantics

Evidence:

- Sync runs expose a `claim` object in the data model, but `claim()` simply overwrites `claimedBy` and `claimedAt` in `src/server/services/provider-service.ts:691-706`.
- No ownership checks, expiry checks, or reclaim conflict detection are enforced there.
- The claim object includes no active lease expiry in persisted sync runs, despite the input type carrying `leaseExpiresAt`.

Impact:

- if provider polling/sync workers are enabled on top of this as-is, duplicate processors can claim the same logical sync run
- operator recovery and reclaim semantics are not yet durable enough for mailbox execution work

Assessment: moderate substrate gap for future sync workers.

## 10. Remaining provider runtime risks

### Conceptual simulations

#### Duplicate webhook delivery

- Outbound delivery receipts are reasonably protected by idempotency keys, but only if deliveries are not concurrent enough to race the check-then-create window.
- Inbound message ingestion remains vulnerable to duplicate canonical message creation under concurrent duplicate delivery.

#### Duplicate polling

- If the same mailbox page is re-polled and two workers ingest overlapping messages concurrently, the current non-transactional dedupe path can create duplicate canonical artifacts.

#### Malformed payloads

- Empty-body payloads reject safely.
- Other malformed payloads can still fail after partial writes, leaving orphaned communication/intake entities.

#### Missing thread ids

- The system can still create canonical messages without stable provider thread IDs, but long-term thread reconciliation becomes weaker and fingerprint fallback becomes more important.

#### Provider outages

- Checkpoints and sync runs can record error state and failures.
- Diagnostics exist, but only as recent-window summaries.

#### Replay storms

- Runtime substrate is bounded and replay-safe at the job layer.
- Provider lookup windows and non-atomic ingestion make the data layer less replay-safe than the worker layer.

#### Hydration failures

- Failures are visible and persisted.
- Success does not prove durable blob persistence.

#### Sync corruption

- There is a durable checkpoint/run model, but sync claim semantics are not yet strong enough for confident concurrent mailbox execution.

## 11. Recommended corrective actions

### Priority 0

1. Lock down Microsoft webhook ingress.
   - Remove caller-selected `organizationId`.
   - Resolve tenant/connection from a trusted subscription mapping.
   - Validate provider webhook authenticity and expected `clientState`.
   - Reject requests that cannot be mapped to one canonical provider connection.

2. Make inbound provider ingestion atomic or compensating.
   - Either wrap canonical writes in one transaction where feasible, or introduce a staged intake-ingestion record that is finalized only after all canonical writes succeed.
   - On failure after partial writes, persist canonical artifact IDs on the failed receipt so replay can repair instead of duplicating.

3. Add durable uniqueness guarantees for inbound message receipts.
   - Enforce one canonical inbound provider message receipt per stable provider message identity.
   - Use transaction/compare-and-set semantics instead of read-then-create alone.

### Priority 1

4. Replace recent-window scans with indexed canonical-key lookups.
   - `providerMessageId`
   - `internetMessageId`
   - `providerThreadId`
   - replay-source receipt ID
   - any stable provider correlation keys

5. Add explicit thread-mapping conflict protection.
   - Do not silently overwrite `canonicalThreadId` on an existing mapping.
   - Persist a conflict state and require explicit operator reconciliation when a remap is attempted.

6. Harden attachment hydration semantics.
   - Require hydration to persist canonical blob storage before `hydrationStatus = "hydrated"`.
   - Include tenant/org prefixes in provider-derived storage paths.

### Priority 2

7. Fix provider diagnostics so duplicate and long-horizon failures are visible.
   - Track duplicate webhook attempts explicitly instead of deriving from stored unique rows.
   - Add cumulative counters or paginated drill-downs beyond recent windows.
   - Surface partial-ingestion and replay-supersession metrics.

8. Strengthen provider sync claim durability before enabling polling workers.
   - Add active lease expiry, ownership enforcement, safe reclaim, and conflict-aware release semantics to sync runs.

9. Add focused tests for the gaps above.
   - concurrent duplicate inbound ingestion
   - partial failure after thread/message creation but before receipt finalization
   - thread mapping remap attempt conflict
   - webhook without trusted tenant mapping
   - attachment hydration success without storage persistence
   - replay of receipts older than the current 50/500 query windows

## Final assessment

The provider runtime is on the right architectural path and already avoids the worst category of mistake, which would have been direct provider-driven work-order or lifecycle mutation. The remaining issues are mostly runtime-safety issues at the boundary and durability layers rather than domain-model mistakes.

That is good news, because the core shape does not need to be replaced. It does need a hardening pass before provider automation is treated as operationally trustworthy under real duplicate delivery, replay, or adversarial ingress conditions.
