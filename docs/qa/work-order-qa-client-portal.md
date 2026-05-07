# Client Portal QA Execution Sheet

Use this sheet for client-facing validation. The client portal should expose only scoped client data, show the quote decision workflow clearly, and avoid leaking internal-only fields.

## Setup

- [ ] Sign in as Client User
- [ ] Open `/portal`
- [ ] Open `/portal/work-orders`
- [ ] Confirm landing page loads without errors
- [ ] Confirm only the client's organization and permitted locations are visible

## Role Guardrails

- [ ] Confirm client cannot access internal dashboard pages
- [ ] Confirm client cannot see internal notes
- [ ] Confirm client cannot see invoice closeout controls
- [ ] Confirm client only sees its own locations and work orders

## Landing And List Checks

- [ ] Confirm organization summary is correct
- [ ] Confirm active work order count looks correct
- [ ] Confirm quotes awaiting response count looks correct
- [ ] Filter/search work orders and confirm results stay in scope

## WO-B: Quote Approval Flow

- [ ] Open WO-B after manager sends quote for approval
- [ ] Confirm work order appears with quote waiting state
- [ ] Open the linked quote detail
- [ ] Review line items, subtotal, tax, and total

### Approval Path

- [ ] Approve quote
- [ ] Hard refresh quote page
- [ ] Hard refresh work order page

Verify:

- [ ] Quote status becomes approved
- [ ] Work order moves to `approved_to_proceed`
- [ ] Response timestamp appears once

### Rejection Path

Repeat on a fresh quote-required scenario if needed:

- [ ] Reject quote with a reason
- [ ] Hard refresh

Verify:

- [ ] Quote status becomes rejected
- [ ] Work order returns to `quote_requested`
- [ ] Internal team can create a revised quote afterward

## Restricted Visibility Checks

- [ ] Confirm internal notes are absent
- [ ] Confirm contractor internal workflow controls are absent
- [ ] Confirm finance/admin-only data is absent
- [ ] Confirm data from other locations or organizations is inaccessible

## Invalid Actions That Must Fail

- [ ] Attempt to access another client's work order by URL
- [ ] Attempt to access another client's quote by URL
- [ ] Attempt to perform internal-only workflow actions

Verify:

- [ ] Access fails safely
- [ ] No data leaks in the error path

## Refresh And Stale State Checks

- [ ] Keep WO-B open in client portal
- [ ] Change internal state elsewhere
- [ ] Return and attempt action

Verify:

- [ ] State refreshes correctly or stale action is blocked
- [ ] No duplicate client responses are recorded
