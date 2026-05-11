# Manual Smoke Tests

This runbook is written for internal operators, not just engineers.

Use one launch candidate organization and one consistent naming prefix for all manual tests, for example `SMOKE-2026-05-07`.

## Test prerequisites

- [ ] You are signed in as an internal `manager` or `owner`.
- [ ] You have one client portal user and one contractor portal user available.
- [ ] You can open Firebase console for the target organization.
- [ ] You can call authenticated internal APIs from a browser session or approved REST client.
- [ ] `docs/operations/production-setup-checklist.md` is complete or only approved pre-launch exceptions remain.

## Verification tools

- UI:
  - internal app: `/dashboard/work-orders`, `/dashboard/intake`, `/finance`
  - client portal: `/portal/work-orders`
  - contractor portal: `/contractor/work-orders`
- Browser GET checks:
  - `/api/operations/runtime/summary`
  - `/api/operations/runtime/health`
  - `/api/operations/runtime/dead-letter`
  - `/api/operations/runtime/replay`
  - `/api/runtime/operator/diagnostics`
- Authenticated POST checks:
  - `/api/runtime/operator/events/process`
  - `/api/runtime/operator/jobs/process`
  - `/api/operations/runtime/repair`
  - `/api/operations/runtime/repair/confirm`
  - `/api/providers/replay`
  - `/api/provider-runtime/operator/reconcile`
- Firestore collections:
  - `workOrders`
  - `domainEvents`
  - `durableOutbox`
  - `runtimeJobs`
  - `runtimeDeadLetters`
  - `providerConnections`
  - `providerMessageReceipts`
  - `providerSyncRuns`

## A. Manual work order flow

### Steps

- [ ] Open `/dashboard/work-orders/new`.
- [ ] Create a new work order with:
  - title prefixed with the smoke-test prefix
  - one real client organization
  - one real location
  - a requested service date later today or tomorrow
  - `requiresQuote=true`
  - optional quote threshold entered as dollars and cents, for example `250.00`
- [ ] Open the created work order detail page.
- [ ] Confirm the work order number and title match what was entered.
- [ ] Confirm the sticky operational header remains visible while scrolling the detail page.
- [ ] Confirm the tab rail shows `Overview`, `Workflow`, `Quotes & Finance`, `Communications`, `Files (#)`, and `History / Audit`.
- [ ] Confirm the `Files` tab label count matches the current number of stored attachments for the work order, for example `Files (0)` before upload and `Files (1)` after one upload.
- [ ] Confirm the `Overview` tab opens with `Next Action`, `Operational Summary`, `Operational Timing`, `Ownership Snapshot`, `Recent Activity Snapshot`, and `Client, Location & Requester` sections.
- [ ] Confirm the sticky header shows the work-order status, priority, and a compact `Next:` label. If the work order is overdue or escalated, confirm the header also shows that risk indicator.
- [ ] Confirm the `Overview` tab does not duplicate the full sidebar metadata blocks and instead shows compact interpreted summaries.
- [ ] Open the `Workflow` tab and confirm it shows `Workflow Stage Tracker`, `Available Actions`, `Assignment & Dispatch`, `Scheduling Snapshot`, and `Operational Notes`.
- [ ] Confirm `Change Status`, `Assign`, and `Add Note` jump into the correct `Workflow` sections instead of landing on the old stacked layout.
- [ ] Confirm the right sidebar remains visible on desktop, uses dense grouped metadata rows instead of stacked cards, and stacks below the workspace on mobile-width viewport.
- [ ] Confirm low-priority identifiers move into collapsed advanced metadata instead of dominating the default sidebar view.
- [ ] Confirm `Change Status`, `Assign`, `Add Note`, and `Create Quote` route operators into the expected workspace tabs without breaking the existing forms.
- [ ] Open the `Files` tab and confirm it only contains attachments and file upload behavior.
- [ ] Confirm the `Files` tab shows a compact summary panel, a compact upload panel when permitted, grouped attachment sections, and a file-visibility hint.
- [ ] If attachments exist, confirm image files appear under `Photos / Images`, PDFs or office files appear under `Documents`, and uncategorized items fall under `Other Files`.
- [ ] If no attachments exist, confirm the empty state says `No files have been attached to this work order yet.` and offers examples such as photos, contractor documents, client files, completion proof, and manually uploaded invoices or quotes.
- [ ] Open the `History / Audit` tab and confirm it contains lifecycle or workflow history, assignment history, invoice history, and system timeline or audit events.
- [ ] In Firebase console, find the new `workOrders` record.
- [ ] In `domainEvents`, verify a `work_order_created` event exists for that `workOrderId`.
- [ ] In `durableOutbox`, verify one `domain_event_dispatch` record exists whose `sourceEventId` matches the created domain event.
- [ ] In `runtimeJobs`, verify a job of type `sla.timer.evaluate` exists for the work order, or replay the event if the outbox is still pending.
- [ ] Assign internal staff from the work-order detail page.
- [ ] Assign a contractor from the assignment panel.
- [ ] Sign in as the contractor user and open `/contractor/work-orders`.
- [ ] Confirm the new work order is visible in the contractor portal.

### Expected result

- [ ] Work order is created successfully.
- [ ] One canonical domain event and one durable outbox dispatch record exist.
- [ ] Runtime queue contains the expected follow-on job or deterministically converges after replay.
- [ ] Internal assignees and contractor assignment appear on the work order.
- [ ] Contractor portal shows the assigned work order.

### Failure condition

- [ ] No `work_order_created` domain event exists.
- [ ] No durable outbox record exists for the event.
- [ ] No runtime job appears and replay does not create one.
- [ ] Contractor cannot see the assigned work order.

### Verification target

- UI work-order detail and contractor portal.
- Firestore `workOrders`, `domainEvents`, `durableOutbox`, `runtimeJobs`.
- `GET /api/runtime/operator/diagnostics`.

### Recovery step

- [ ] Use the runtime recovery runbook sections for event replay or stuck-job repair.

## B. Quote workflow

### Steps

- [ ] As the contractor user, open the assigned work order in `/contractor/work-orders/<workOrderId>`.
- [ ] Submit a contractor quote with at least one line item and a non-zero total.
- [ ] Return to the internal work order detail and open the quote workflow panel.
- [ ] Confirm the work-order lifecycle moved to `contractor_quote_received`.
- [ ] Review and accept the contractor quote as an internal manager or owner.
- [ ] Confirm the lifecycle moves to `quote_under_review`.
- [ ] Create or send a client quote from the accepted contractor quote.
- [ ] Confirm the lifecycle moves to `client_approval_requested`.
- [ ] Sign in as the client user and open `/portal/quotes/<quoteId>`.
- [ ] Approve the client quote.
- [ ] Confirm the lifecycle moves to `client_approved`.
- [ ] Repeat the client quote test with a fresh quote and reject it.
- [ ] Confirm the lifecycle returns to `quote_required`.

### Expected result

- [ ] Contractor quote submission creates a visible quote record and moves the work order to `contractor_quote_received`.
- [ ] Internal review acceptance moves the work order to `quote_under_review`.
- [ ] Sending the client quote moves the work order to `client_approval_requested`.
- [ ] Client approval moves the work order to `client_approved`.
- [ ] Client rejection returns the work order to `quote_required`.

### Failure condition

- [ ] Quote action succeeds but the work-order lifecycle does not change.
- [ ] Client portal quote is missing or not readable by the client user.
- [ ] Rejection leaves the work order in `client_approval_requested`.

### Verification target

- Internal quote panel.
- Client quote page.
- `domainEvents` entries such as `contractor_quote_received`, `client_approval_requested`, and `client_approved`.

### Recovery step

- [ ] Use event replay if lifecycle events persisted but runtime processing did not converge.
- [ ] If quote state and work-order state diverge, stop further smoke testing and escalate to engineering.

## C. Invoice workflow

### Steps

- [ ] Move or use a work order already in `ready_for_invoicing`.
- [ ] Open `/finance` and confirm the work order is eligible for invoice work.
- [ ] Create a draft invoice for the work order.
- [ ] Send the invoice.
- [ ] Confirm the work-order lifecycle moves to `invoiced`.
- [ ] Mark the invoice paid.
- [ ] Confirm the work-order lifecycle moves to `paid`.
- [ ] Repeat on a separate work order or invoice draft and void the invoice before payment.
- [ ] Confirm the invoice status becomes `void`.
- [ ] Confirm a voided invoice returns the work order from `invoiced` to `ready_for_invoicing`.

### Expected result

- [ ] Draft invoice is created once.
- [ ] Sent invoice moves the work order to `invoiced`.
- [ ] Paid invoice moves the work order to `paid`.
- [ ] Void reopens invoice readiness when the invoice was the active non-void invoice.

### Failure condition

- [ ] Invoice exists but work-order lifecycle does not move.
- [ ] Paid invoice can still be voided.
- [ ] Void does not restore `ready_for_invoicing` when expected.

### Verification target

- Finance page.
- Work-order detail finance panel.
- `domainEvents` such as `invoice_sent` and `payment_recorded`.

### Recovery step

- [ ] Use runtime repair only for runtime artifacts.
- [ ] Do not manually edit invoice or work-order documents in Firestore.
- [ ] If authoritative invoice state is wrong, escalate to engineering.

## D. Communication workflow

### Steps

- [ ] As an internal operator, open the target work order.
- [ ] Open the `Communications` tab and confirm it shows `Communication Summary`, `Add Communication / Note`, `Communication Timeline`, `Client Communications`, `Contractor Communications`, `Internal Notes`, and `Follow-up Snapshot` in a dense list-first layout rather than large placeholder cards.
- [ ] Add one internal note through the communications workspace.
- [ ] Verify the note appears in both the communications workspace and the workflow operational notes area.
- [ ] Confirm the summary updates `Last internal note` and the unified timeline shows the note as `Internal`.
- [ ] Send one client-visible message with an authenticated POST to `/api/work-orders/<workOrderId>/communications` using:

```json
{
  "audience": "client",
  "subject": "Smoke test client update",
  "body": "Client-visible smoke test message."
}
```

- [ ] Send one contractor-visible message with:

```json
{
  "audience": "contractor",
  "subject": "Smoke test contractor update",
  "body": "Contractor-visible smoke test message."
}
```

- [ ] Sign in as the client user and confirm the client message appears on `/portal/work-orders/<workOrderId>`.
- [ ] Return to the internal communications workspace and confirm the message appears under `Client Communications` and in the unified timeline.
- [ ] Sign in as the contractor user and confirm the contractor message appears on `/contractor/work-orders/<workOrderId>`.
- [ ] Return to the internal communications workspace and confirm the message appears under `Contractor Communications` and in the unified timeline.
- [ ] Upload one attachment through the internal work-order attachment flow.
- [ ] Confirm the `Files` tab label increments to reflect the new attachment count.
- [ ] Confirm the attachment appears only in the `Files` tab as stored work-order file documentation and does not inflate communication counts or communication-only timelines.
- [ ] Confirm the `Files` tab summary counts update accurately after upload and the most recent upload timestamp changes to the new file.
- [ ] Confirm each file row or card shows its name, type, uploaded date, uploader when known, and an `Open / download` action.
- [ ] Confirm lifecycle, assignment, invoice, and audit-style history records appear only in the `History / Audit` tab and not in `Files`.
- [ ] Confirm the client and contractor portals do not expose that internal-only attachment.
- [ ] If no client-visible message exists, confirm the summary honestly shows `Client has not been updated` instead of fabricating a record.
- [ ] If a contractor is assigned and no contractor-visible message exists, confirm the follow-up snapshot can show `Contractor follow-up may be needed`.

### Expected result

- [ ] Communications tab is now the canonical deeper communication workspace for the work order.
- [ ] Internal note persists as an internal communication.
- [ ] Client-visible message is visible only to internal users and client users.
- [ ] Contractor-visible message is visible only to internal users and contractor users.
- [ ] Internal attachment remains internal-only.
- [ ] Empty states stay honest and do not invent client or contractor history that is not present.

### Failure condition

- [ ] Client cannot see the client-visible message.
- [ ] Contractor cannot see the contractor-visible message.
- [ ] Client or contractor can see the internal attachment.

### Verification target

- Internal work order detail communications tab.
- Client portal work order detail.
- Contractor portal work order detail.
- `GET /api/work-orders/<workOrderId>/communications`.

### Recovery step

- [ ] If visibility is wrong, stop portal testing immediately and escalate.
- [ ] Do not change visibility by editing Firestore documents directly.

## E. Provider intake flow

### Steps

- [ ] Verify the production or staging provider connection exists in `providerConnections` and is `active`.
- [ ] Deliver one controlled inbound Microsoft webhook or replay one existing provider receipt.
- [ ] Confirm a `providerMessageReceipt` record is written.
- [ ] Open `/dashboard/intake`.
- [ ] Confirm the new intake item appears in the review queue.
- [ ] Start review.
- [ ] Approve with edits or create a new work order from the intake page.
- [ ] Confirm a work order is created and linked.
- [ ] Replay the same provider receipt using `POST /api/providers/replay`.
- [ ] Confirm duplicate replay does not create a second work order.

### Expected result

- [ ] One canonical provider receipt is created.
- [ ] One intake review item is created.
- [ ] One approved intake conversion creates one authoritative work order.
- [ ] Duplicate replay converges on the existing canonical records.

### Failure condition

- [ ] Duplicate replay creates a second work order.
- [ ] Intake review cannot be opened for the new receipt.
- [ ] Approved intake cannot create a work order.

### Verification target

- Intake dashboard.
- `providerMessageReceipts`.
- `domainEvents` for intake review and conversion.
- resulting `workOrders` record.

### Recovery step

- [ ] Use provider replay or provider reconciliation procedures from the runtime recovery runbook.

## F. Runtime recovery flow

### Steps

- [ ] Open `GET /api/operations/runtime/health`.
- [ ] Open `GET /api/operations/runtime/dead-letter`.
- [ ] Open `GET /api/runtime/operator/diagnostics`.
- [ ] Replay one durable event with `POST /api/runtime/operator/events/process`.
- [ ] Process one or more queued jobs with `POST /api/runtime/operator/jobs/process`.
- [ ] If a dead letter exists, replay it with `POST /api/runtime/operator/dead-letter/replay` or the command-center repair API.
- [ ] If a leased or running job has an expired lease, repair it with `POST /api/operations/runtime/repair` using `actionType=stuck_runtime_requeue`.
- [ ] Replay one failed provider receipt with `POST /api/providers/replay`.

### Expected result

- [ ] Runtime status endpoints respond successfully.
- [ ] Replay actions are auditable.
- [ ] Dead-letter replay creates a new runtime job, not an in-place mutation.
- [ ] Stuck-job repair produces a new safe replay job when appropriate.

### Failure condition

- [ ] Repair API mutates domain entities directly.
- [ ] Replay deletes the dead-letter record.
- [ ] Runtime diagnostics and repair disagree about ownership or target ids.

### Verification target

- `operationsRuntimeRepairActions`
- `runtimeJobs`
- `runtimeDeadLetters`
- `providerMessageReceipts`

### Recovery step

- [ ] Follow `docs/operations/runtime-recovery-runbook.md`.

## Completion criteria

- [ ] Every smoke test above passed.
- [ ] Every failed test was either recovered successfully or formally accepted as a pre-launch blocker.
- [ ] No manual smoke test required direct Firestore mutation of authoritative records.
