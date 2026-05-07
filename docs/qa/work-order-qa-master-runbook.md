# Work Order Platform QA Master Runbook

This QA pack is designed for a full manual pass across the internal workflow plus the client and contractor portals.

Use these execution sheets together:

- `docs/qa/work-order-qa-coordinator.md`
- `docs/qa/work-order-qa-manager.md`
- `docs/qa/work-order-qa-contractor-portal.md`
- `docs/qa/work-order-qa-client-portal.md`
- `docs/qa/work-order-qa-finance-admin.md`
- `docs/qa/work-order-qa-owner-legacy.md`
- `docs/qa/work-order-qa-seed-data.md`

Before the first pass, seed the dedicated QA fixtures:

```bash
npm run seed:qa
```

## Canonical Lifecycle To Test

Use the actual lifecycle enforced in the app:

- No-quote path: `new -> in_review -> approved_to_proceed -> assigned/dispatched -> in_progress -> completed -> invoiced -> paid -> closed`
- Quote-required path: `new -> in_review -> quote_requested -> quote_received -> pending_client_approval -> approved_to_proceed -> assigned/dispatched -> in_progress -> completed -> invoiced -> paid -> closed`

Important notes:

- `approved_to_proceed` is the quote gate release state.
- `pending_client_approval` is the state after a manager sends a quote for client approval.
- Finance closeout is not complete at `completed`; it continues through `invoiced`, `paid`, and `closed`.
- Coordinator should not approve quotes or perform finance-only actions.
- Finance Admin should not drive operational execution, but should own invoice and closeout validation.

## Test Fixtures

Create and keep these work orders open in separate tabs:

### WO-A: No Quote Required

- New work order
- Valid client organization and location
- Normal operational path
- Valid contractor available for assignment

### WO-B: Quote Required

- New work order
- `requiresQuote = true`
- Valid contractor available for quote submission and assignment

### WO-C: Legacy Compatibility

- Existing record with legacy shape if available
- Prefer a record missing `organizationId` or with older workflow history
- Use this for regression checks only

### WO-D: Minimal Required Data

- New work order
- Minimum valid fields only
- Use this for hidden-required-field detection

## Test Accounts

Confirm each login/session exists before starting:

- Coordinator
- Manager
- Finance Admin
- Owner
- Contractor User
- Client User

## Tabs To Keep Open

- `/dashboard`
- `/dashboard/work-orders`
- WO detail for WO-A
- WO detail for WO-B
- WO detail for WO-C
- `/finance`
- `/contractor/dashboard`
- `/portal`

## Global Invariants

Check these after every major transition:

- Exactly one active assignment exists for the active contractor engagement.
- Exactly one active `currentInvoiceId` exists when an invoice is active.
- `organizationId` exists and is consistent across related entities.
- `currentInvoiceId` matches the actual active invoice.
- No orphan assignment, invoice, or quote records exist.
- Status progression follows allowed transitions only.
- Lists, dashboard counts, and queues reflect backend truth after refresh.

## Recommended Execution Order

### 1. Setup

- Complete the setup sections in all role sheets.
- Seed WO-A, WO-B, WO-C, and WO-D.
- Identify one valid contractor, one inactive contractor, one non-assignable contractor, and one mismatched-trade contractor if available.

### 2. Coordinator First Pass

- Run the Coordinator sheet against WO-A and WO-B.
- Coordinator should create, triage, and request quote when needed.
- Coordinator should stop when quote approval or finance authority is required.

### 3. Manager Pass

- Run the Manager sheet on WO-A and WO-B.
- For WO-B, manager should review the contractor quote and send it for client approval.

### 4. Client Portal Pass

- Run the Client Portal sheet on WO-B.
- Validate quote visibility, approval, rejection, and access boundaries.

### 5. Coordinator Follow-up

- Return to the Coordinator sheet only if reassignment, dispatch, scheduling, or operational verification is needed after client approval.

### 6. Contractor Portal Pass

- Run the Contractor Portal sheet on WO-A and WO-B.
- Validate quote submission, accepted assignment behavior, execution updates, and restricted visibility.

### 7. Manager Close of Operations

- Confirm operational completion state and any manager-only override paths.

### 8. Finance Admin Pass

- Run the Finance Admin sheet on WO-A and WO-B.
- Validate invoice creation, issue/send, paid, close, and finance constraints.

### 9. Owner Legacy/Override Pass

- Use the Owner sheet on WO-C for legacy compatibility and any owner-only regression checks.

## High-Risk Regression Areas

- Quote-required work bypassing `pending_client_approval` or `approved_to_proceed`
- Contractor seeing internal notes, finance data, or unrelated jobs
- Client seeing internal-only workflow data
- Duplicate active assignments after reassign
- Duplicate active invoices after void/recreate or rapid clicks
- Work order close allowed before invoice is paid
- Legacy records failing when read or mutated
- Dashboard, queues, and detail pages drifting out of sync

## Final Go / No-Go

Ship only if all are true:

- No crashes or 500s
- No broken permissions
- No invalid transitions allowed
- No duplicate active assignments or invoices
- No corrupted `organizationId` or relationship integrity issues
- Quote approval path behaves correctly end to end
- Finance closeout behaves correctly end to end
- Contractor and client portals expose only allowed data and actions
- Legacy work orders remain usable
- Audit and timeline history match the actual lifecycle
