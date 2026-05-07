# Owner Legacy And Override QA Execution Sheet

Use this sheet for owner-only regression coverage, especially on legacy work orders and boundary cases. The owner should be able to validate broad access without masking permission bugs in the other roles.

## Setup

- [ ] Sign in as Owner
- [ ] Open `/dashboard`
- [ ] Open `/dashboard/work-orders`
- [ ] Open WO-C
- [ ] Open `/finance`

## Role Guardrails

- [ ] Confirm owner can view and operate across internal workflow areas
- [ ] Confirm owner can perform finance closeout on eligible records
- [ ] Confirm owner does not see broken UI on legacy records

## WO-C: Legacy Compatibility

- [ ] Open legacy WO-C detail page
- [ ] Load quote panel
- [ ] Load finance panel
- [ ] Hard refresh

Verify:

- [ ] No crash or 500 occurs
- [ ] No missing critical panel renders
- [ ] Timeline and relationships still load

## Legacy Mutation Check

- [ ] Perform one safe mutation on WO-C such as assignment or status update
- [ ] Hard refresh

Verify:

- [ ] Record still loads correctly
- [ ] `organizationId` is present if the mutation backfills it in this environment
- [ ] No unrelated fields changed unexpectedly

## Owner Override Regression Checks

- [ ] Confirm owner can review quote-required and finance-closeout paths without permission errors
- [ ] Confirm owner can close only paid work orders
- [ ] Confirm owner cannot bypass data integrity rules even with broad permissions

## Invalid Actions That Must Fail

- [ ] Attempt illegal status jump on WO-C
- [ ] Attempt duplicate active invoice creation
- [ ] Attempt transition on a terminal work order

Verify:

- [ ] Action fails cleanly
- [ ] No corrupted legacy state results

## Audit Vs Reality Spot Check

- [ ] Pick one fully exercised work order
- [ ] Compare visible history with final work order state

Verify:

- [ ] Lifecycle can be reconstructed from history
- [ ] Final state matches the observed sequence
