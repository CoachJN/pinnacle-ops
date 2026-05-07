# Work Order Platform QA Coordinator v2

- **Title:** `Work Order Platform QA Coordinator v2`
- **Purpose:** `Validate intake, triage, quote request initiation, assignment support, and coordinator role boundaries.`
- **Role under test:** `Coordinator`
- **Environment:** `________________`
- **Tester name:** `________________`
- **Date:** `________________`
- **Fixture IDs used:** `WO-A, WO-B, WO-D`
- **Preconditions:** `Coordinator account available. Seed fixtures loaded. Valid, inactive, non-assignable, and mismatched contractors available.`
- **Overall result:** `[ ] Pass  [ ] Fail  [ ] Blocked`
- **Bugs logged:** `________________`
- **Evidence links:** `________________`
- **Retest status:** `[ ] Not needed  [ ] Pending  [ ] Passed  [ ] Failed`
- **Final sign-off:** `________________`

## Always Validate

### Objective
Enforce the coordinator-scoped invariants after each successful action.

### Steps
- [ ] Hard refresh the current WO detail page after each successful mutation.
- [ ] Recheck `/dashboard` and `/dashboard/work-orders`.
- [ ] Recheck assignment state after any assignment attempt.
- [ ] Recheck audit or timeline history after any status or assignment mutation.

### Expected Results
- [ ] No illegal status jump occurs.
- [ ] No duplicate active assignment exists.
- [ ] No stale list or dashboard mismatch remains after refresh.
- [ ] No unauthorized quote approval or finance action becomes available.

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
Confirm the coordinator session and scope are correct before workflow execution starts.

### Steps
- [ ] Sign in as `Coordinator`.
- [ ] Open `/dashboard`.
- [ ] Open `/dashboard/work-orders`.
- [ ] Open WO-A, WO-B, and WO-D in separate tabs.
- [ ] Attempt one quote approval action.
- [ ] Attempt one finance-only action.

### Expected Results
- [ ] Coordinator dashboard loads.
- [ ] Work order list loads.
- [ ] Quote approval is blocked.
- [ ] Finance-only action is blocked.

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

## WO-A No-Quote Intake and Triage

### Objective
Validate the coordinator-led no-quote path through intake and release readiness.

### Steps
- [ ] Open or create WO-A.
- [ ] Confirm initial status `new`.
- [ ] Move WO-A to `in_review`.
- [ ] Confirm `requiresQuote = false`.
- [ ] If the environment allows, move WO-A to `approved_to_proceed`. If not, stop at handoff state for Manager.

### Expected Results
- [ ] WO-A status changes only through allowed states.
- [ ] Detail, list, and dashboard all show the same status after refresh.
- [ ] No quote-gated panel is required for the no-quote path.

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

## WO-A Assignment Support and Assignment Failures

### Objective
Validate valid assignment support and contractor eligibility failures.

### Steps
- [ ] Assign the valid contractor to WO-A when the record is eligible.
- [ ] Attempt inactive contractor assignment.
- [ ] Attempt non-assignable contractor assignment.
- [ ] Attempt mismatched-trade contractor assignment.

### Expected Results
- [ ] Valid assignment succeeds once.
- [ ] Each invalid assignment fails cleanly.
- [ ] No duplicate active assignment exists after any attempt.
- [ ] Failed attempts do not mutate persisted assignment state.

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

## WO-B Quote Request Initiation

### Objective
Validate the coordinator-led quote-required path through quote request initiation without crossing approval boundaries.

### Steps
- [ ] Open or create WO-B.
- [ ] Confirm `requiresQuote = true`.
- [ ] Move WO-B to `in_review`.
- [ ] Move WO-B to `quote_requested`.
- [ ] Confirm the intended contractor is visible for later quote submission.
- [ ] Attempt to move WO-B into execution before quote approval.

### Expected Results
- [ ] WO-B reaches `quote_requested`.
- [ ] Quote workflow panel loads.
- [ ] Execution path is blocked before client-approved quote release.
- [ ] No duplicate quote or status event appears.

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

## WO-D Minimal Data Path

### Objective
Validate that the minimum valid data set does not fail later in the lifecycle.

### Steps
- [ ] Open or create WO-D with minimum required fields only.
- [ ] Move WO-D from `new` to `in_review`.
- [ ] Perform the next valid coordinator-scoped action for its path.

### Expected Results
- [ ] WO-D saves without hidden late-stage required field errors.
- [ ] Major detail panels still render.
- [ ] No unexplained validation message appears after refresh.

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

## Handoff to Manager

### Objective
Leave WO-B in the exact state required for Manager execution.

### Steps
- [ ] Confirm WO-B is in `quote_requested` or `quote_received`, depending on the agreed handoff point.
- [ ] Record the current WO ID and quote state.
- [ ] Record any open bug IDs before handoff.

### Expected Results
- [ ] Manager receives an unambiguous next action.
- [ ] No coordinator-only partial state remains undocumented.

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
