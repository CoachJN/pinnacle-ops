# Manager QA Execution Sheet

Use this sheet for manager-owned workflow control. The manager should validate review authority, quote handling, release to execution, and operational oversight without crossing into finance-only closeout.

## Setup

- [ ] Sign in as Manager
- [ ] Open `/dashboard`
- [ ] Open `/dashboard/work-orders`
- [ ] Open WO-A and WO-B
- [ ] Confirm manager dashboard queues load

## Role Guardrails

- [ ] Confirm manager can create and edit non-terminal work orders
- [ ] Confirm manager can review and send quotes for client approval
- [ ] Confirm manager cannot perform finance-only invoice actions
- [ ] Confirm manager cannot close paid work orders through finance closeout

## WO-A: No-Quote Operational Approval

- [ ] Open WO-A in `in_review`
- [ ] Move WO-A to `approved_to_proceed` if not already there
- [ ] Confirm execution-oriented actions become available
- [ ] Assign or reassign valid contractor if needed
- [ ] Hard refresh

Verify:

- [ ] Status is correct after refresh
- [ ] Assignment remains singular and accurate
- [ ] Dashboard and list queues update correctly

## WO-B: Quote Review And Client Approval Request

### Internal Review

- [ ] Open WO-B after contractor submits quote
- [ ] Verify work order status is `quote_received`
- [ ] Review quote values, notes, and history
- [ ] Mark quote under review if applicable in UI
- [ ] Send quote for client approval
- [ ] Hard refresh

Verify:

- [ ] Work order status is `pending_client_approval`
- [ ] Quote status is ready for client response
- [ ] Timeline records the manager action once

### Gate Validation

- [ ] Attempt to move WO-B into execution before client approval

Expected:

- [ ] Action is blocked
- [ ] Status remains `pending_client_approval`
- [ ] No duplicate approval records exist

### Post-Approval Release

After the client approves in the portal:

- [ ] Reopen WO-B as Manager
- [ ] Confirm work order is `approved_to_proceed`
- [ ] Confirm quote status shows client approval
- [ ] Assign or confirm contractor
- [ ] Move to dispatch/scheduling path if the UI exposes it
- [ ] Hard refresh

Verify:

- [ ] No quote-gate bypasses occurred
- [ ] Work order remains consistent across list and detail pages

## Operational Completion Oversight

- [ ] Review WO-A or WO-B after contractor progress updates
- [ ] Confirm `in_progress` and `completed` states render cleanly
- [ ] Confirm manager can oversee but not improperly skip required stages

## Invalid Actions That Must Fail

- [ ] Attempt finance invoice creation as manager
- [ ] Attempt finance close on a paid work order as manager
- [ ] Attempt direct bypass from `quote_requested` to execution

Verify:

- [ ] Action fails cleanly
- [ ] No status drift occurs
- [ ] No incorrect audit/timeline entries appear

## Cross-Page Validation

- [ ] Work order detail matches list row
- [ ] Dashboard queues reflect manager-visible work correctly
- [ ] No stale status remains after hard refresh
