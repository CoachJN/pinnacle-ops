# Work Order Platform QA Client Portal v2

- **Title:** `Work Order Platform QA Client Portal v2`
- **Purpose:** `Validate client-scoped work order visibility, quote response, and client portal data isolation.`
- **Role under test:** `Client User`
- **Environment:** `________________`
- **Tester name:** `________________`
- **Date:** `________________`
- **Fixture IDs used:** `WO-B`
- **Preconditions:** `Client account available. WO-B quote sent for client approval.`
- **Overall result:** `[ ] Pass  [ ] Fail  [ ] Blocked`
- **Bugs logged:** `________________`
- **Evidence links:** `________________`
- **Retest status:** `[ ] Not needed  [ ] Pending  [ ] Passed  [ ] Failed`
- **Final sign-off:** `________________`

## Always Validate

### Objective
Enforce client-scoped invariants after each successful action.

### Steps
- [ ] Hard refresh the client portal list and current detail page after each successful mutation.
- [ ] Recheck list visibility after filtering or searching.
- [ ] Recheck quote history after approval or rejection.

### Expected Results
- [ ] No unauthorized data is visible.
- [ ] Only scoped organization and location data is visible.
- [ ] No duplicate client response event exists.
- [ ] No stale list or detail mismatch remains after refresh.

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
Confirm the client session is limited to the correct organization and location scope.

### Steps
- [ ] Sign in as `Client User`.
- [ ] Open `/portal`.
- [ ] Open the client work order list.
- [ ] Attempt one internal dashboard URL directly.
- [ ] Attempt one unrelated client work order URL directly.

### Expected Results
- [ ] Client portal loads.
- [ ] Only allowed organization and location records appear.
- [ ] Internal dashboard access is blocked.
- [ ] Unrelated client work order access is blocked without data leakage.

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

## Landing and List Scope

### Objective
Validate list counts, filters, and portal summary state.

### Steps
- [ ] Open the landing page summary.
- [ ] Open the work order list.
- [ ] Apply the expected filters or search.
- [ ] Hard refresh the list page.

### Expected Results
- [ ] Summary counts are scoped correctly.
- [ ] Filtered results remain in scope.
- [ ] No unrelated organization or location row appears.

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

## WO-B Quote Approval

### Objective
Validate the client approval path on a quote awaiting response.

### Steps
- [ ] Open WO-B in the client portal.
- [ ] Open the linked quote detail.
- [ ] Review quote values.
- [ ] Approve the quote.
- [ ] Hard refresh the quote and work order pages.

### Expected Results
- [ ] Quote status changes to approved.
- [ ] WO-B moves to `approved_to_proceed`.
- [ ] One response timestamp is recorded.

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

## WO-B Quote Rejection

### Objective
Validate the client rejection path and return to quote request state.

### Steps
- [ ] Use a fresh quote-required scenario.
- [ ] Open the quote awaiting response.
- [ ] Reject the quote with a reason.
- [ ] Hard refresh the quote and work order pages.

### Expected Results
- [ ] Quote status changes to rejected.
- [ ] WO-B returns to `quote_requested`.
- [ ] Internal users can continue with a revised quote path.

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

## Restricted Visibility

### Objective
Validate that client views do not expose internal, contractor-only, or finance-only data.

### Steps
- [ ] Inspect the work order detail page.
- [ ] Inspect the quote detail page.
- [ ] Attempt one internal-only workflow action if any control is visible.

### Expected Results
- [ ] Internal notes are absent.
- [ ] Contractor internal workflow controls are absent.
- [ ] Finance closeout data and controls are absent.

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
