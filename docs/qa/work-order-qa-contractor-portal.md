# Contractor Portal QA Execution Sheet

Use this sheet for the contractor-facing workflow. The contractor portal must only show assigned work and must not leak internal review notes, client approval commentary, or finance details.

## Setup

- [ ] Sign in as Contractor User
- [ ] Open `/contractor/dashboard`
- [ ] Open `/contractor/work-orders`
- [ ] Confirm only assigned jobs appear
- [ ] Confirm unrelated work orders do not appear

## Role Guardrails

- [ ] Confirm contractor cannot access internal dashboard pages
- [ ] Confirm contractor cannot see finance controls or invoice data
- [ ] Confirm contractor cannot see internal notes or internal review notes
- [ ] Confirm contractor cannot act on unassigned work

## WO-B: Quote Submission

- [ ] Open WO-B while internal status is `quote_requested`
- [ ] Confirm quote submission action is available only for the assigned contractor
- [ ] Submit contractor quote
- [ ] Hard refresh

Verify:

- [ ] Quote submission succeeds once
- [ ] Internal team later sees WO-B move to `quote_received`
- [ ] Quote history looks correct from the contractor side

## WO-A Or WO-B: Assignment Acceptance

- [ ] Open assigned work after assignment is created
- [ ] Accept assignment
- [ ] Hard refresh

Verify:

- [ ] Assignment status updates correctly
- [ ] Work order remains visible on dashboard and detail

## Execution Flow

- [ ] From `approved_to_proceed`, `dispatched`, `assigned`, or `scheduled`, move work to `in_progress` if available
- [ ] Add required completion notes
- [ ] Move work to `completed`
- [ ] Hard refresh

Verify:

- [ ] Transitions succeed only from allowed states
- [ ] Completion requires the expected notes or inputs
- [ ] Detail page reflects the latest state

## Restricted Visibility Checks

- [ ] Confirm internal notes are absent
- [ ] Confirm finance panel is absent
- [ ] Confirm client approval commentary is absent
- [ ] Confirm unrelated jobs cannot be accessed by URL

## Invalid Actions That Must Fail

- [ ] Attempt to submit quote when work order is not `quote_requested`
- [ ] Attempt to complete before moving to `in_progress` if UI allows
- [ ] Attempt to close work order
- [ ] Attempt to access a different contractor's work order by URL

Verify:

- [ ] Failure is clean
- [ ] No data changes occur
- [ ] No leaked record details are shown

## Concurrency Checks

Open the same work order in:

- [ ] Contractor + Internal user

Test:

- [ ] Contractor completes while internal user refreshes or edits
- [ ] Contractor retries same action quickly

Verify:

- [ ] One consistent final state wins
- [ ] No duplicate events or duplicate completion records appear
