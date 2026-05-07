# QA Execution Template

## Header

- **Title:** `<document title>`
- **Purpose:** `<what this sheet validates>`
- **Role under test:** `<role or shared scope>`
- **Environment:** `<local / staging / production-like>`
- **Tester name:** `________________`
- **Date:** `________________`
- **Fixture IDs used:** `________________`
- **Preconditions:** `________________`
- **Overall result:** `[ ] Pass  [ ] Fail  [ ] Blocked`
- **Bugs logged:** `________________`
- **Evidence links:** `________________`
- **Retest status:** `[ ] Not needed  [ ] Pending  [ ] Passed  [ ] Failed`
- **Final sign-off:** `________________`

## Always Validate

### Objective
State the invariants that must remain true throughout the sheet.

### Steps
- [ ] Execute each major workflow step in the sheet.
- [ ] Hard refresh the current page after each successful mutation.
- [ ] Recheck the relevant list, detail, dashboard, or queue view.
- [ ] Inspect audit or timeline history for the latest mutation.

### Expected Results
- [ ] No illegal status jump occurs.
- [ ] No duplicate active related record is created.
- [ ] No unauthorized data is exposed.
- [ ] No list, detail, or dashboard mismatch remains after refresh.

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

## Section Name

### Objective
State what this section validates.

### Steps
- [ ] Perform the first tester action.
- [ ] Perform the next tester action.
- [ ] Hard refresh if the action changes state.

### Expected Results
- [ ] The first expected outcome occurs.
- [ ] The next expected outcome occurs.
- [ ] Failure conditions are clear if the action is not allowed.

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
