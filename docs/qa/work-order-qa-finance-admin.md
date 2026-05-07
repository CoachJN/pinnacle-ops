# Finance Admin QA Execution Sheet

Use this sheet for the finance-owned part of the lifecycle. Finance Admin should validate invoice creation, invoice transitions, paid-state enforcement, and work order closure without driving normal operational work.

## Setup

- [ ] Sign in as Finance Admin
- [ ] Open `/finance`
- [ ] Open `/dashboard`
- [ ] Open completed WO-A and completed WO-B
- [ ] Confirm finance queue loads without errors

## Role Guardrails

- [ ] Confirm Finance Admin cannot create new work orders
- [ ] Confirm Finance Admin can view work orders, clients, locations, and finance queues
- [ ] Confirm Finance Admin can perform invoice actions on eligible work orders
- [ ] Confirm Finance Admin can close only eligible paid work orders

## Invoice Eligibility Checks

- [ ] Attempt to create invoice before work order is `completed`

Expected:

- [ ] Action fails cleanly
- [ ] No invoice is created

## WO-A Or WO-B: Invoice Creation And Send

- [ ] Create invoice draft from `completed`
- [ ] Verify invoice appears in work order finance panel
- [ ] Verify `currentInvoiceId` is populated
- [ ] Attempt to create a second active draft

Expected:

- [ ] Duplicate active invoice attempt fails cleanly

- [ ] Edit invoice draft if supported
- [ ] Issue/send invoice
- [ ] Hard refresh

Verify:

- [ ] Work order moves to `invoiced`
- [ ] Active invoice is the expected one
- [ ] Finance queue reflects the updated state

## Payment And Close

- [ ] Attempt to close before invoice is paid

Expected:

- [ ] Close is blocked

- [ ] Mark invoice paid
- [ ] Hard refresh

Verify:

- [ ] Work order moves to `paid`
- [ ] Invoice shows paid state

- [ ] Close work order
- [ ] Hard refresh

Verify:

- [ ] Work order moves to `closed`
- [ ] Closed work order leaves the active finance queue

## Void And Recreate Path

- [ ] On a fresh completed work order, create invoice draft
- [ ] Void invoice
- [ ] Confirm work order becomes eligible for replacement invoice
- [ ] Recreate invoice

Verify:

- [ ] Old invoice remains historical
- [ ] Only one active invoice exists
- [ ] `currentInvoiceId` points to the new active invoice

## Invalid Actions That Must Fail

- [ ] Attempt duplicate active invoice creation
- [ ] Attempt paid-before-invoiced path
- [ ] Attempt close-before-paid path
- [ ] Attempt void on a paid invoice

Verify:

- [ ] No corrupted finance state
- [ ] No duplicate finance records
- [ ] No illegal status jumps

## Cross-Page Validation

- [ ] Finance queue matches work order detail state
- [ ] Dashboard finance emphasis reflects actual queue state
- [ ] Work order detail remains consistent after refresh
