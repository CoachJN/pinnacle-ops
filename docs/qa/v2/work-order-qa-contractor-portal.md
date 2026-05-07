# Work Order Platform QA Contractor Portal v2

- **Title:** `Work Order Platform QA Contractor Portal v2`
- **Purpose:** `Validate assigned work visibility, quote submission, assignment acceptance, execution updates, and contractor isolation.`
- **Role under test:** `Contractor User`
- **Environment:** `________________`
- **Tester name:** `________________`
- **Date:** `________________`
- **Fixture IDs used:** `WO-A, WO-B`
- **Preconditions:** `Contractor account available. WO-B in quote request state for the assigned contractor. WO-A or WO-B assigned to the contractor for execution.`
- **Overall result:** `[ ] Pass  [ ] Fail  [ ] Blocked`
- **Bugs logged:** `________________`
- **Evidence links:** `________________`
- **Retest status:** `[ ] Not needed  [ ] Pending  [ ] Passed  [ ] Failed`
- **Final sign-off:** `________________`

## Always Validate

### Objective
Enforce contractor-scoped invariants after each successful action.

### Steps
- [ ] Hard refresh the contractor dashboard and current WO detail after each successful mutation.
- [ ] Reopen the same WO by direct URL after the mutation.
- [ ] Recheck timeline history after each quote or assignment action.

### Expected Results
- [ ] No unauthorized data is visible.
- [ ] No unrelated work order is visible.
- [ ] No duplicate quote submission or duplicate completion event exists.
- [ ] No stale contractor dashboard state remains after refresh.

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
Confirm the contractor session is scoped only to assigned contractor work.

### Steps
- [ ] Sign in as `Contractor User`.
- [ ] Open `/contractor/dashboard`.
- [ ] Open the contractor work order list.
- [ ] Attempt to access one internal dashboard URL directly.
- [ ] Attempt to access one unrelated work order URL directly.

### Expected Results
- [ ] Contractor dashboard loads.
- [ ] Only assigned work appears.
- [ ] Internal dashboard access is blocked.
- [ ] Unrelated work order access is blocked without data leakage.

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

## WO-B Quote Submission

### Objective
Validate contractor quote submission on the assigned quote-requested work order.

### Steps
- [ ] Open WO-B in `quote_requested`.
- [ ] Confirm the quote submission control is present.
- [ ] Submit the contractor quote once.
- [ ] Attempt the same submission again if the UI still exposes it.

### Expected Results
- [ ] Initial quote submission succeeds.
- [ ] WO-B later appears as `quote_received` to internal users.
- [ ] Duplicate submission is blocked or state refresh removes the action.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Work order ID:

Quote ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked

## Assignment Acceptance

### Objective
Validate contractor acceptance on an assigned work order.

### Steps
- [ ] Open the assigned WO.
- [ ] Accept the assignment.
- [ ] Hard refresh the detail page.

### Expected Results
- [ ] Assignment status changes to accepted.
- [ ] The work order remains visible in the contractor dashboard.
- [ ] No duplicate assignment acceptance event exists.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Work order ID:

Assignment ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked

## Execution and Completion

### Objective
Validate contractor execution updates and assignment completion.

### Steps
- [ ] Open a WO in an execution-ready state.
- [ ] Move it to `in_progress` if the contractor action is exposed.
- [ ] Add any required completion notes.
- [ ] Mark the assignment complete.

### Expected Results
- [ ] Only allowed execution transitions succeed.
- [ ] Completion requires the expected input if the UI enforces it.
- [ ] Contractor completion does not create duplicate completion entries.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Work order ID:

Assignment ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked

## Restricted Visibility

### Objective
Validate that contractor views do not leak internal or finance-only data.

### Steps
- [ ] Inspect the WO detail page.
- [ ] Inspect the dashboard list item.
- [ ] Inspect the quote page after submission.

### Expected Results
- [ ] Internal notes are absent.
- [ ] Finance data and finance controls are absent.
- [ ] Internal review commentary is absent.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Work order ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked

## Contractor and Owner Collision

### Objective
Validate that concurrent contractor and internal actions do not corrupt state.

### Steps
- [ ] Open the same WO in a contractor session and an owner session.
- [ ] Complete the assignment from the contractor session.
- [ ] Refresh the owner session and attempt a conflicting status action.

### Expected Results
- [ ] One consistent final state remains.
- [ ] No duplicate completion record exists.
- [ ] No corrupted status combination remains after refresh.

### Evidence To Capture
- [ ] Screenshot
- [ ] URL
- [ ] Record ID
- [ ] Audit or timeline note
- [ ] Bug ID if failed

Screenshot:

URL tested:

Work order ID:

Assignment ID:

Audit or timeline evidence:

Bug ID if failed:

Notes:

### Section Result
- [ ] Passed
- [ ] Failed
- [ ] Blocked
