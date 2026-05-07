# Work Order Platform QA Seed Data v2

- **Title:** `Work Order Platform QA Seed Data v2`
- **Purpose:** `Define the shared fixtures, account assumptions, and record IDs required by the QA pack.`
- **Role under test:** `Shared fixtures`
- **Environment:** `________________`
- **Tester name:** `________________`
- **Date:** `________________`
- **Fixture IDs used:** `client-qa-*, loc-qa-*, contractor-qa-*, wo-qa-*`
- **Preconditions:** `Seeder available and target environment selected.`
- **Overall result:** `[ ] Pass  [ ] Fail  [ ] Blocked`
- **Bugs logged:** `________________`
- **Evidence links:** `________________`
- **Retest status:** `[ ] Not needed  [ ] Pending  [ ] Passed  [ ] Failed`
- **Final sign-off:** `________________`

## Seed Execution

### Objective
Load predictable fixtures before running the role sheets.

### Steps
- [ ] Run the approved seed command for this environment.
- [ ] Confirm the seed completes without errors.
- [ ] Confirm rerunning the seed updates the same records instead of creating duplicates.

### Expected Results
- [ ] Seed data is available.
- [ ] Stable fixture IDs remain unchanged.
- [ ] No duplicate fixture records are created.

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

## Fixture Inventory

### Objective
Record the exact shared fixtures used by the pack.

### Steps
- [ ] Confirm client fixtures exist: `client-qa-northstar`, `client-qa-harbor`.
- [ ] Confirm location fixtures exist: `loc-qa-northstar-tower`, `loc-qa-harbor-plaza`.
- [ ] Confirm contractor fixtures exist: `contractor-qa-summit-mechanical`, `contractor-qa-nightwatch-electric`, `contractor-qa-inactive-facilities`, `contractor-qa-backoffice-cleaning`.
- [ ] Confirm work order fixtures exist: `wo-qa-a-no-quote`, `wo-qa-b-quote-required`, `wo-qa-c-legacy-candidate`, `wo-qa-d-minimal`.

### Expected Results
- [ ] All shared fixture IDs resolve to records.
- [ ] Fixture names match the intended role sheets.
- [ ] WO-A, WO-B, WO-C, and WO-D are available for use.

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

## Account Inventory

### Objective
Confirm the tester accounts required by the pack are available before execution starts.

### Steps
- [ ] Confirm `Coordinator` account.
- [ ] Confirm `Manager` account.
- [ ] Confirm `Finance Admin` account.
- [ ] Confirm `Owner` account.
- [ ] Confirm `Contractor User` account.
- [ ] Confirm `Client User` account.

### Expected Results
- [ ] All accounts can sign in.
- [ ] Each account lands in the correct scope.
- [ ] No account is missing a required organization or portal binding.

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
