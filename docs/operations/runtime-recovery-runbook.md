# Runtime Recovery Runbook

Use this runbook during operational incidents. All recovery actions must remain explicit, auditable, and tenant-scoped.

## Safety rules

- Do not edit authoritative work-order, quote, invoice, assignment, or intake records directly in Firestore.
- Do not delete dead-letter records to “clear” the queue.
- Do not bypass lease semantics by overwriting runtime job documents manually.
- Do not replay webhooks or provider receipts blindly across tenants.
- Do not run recovery actions from an account that is not an internal `manager`, `finance_admin`, or `owner`.

## Operator surfaces

- Read-only summary:
  - `GET /api/operations/runtime/summary`
  - `GET /api/operations/runtime/health`
  - `GET /api/operations/runtime/alerts`
  - `GET /api/operations/runtime/dead-letter`
  - `GET /api/operations/runtime/replay`
  - `GET /api/runtime/operator/diagnostics`
- Mutation:
  - `POST /api/runtime/operator/events/process`
  - `POST /api/runtime/operator/jobs/process`
  - `POST /api/runtime/operator/dead-letter/replay`
  - `POST /api/operations/runtime/repair`
  - `POST /api/operations/runtime/repair/confirm`
  - `POST /api/providers/replay`
  - `POST /api/provider-runtime/operator/reconcile`

## 1. Replay durable outbox

### When to use

- A canonical domain event exists.
- A matching `durableOutbox` record remains `pending` or `failed`.
- Expected subscriber side effects such as `runtimeJobs` were not created.

### Procedure

1. Find the `sourceEventId` from `durableOutbox`.
2. Verify the domain event exists in `domainEvents`.
3. Replay the event through the canonical subscriber runtime:

```bash
curl -X POST "$APP_URL/api/runtime/operator/events/process" \
  -H "content-type: application/json" \
  --data '{"eventId":"<domain-event-id>","force":true}'
```

4. Re-check `runtimeJobs`, `runtimeEventProcessings`, and `durableOutbox`.

### Expected behavior

- Subscriber processing is re-driven from durable persisted state.
- Duplicate queue attempts converge on idempotent runtime jobs.

### Escalate when

- Replay repeatedly fails for the same event.
- Replay succeeds but the required downstream job is still missing.

### Do not do this

- Do not mark outbox records processed by hand.

## 2. Recover failed worker job

### When to use

- A runtime job has exhausted retries or a handler failure is visible.
- A corresponding dead-letter record exists.

### Procedure

1. Open `GET /api/operations/runtime/dead-letter`.
2. Identify the target `deadLetterId`.
3. Replay through the canonical dead-letter replay path:

```bash
curl -X POST "$APP_URL/api/runtime/operator/dead-letter/replay" \
  -H "content-type: application/json" \
  --data '{"deadLetterId":"<dead-letter-id>","force":true}'
```

4. Verify a new runtime job was created.
5. Re-run job processing if needed:

```bash
curl -X POST "$APP_URL/api/runtime/operator/jobs/process" \
  -H "content-type: application/json" \
  --data '{"maxJobs":1}'
```

### Expected behavior

- A new replay job is enqueued.
- Original dead-letter history remains intact.

### Escalate when

- The replayed job fails immediately with the same error.
- The original job type has no registered production handler.

### Do not do this

- Do not mutate the original dead-letter record or original job document in place.

## 3. Reclaim expired worker lease

### When to use

- A runtime job is `leased` or `running`.
- `leaseExpiresAt` is in the past.

### Procedure

1. Confirm the job is actually expired, not just slow.
2. Request canonical stuck-job repair:

```bash
curl -X POST "$APP_URL/api/operations/runtime/repair" \
  -H "content-type: application/json" \
  --data '{"actionType":"stuck_runtime_requeue","targetId":"<runtime-job-id>","reason":"expired lease confirmed"}'
```

3. If the response status is `pending_confirmation`, confirm it:

```bash
curl -X POST "$APP_URL/api/operations/runtime/repair/confirm" \
  -H "content-type: application/json" \
  --data '{"confirmationId":"<confirmation-id>","reason":"approved stuck-job recovery"}'
```

4. Verify a new replay job exists and the repair action is stored in `operationsRuntimeRepairActions`.

### Expected behavior

- The original stuck job is left intact for audit.
- A new safe replay job is created with repair metadata.

### Escalate when

- The lease appears active on another healthy worker.
- Multiple workers show the same ownership conflict.

### Do not do this

- Do not zero out `leaseOwner` or `leaseExpiresAt` manually.

## 4. Replay failed provider webhook

### When to use

- A provider receipt exists but downstream intake or reconciliation failed.
- Microsoft delivered a duplicate or suspicious webhook.

### Procedure

1. Find the receipt id in `providerMessageReceipts` or via `GET /api/providers/diagnostics`.
2. Replay by receipt id:

```bash
curl -X POST "$APP_URL/api/providers/replay" \
  -H "content-type: application/json" \
  --data '{"receiptId":"<receipt-id>","mode":"retry_failed"}'
```

3. If reconciliation is pending, re-run reconciliation:

```bash
curl -X POST "$APP_URL/api/provider-runtime/operator/reconcile" \
  -H "content-type: application/json" \
  --data '{"receiptId":"<receipt-id>"}'
```

### Expected behavior

- Replay uses the persisted normalized payload snapshot.
- Duplicate replay reuses canonical artifacts rather than creating a second work order.

### Escalate when

- Replay payload is missing.
- Duplicate replay creates divergent canonical artifacts.

### Do not do this

- Do not resend a forged webhook directly to the production route to “test” tenant routing.

## 5. Recover dead-letter runtime jobs

### When to use

- Dead letters appear in `GET /api/operations/runtime/dead-letter`.
- The runtime health endpoint is degraded or critical because of dead-letter volume.

### Procedure

1. Inspect the dead-letter summary and identify repeated job types.
2. Replay one item first, not the whole set.
3. Use `dead_letter_replay` through `POST /api/operations/runtime/repair` for auditable command-center history.
4. Process the newly queued job and validate convergence.

### Expected behavior

- Dead-letter replay is idempotent at the repair-action level.
- Each replay is traceable in `operationsRuntimeRepairActions`.

### Escalate when

- A whole class of job types dead-letters immediately after replay.

### Do not do this

- Do not bulk replay dead letters until one representative sample succeeds.

## 6. Re-drive failed intake conversion

### When to use

- Intake review approved a draft but the expected work order is missing.
- Intake conversion stopped after canonical artifacts were created.

### Procedure

1. Open the intake item in `/dashboard/intake`.
2. Confirm the latest `aiIntakeDraftId` and decision.
3. Check `domainEvents` for `intake_conversion_requested`.
4. Replay the corresponding durable event through `/api/runtime/operator/events/process`.
5. If the work order still does not appear, stop and escalate.

### Expected behavior

- Deterministic conversion reuses the stable requested work-order id for that draft.

### Escalate when

- An approved intake draft still cannot converge on a single work order.

### Do not do this

- Do not create a manual duplicate work order as a workaround without incident approval.

## 7. Inspect runtime ownership lineage

### When to use

- Operators need to understand why a job exists or who requested a repair.

### Procedure

1. Read `correlationId`, `causationId`, and `sourceEventId` on the runtime job, dead-letter record, or repair action.
2. Trace back to:
  - `domainEvents`
  - `durableOutbox`
  - `operationsRuntimeRepairActions`
  - `providerMessageReceipts` if provider-driven
3. Confirm all records belong to the same `organizationId`.

### Expected behavior

- Runtime lineage remains auditable and tenant-scoped.

## 8. Identify stale worker ownership

### When to use

- Jobs appear perpetually leased or running.
- No operator-triggered processing is completing.

### Procedure

1. Open `GET /api/runtime/operator/diagnostics`.
2. Compare job status, lease owner, and lease expiry.
3. Confirm whether the same worker id appears across multiple stale jobs.
4. If lease expiry has passed, use the stuck-job repair flow.

### Expected behavior

- Expired ownership is recoverable without rewriting authoritative state.

## 9. Recover interrupted transition or event persistence

### When to use

- Operators suspect a lifecycle change completed but downstream traces are incomplete.

### Procedure

1. Confirm the authoritative work-order state first.
2. Check for the expected `domainEvents` and `durableOutbox` record.
3. If both are missing, treat this as an authoritative mutation incident and escalate immediately.
4. If the event exists but subscriber outcomes are missing, use event replay.

### Expected behavior

- Atomic persistence means authoritative mutation and domain-event intent should succeed together.

### Escalate when

- Authoritative state changed without the corresponding domain event or outbox record.

### Do not do this

- Do not fabricate missing domain events manually in Firestore.

## 10. Validate replay convergence

### When to use

- Any replay, repair, or provider retry was performed.

### Procedure

1. Re-open the relevant summary or detail endpoint.
2. Confirm no second authoritative entity was created.
3. Confirm the repaired record now references the expected downstream artifact.
4. Confirm alerts or health status improve on the next projection refresh.
5. Record the incident id, action taken, and final outcome.

### Expected behavior

- Duplicate-safe reprocessing converges on one canonical outcome.

## Post-incident checklist

- [ ] Recovery action id recorded.
- [ ] Tenant and target ids recorded.
- [ ] Root cause summarized.
- [ ] Whether replay converged without manual data edits is documented.
- [ ] Follow-up engineering work is created for any repeated failure class.
