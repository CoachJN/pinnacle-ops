# Coordinator QA Execution Sheet

Use this sheet for the coordinator-led parts of the workflow. The coordinator owns intake, triage, quote request initiation, assignment support, and operational validation, but should not approve quotes or perform finance-only actions.

## Setup

- [ ] Sign in as Coordinator
- [ ] Open `/dashboard`
- [ ] Open `/dashboard/work-orders`
- [ ] Open WO-A, WO-B, WO-C, and WO-D in separate tabs
- [ ] Confirm dashboard queues load without errors
- [ ] Confirm work order list loads without errors

## Role Guardrails

- [ ] Confirm coordinator can create a new work order
- [ ] Confirm coordinator can edit a non-terminal work order
- [ ] Confirm coordinator cannot approve client quotes
- [ ] Confirm coordinator cannot issue, pay, void, or close invoices

## WO-A: No-Quote Flow

### Intake And Triage

- [ ] Create WO-A or confirm it exists
- [ ] Verify initial status is `new`
- [ ] Move WO-A to `in_review`
- [ ] Hard refresh

Verify:

- [ ] Detail page reflects `in_review`
- [ ] Work order list reflects `in_review`
- [ ] Dashboard counts update
- [ ] No unexpected validation errors

### Release To Execution

- [ ] Confirm quote is not required
- [ ] Attempt to move WO-A to `approved_to_proceed` if available to coordinator in this environment
- [ ] If coordinator cannot perform that step here, hand off to Manager and resume after approval
- [ ] Assign a valid contractor when the work order is eligible
- [ ] Hard refresh

Verify:

- [ ] Assignment appears once
- [ ] Assigned contractor is correct
- [ ] No duplicate active assignment exists

### Negative Assignment Checks

- [ ] Attempt inactive contractor assignment and confirm clean failure
- [ ] Attempt non-assignable contractor assignment and confirm clean failure
- [ ] Attempt mismatched-trade contractor assignment and confirm clean failure

Verify for each failed attempt:

- [ ] No data changes
- [ ] No duplicate assignment records
- [ ] No broken page state after refresh

## WO-B: Quote-Required Flow

### Intake And Quote Request

- [ ] Create WO-B or confirm it exists
- [ ] Verify `requiresQuote = true`
- [ ] Move WO-B to `in_review`
- [ ] Move WO-B to `quote_requested`
- [ ] Assign or confirm the intended contractor for quote participation
- [ ] Hard refresh

Verify:

- [ ] Detail page reflects `quote_requested`
- [ ] Quote panel loads
- [ ] Contractor is able to see quote work in portal later

### Quote Gate Boundary

- [ ] Attempt to move WO-B directly toward execution before client approval

Expected:

- [ ] Transition is blocked cleanly
- [ ] Status remains unchanged
- [ ] No duplicate timeline or audit events appear

## WO-D: Minimal Data

- [ ] Create WO-D with minimum required fields only
- [ ] Move WO-D from `new` to `in_review`
- [ ] Attempt the normal next step for its chosen path

Verify:

- [ ] No hidden required field errors appear late
- [ ] Detail page still renders all major panels

## Cross-Page Validation After Each Coordinator Action

- [ ] Hard refresh detail page
- [ ] Hard refresh work order list
- [ ] Recheck dashboard
- [ ] Confirm no ghost items appear in wrong queue
- [ ] Confirm timeline entries look correct and non-duplicated

## Invalid Actions That Must Fail

- [ ] Attempt quote approval as coordinator
- [ ] Attempt invoice action as coordinator
- [ ] Attempt close as coordinator on a non-paid work order

Verify:

- [ ] No mutation occurred
- [ ] No unauthorized UI state leaked after refresh

## Notes For Handoff

Hand off WO-B to Manager when:

- [ ] Contractor quote has been submitted
- [ ] Quote is ready for internal review
- [ ] Coordinator has confirmed all pre-approval data is correct
