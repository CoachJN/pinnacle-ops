# Work Order Platform QA Finance Admin v2

- **Title:** `Work Order Platform QA Finance Admin v2`
- **Purpose:** `Validate invoice creation, invoice transitions, finance closeout, and finance role boundaries.`
- **Role under test:** `Finance Admin`
- **Environment:** `________________`
- **Tester name:** `________________`
- **Date:** `________________`
- **Fixture IDs used:** `WO-A, WO-B`
- **Preconditions:** `Finance Admin account available. At least one WO completed and ready for invoicing.`
- **Overall result:** `[ ] Pass  [ ] Fail  [ ] Blocked`
- **Bugs logged:** `________________`
- **Evidence links:** `________________`
- **Retest status:** `[ ] Not needed  [ ] Pending  [ ] Passed  [ ] Failed`
- **Final sign-off:** `________________`

## Always Validate

### Objective
Enforce finance-scoped invariants after each successful finance action.

### Steps
- [ ] Hard refresh the finance queue and current WO detail after each successful mutation.
- [ ] Recheck `currentInvoiceId` after invoice creation, send, void, recreate, and paid actions.
- [ ] Recheck audit or timeline history after each finance mutation.

### Expected Results
- [ ] No duplicate active invoice exists.
- [ ] No illegal finance status jump occurs.
- [ ] No stale finance queue or work order mismatch remains after refresh.
- [ ] No operational-only action becomes available.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Record ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked

## Setup and Role Boundary

### Objective
Confirm the finance session is scoped correctly and cannot drive normal operational work.

### Steps
- [ ] Sign in as `Finance Admin`.
- [ ] Open `/finance`.
- [ ] Open `/dashboard`.
- [ ] Attempt one work order creation action.
- [ ] Attempt one operational execution action on an in-progress WO.

### Expected Results
- [ ] Finance queue loads.
- [ ] Work order creation is blocked.
- [ ] Operational execution action is blocked.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Record ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked

## Invoice Eligibility and Premature Invoice Failure

### Objective
Validate that finance can only create invoices on eligible completed work orders.

### Steps
- [ ] Open an incomplete WO.
- [ ] Attempt invoice creation.
- [ ] Open a completed WO.
- [ ] Create the invoice draft.

### Expected Results
- [ ] Premature invoice creation is blocked.
- [ ] Eligible invoice creation succeeds.
- [ ] `currentInvoiceId` is populated for the active invoice.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Work order ID:

Invoice ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked

## Invoice Send, Paid, and Close

### Objective
Validate the normal finance closeout path.

### Steps
- [ ] Open the completed WO with a draft invoice.
- [ ] Send the invoice.
- [ ] Attempt to close the WO before payment.
- [ ] Mark the invoice paid.
- [ ] Close the WO.

### Expected Results
- [ ] Send moves the WO to `invoiced`.
- [ ] Close-before-paid is blocked.
- [ ] Mark paid moves the WO to `paid`.
- [ ] Close succeeds only after the paid state is valid.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Work order ID:

Invoice ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked

## Invoice Uniqueness, Void, and Recreate

### Objective
Validate active invoice uniqueness and void/recreate integrity.

### Steps
- [ ] Create an invoice draft on an eligible WO.
- [ ] Attempt to create a second active invoice.
- [ ] Void the first invoice.
- [ ] Recreate the replacement invoice.
- [ ] Attempt a second active invoice again after the replacement exists.

### Expected Results
- [ ] Duplicate active invoice creation is blocked.
- [ ] Void returns the WO to an invoice-eligible state.
- [ ] Replacement invoice becomes the active invoice.
- [ ] `currentInvoiceId` points to the replacement invoice only.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Work order ID:

Invoice ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked

## Invalid Finance Shortcuts

### Objective
Validate that finance integrity rules remain enforced.

### Steps
- [ ] Attempt paid-before-invoiced.
- [ ] Attempt close-before-paid.
- [ ] Attempt void on a paid invoice.

### Expected Results
- [ ] Each invalid shortcut is blocked.
- [ ] No corrupted finance state remains after refresh.
- [ ] No duplicate finance event is emitted for blocked actions.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Work order ID:

Invoice ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked
