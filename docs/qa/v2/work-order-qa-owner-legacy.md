# Work Order Platform QA Owner Legacy v2

- **Title:** `Work Order Platform QA Owner Legacy v2`
- **Purpose:** `Validate legacy work order compatibility, owner-wide regression coverage, and integrity rules on older mixed-path records.`
- **Role under test:** `Owner`
- **Environment:** `________________`
- **Tester name:** `________________`
- **Date:** `________________`
- **Fixture IDs used:** `WO-C`
- **Preconditions:** `Owner account available. Legacy candidate WO-C available.`
- **Overall result:** `[ ] Pass  [ ] Fail  [ ] Blocked`
- **Bugs logged:** `________________`
- **Evidence links:** `________________`
- **Retest status:** `[ ] Not needed  [ ] Pending  [ ] Passed  [ ] Failed`
- **Final sign-off:** `________________`

## Always Validate

### Objective
Enforce owner-scoped invariants while testing legacy compatibility and broad access.

### Steps
- [ ] Hard refresh WO-C detail after each successful mutation.
- [ ] Reopen the quote and finance panels after each successful mutation.
- [ ] Recheck audit or timeline history after each successful mutation.
- [ ] Inspect the persisted WO document after at least one successful legacy mutation.

### Expected Results
- [ ] No 500 occurs on read or mutation.
- [ ] `organizationId` remains present and consistent where required.
- [ ] No duplicate active related record exists.
- [ ] Broad owner access does not bypass integrity rules.

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

## Setup and Legacy Read Path

### Objective
Confirm the owner can read the legacy record without broken panel rendering.

### Steps
- [ ] Sign in as `Owner`.
- [ ] Open `/dashboard`.
- [ ] Open `/dashboard/work-orders`.
- [ ] Open WO-C.
- [ ] Open the quote panel.
- [ ] Open the finance panel.
- [ ] Hard refresh.

### Expected Results
- [ ] WO-C detail loads.
- [ ] Quote panel loads.
- [ ] Finance panel loads.
- [ ] No crash or 500 occurs.

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

## Legacy Mutation and Backfill Integrity

### Objective
Validate that one safe mutation succeeds and does not corrupt the legacy record.

### Steps
- [ ] Perform one safe mutation on WO-C such as assignment, reassignment, or a valid status update.
- [ ] Hard refresh the detail page.
- [ ] Inspect the saved WO document directly.

### Expected Results
- [ ] Mutation succeeds without Firestore or authorization failure.
- [ ] WO-C still loads after refresh.
- [ ] `organizationId` is present if the mutation path backfills it.
- [ ] No unrelated field is corrupted.

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

## Integrity Rules Still Enforced

### Objective
Validate that owner breadth does not permit illegal workflow shortcuts.

### Steps
- [ ] Attempt one illegal status jump on WO-C.
- [ ] Attempt duplicate active invoice creation.
- [ ] Attempt a terminal-state mutation if WO-C is already terminal.

### Expected Results
- [ ] Illegal status jump is blocked.
- [ ] Duplicate active invoice creation is blocked.
- [ ] Terminal-state mutation is blocked.
- [ ] No corrupted legacy state remains after refresh.

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

## Audit Versus Persisted Reality

### Objective
Validate that logs and stored record state match the actual lifecycle.

### Steps
- [ ] Select one fully exercised WO.
- [ ] Compare visible history with current WO, assignment, quote, and invoice state.
- [ ] Confirm no duplicate transition row exists for the tested action set.

### Expected Results
- [ ] The lifecycle can be reconstructed from history.
- [ ] Logged `from -> to` values match final persisted state.
- [ ] Actor role and timestamp are present on the tested actions.

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
