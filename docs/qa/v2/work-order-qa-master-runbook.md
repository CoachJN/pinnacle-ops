# Work Order Platform QA Master Runbook v2

- **Title:** `Work Order Platform QA Master Runbook v2`
- **Purpose:** `Define the release-gate execution order, shared invariants, fixture map, evidence rules, and final go or no-go decision.`
- **Role under test:** `Shared cross-role workflow`
- **Environment:** `________________`
- **Tester name:** `________________`
- **Date:** `________________`
- **Fixture IDs used:** `WO-A, WO-B, WO-C, WO-D`
- **Preconditions:** `Seed data loaded, test accounts available, each role sheet assigned to a tester.`
- **Overall result:** `[ ] Pass  [ ] Fail  [ ] Blocked`
- **Bugs logged:** `________________`
- **Evidence links:** `________________`
- **Retest status:** `[ ] Not needed  [ ] Pending  [ ] Passed  [ ] Failed`
- **Final sign-off:** `________________`

## Execution Order

### Objective
Run the pack in the required order so each role receives the correct handoff state.

### Steps
- [ ] Run `work-order-qa-seed-data.md`.
- [ ] Run `work-order-qa-coordinator.md`.
- [ ] Hand off WO-B quote review state to Manager.
- [ ] Run `work-order-qa-manager.md`.
- [ ] Hand off WO-B client quote response state to Client Portal.
- [ ] Run `work-order-qa-client-portal.md`.
- [ ] Hand off approved execution state to Contractor Portal.
- [ ] Run `work-order-qa-contractor-portal.md`.
- [ ] Hand off completed operational state to Finance Admin.
- [ ] Run `work-order-qa-finance-admin.md`.
- [ ] Run `work-order-qa-owner-legacy.md` last for legacy and override regression coverage.

### Expected Results
- [ ] Each role receives the expected record state.
- [ ] No role performs a step outside its scope.
- [ ] The pack covers both lifecycle paths and the legacy compatibility path.

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

## Fixture Map

### Objective
Map each shared fixture to the exact lifecycle and regression purpose.

### Steps
- [ ] Use `WO-A` for the no-quote path.
- [ ] Use `WO-B` for the quote-required path.
- [ ] Use `WO-C` for the legacy compatibility path.
- [ ] Use `WO-D` for the minimum-data path.

### Expected Results
- [ ] `WO-A` follows `new -> in_review -> approved_to_proceed -> assigned/dispatched -> in_progress -> completed -> invoiced -> paid -> closed`.
- [ ] `WO-B` follows `new -> in_review -> quote_requested -> quote_received -> pending_client_approval -> approved_to_proceed -> assigned/dispatched -> in_progress -> completed -> invoiced -> paid -> closed`.
- [ ] `WO-C` remains readable and mutable without 500s.
- [ ] `WO-D` exposes no hidden late-stage required field dependency.

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

## Always Validate

### Objective
Enforce the shared invariants that must hold after every major transition.

### Steps
- [ ] Hard refresh the current detail page after every successful mutation.
- [ ] Recheck the list, dashboard, contractor portal, client portal, or finance queue affected by that mutation.
- [ ] Inspect audit or timeline history after every successful mutation.
- [ ] Inspect the saved record directly for at least one successful legacy mutation.

### Expected Results
- [ ] No illegal status jump occurs.
- [ ] No duplicate active assignment exists.
- [ ] No duplicate active invoice exists.
- [ ] `organizationId` remains consistent where required.
- [ ] No orphan quote, assignment, or invoice record exists.
- [ ] No list, detail, dashboard, or queue mismatch remains after refresh.
- [ ] Audit or timeline entries show correct `from -> to`, actor role, timestamp, and no duplicate event row.

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

## Multi-Session Collision Test

### Objective
Validate that conflicting actions do not create duplicate writes or corrupt state.

### Steps
- [ ] Open the same WO in two `Owner` sessions.
- [ ] Open the same WO in one `Owner` session and one `Contractor` session.
- [ ] Attempt `assign contractor` in one session and `reassign contractor` in the other.
- [ ] Attempt `complete assignment` in one session and `move work order status` in the other.
- [ ] Attempt duplicate invoice creation from two sessions.

### Expected Results
- [ ] One action succeeds.
- [ ] One action fails cleanly or refreshes to current state.
- [ ] No duplicate assignment, invoice, or event record is created.
- [ ] Final persisted state is internally consistent after refresh.

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

## Orchestration and Notification Check

### Objective
Validate side effects for key workflow milestones.

### Steps
- [ ] Inspect notification or intent records after `quote_requested`.
- [ ] Inspect notification or intent records after `approved_to_proceed`.
- [ ] Inspect notification or intent records after `in_progress`.
- [ ] Inspect notification or intent records after `completed`.
- [ ] Inspect notification or intent records after `invoiced`.

### Expected Results
- [ ] Required intent or automation records exist.
- [ ] No duplicate intent or automation record exists for a single action.
- [ ] Missing or blocked transitions do not emit success-side effects.

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

## Required Evidence Checklist

### Objective
Define the minimum evidence required for a release decision.

### Steps
- [ ] Capture one end-to-end no-quote WO evidence set.
- [ ] Capture one end-to-end quote-required WO evidence set.
- [ ] Capture one successful legacy WO mutation evidence set.
- [ ] Capture one failed invalid shortcut evidence set.
- [ ] Capture one multi-session collision evidence set.

### Expected Results
- [ ] Evidence links are complete.
- [ ] All critical IDs are recorded.
- [ ] All failed cases have bug IDs or explicit waiver notes.

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

## Final Release Gate

### Objective
Make the final go or no-go decision from shared criteria instead of tester interpretation.

### Steps
- [ ] Review all role sheet document-level results.
- [ ] Review all open bug IDs.
- [ ] Review all blocked sections.
- [ ] Review evidence completeness.

### Expected Results
- [ ] **Go** only if there are no unresolved Sev-1 or Sev-2 defects, no data integrity failures, no permission leaks, no duplicate active assignment or invoice records, and no legacy compatibility 500s.
- [ ] **No-Go** if any lifecycle integrity rule fails, any role sees unauthorized data, any multi-session collision corrupts data, or evidence is incomplete for the critical paths.

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
