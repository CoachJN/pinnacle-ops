# Work Order Platform QA Manager v2

- **Title:** `Work Order Platform QA Manager v2`
- **Purpose:** `Validate quote review, quote send, release to execution, and manager operational oversight.`
- **Role under test:** `Manager`
- **Environment:** `________________`
- **Tester name:** `________________`
- **Date:** `________________`
- **Fixture IDs used:** `WO-A, WO-B`
- **Preconditions:** `Manager account available. WO-A ready for no-quote release. WO-B quote submitted or ready for quote review.`
- **Overall result:** `[ ] Pass  [ ] Fail  [ ] Blocked`
- **Bugs logged:** `________________`
- **Evidence links:** `________________`
- **Retest status:** `[ ] Not needed  [ ] Pending  [ ] Passed  [ ] Failed`
- **Final sign-off:** `________________`

## Always Validate

### Objective
Enforce manager-scoped invariants after each successful action.

### Steps
- [ ] Hard refresh WO detail after each successful mutation.
- [ ] Recheck the work order list and dashboard queues.
- [ ] Recheck quote status after review or send actions.
- [ ] Recheck audit or timeline history after review, send, or status release actions.

### Expected Results
- [ ] No illegal status jump occurs.
- [ ] No quote-required WO enters execution before approval.
- [ ] No duplicate quote send or approval event exists.
- [ ] No finance-only control becomes available.

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
Confirm the manager session is correct and finance-only controls remain blocked.

### Steps
- [ ] Sign in as `Manager`.
- [ ] Open `/dashboard`.
- [ ] Open `/dashboard/work-orders`.
- [ ] Open WO-A and WO-B.
- [ ] Attempt one finance invoice action.
- [ ] Attempt one finance closeout action.

### Expected Results
- [ ] Dashboard and list load.
- [ ] Finance invoice action is blocked.
- [ ] Finance closeout action is blocked.

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

## WO-A No-Quote Release to Execution

### Objective
Validate manager release authority for the no-quote path.

### Steps
- [ ] Open WO-A in `in_review` if not already released.
- [ ] Move WO-A to `approved_to_proceed`.
- [ ] Assign or confirm the valid contractor.
- [ ] Move WO-A into `assigned` or `dispatched` if that action is exposed in the UI.

### Expected Results
- [ ] WO-A reaches the expected execution-ready state.
- [ ] Assignment remains singular.
- [ ] Detail, list, and dashboard remain consistent after refresh.

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

## WO-B Quote Review and Send

### Objective
Validate manager quote review authority and client quote release.

### Steps
- [ ] Open WO-B after contractor quote submission.
- [ ] Confirm WO-B is `quote_received`.
- [ ] Review submitted quote values and notes.
- [ ] Perform the manager review action.
- [ ] Send the quote for client approval.

### Expected Results
- [ ] Quote review succeeds once.
- [ ] WO-B moves to `pending_client_approval`.
- [ ] Quote state is ready for client response.
- [ ] Timeline records the review and send actions once each.

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

## WO-B Quote Gate Enforcement

### Objective
Validate that the manager cannot bypass the quote approval gate.

### Steps
- [ ] Attempt to move WO-B into execution before client approval.
- [ ] After client approval, reopen WO-B.
- [ ] Confirm WO-B is `approved_to_proceed`.
- [ ] Release WO-B into `assigned` or `dispatched` if available.

### Expected Results
- [ ] Pre-approval execution attempt is blocked.
- [ ] Post-approval release succeeds.
- [ ] No duplicate approval or release event appears.

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

## Operational Oversight Boundaries

### Objective
Validate manager oversight without finance closeout authority.

### Steps
- [ ] Open a WO in `in_progress`.
- [ ] Review operational progress and completion state.
- [ ] Attempt one finance closeout action on an eligible paid WO.

### Expected Results
- [ ] Operational oversight views load correctly.
- [ ] Finance closeout remains blocked.
- [ ] No unauthorized paid-to-closed transition occurs.

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
