# Work Order Lifecycle Audit

Date: 2026-05-06

## Scope

This audit reviews the current platform implementation for work order lifecycle support across:

- work order creation
- work order list/detail views
- status transitions
- assignment flow
- coordinator workflow
- manager workflow
- finance/admin workflow
- quote linkage
- invoice linkage
- notes/activity/attachments
- lifecycle authorization
- lifecycle test coverage

It compares the implementation to the intended Pinnacle workflow:

- Coordinators handle intake, dispatch, follow-ups, and job completion movement
- Managers review contractor quotes and send client-facing quotes
- Approved quotes move back to coordinators
- Finance handles invoicing and payment closeout
- Owner has broad visibility and override ability

## Executive Summary

The platform has meaningful lifecycle building blocks, but the current implementation does not yet support the real Pinnacle workflow cleanly from intake through finance closeout.

The main issue is architectural split-brain:

- The dashboard work order list/detail/assignment experience is built on a newer Phase 3 uppercase lifecycle (`NEW`, `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `READY_FOR_INVOICING`, `CLOSED`).
- Quote and invoice workflows still drive a separate legacy lowercase lifecycle (`quote_requested`, `pending_client_approval`, `approved_to_proceed`, `invoiced`, `paid`, `closed`, etc.).
- A third richer lifecycle model exists in `src/lib/workflows/lifecycle`, but it is not the model the current dashboard routes actually persist.

Because of that, the platform models parts of the real workflow in different subsystems, but not as one coherent lifecycle. The result is partial workflow support, inconsistent role handoffs, incomplete UI visibility, and elevated risk that the displayed work order status does not fully reflect quote or finance reality.

## 1. Current Lifecycle Map

### A. Work order creation

Current implementation:

- Dashboard creation flows use Phase 3 services and validation.
- New work orders default to `NEW`.
- Creation captures core intake fields such as title, description, priority, client, location, requester contact, coordinator, manager, category, and requested service date.

Observed behavior:

- Intake ownership exists as coordinator and manager assignment fields.
- Quote/invoice linkage is not part of the Phase 3 work order model at creation time.
- There is no explicit intake workflow state for follow-up, quote review pending, client approval pending, or finance hold.

Assessment:

- Basic intake is supported.
- Real intake workflow orchestration is not fully modeled.

### B. Work order list view

Current implementation:

- The dashboard list is driven by the Phase 3 work order repository and shows a simplified status badge.
- Filters focus on Phase 3 status, priority, client, location, and search.
- The list shows quote requirement as a boolean/threshold indicator, not actual quote stage.

Observed behavior:

- Users can see ownership and contractor assignment at a glance.
- Users cannot see whether a work order is awaiting contractor quote, under manager quote review, awaiting client approval, invoiced, paid, or finance-closed from the main list.

Assessment:

- Good for basic dispatch operations.
- Weak for role-based queue management and end-to-end lifecycle visibility.

### C. Work order detail view

Current implementation:

- The dashboard detail page is Phase 3-centric.
- It includes overview, requester/client/location, assignments, notes, attachments, quote panel, and finance panel.
- Quote and finance data are pulled from separate legacy APIs.

Observed behavior:

- Detail view visually aggregates related lifecycle areas.
- Status controls on the page are limited by Phase 3 assignment/status logic, not by quote/invoice lifecycle state.
- There is no internal activity timeline panel even though an activity API exists.

Assessment:

- Useful composite screen.
- Not a true single lifecycle console because lifecycle authority is split across multiple models.

### D. Status progression in practice

What the platform effectively supports today:

1. Intake starts in `NEW`.
2. Internal operations can assign work, which can move the work order to `ASSIGNED`.
3. Accepted assignments allow movement to `IN_PROGRESS`.
4. Completed assignment/work can move to `COMPLETED`.
5. Operations or finance can move to `READY_FOR_INVOICING`.
6. Finance can handle invoice progression through separate invoice statuses.
7. Legacy invoice workflow can push a legacy work order into `invoiced`, `paid`, and eventually `closed`.

What is not coherent:

- Quote stages and client approval stages are not native states of the current dashboard lifecycle.
- Finance closeout stages are not native states of the current dashboard lifecycle either.
- The actual lifecycle therefore branches:
  - dashboard work order status follows Phase 3 uppercase states
  - quote/invoice services mutate a different legacy lowercase work order status model

## 2. Current Status Model

### A. Phase 3 dashboard work order statuses

Persisted and surfaced in dashboard work order flows:

- `NEW`
- `OPEN`
- `ASSIGNED`
- `IN_PROGRESS`
- `COMPLETED`
- `READY_FOR_INVOICING`
- `CANCELLED`
- `CLOSED`

Strengths:

- Simple
- Dispatch-friendly
- Easy to gate assignment and execution actions

Limitations:

- Too coarse for Pinnacle’s real workflow
- No quote review/client approval/finance payment states
- No follow-up or waiting states

### B. Legacy work order statuses still used by quote and invoice services

Still active in quote/invoice domain services:

- `new`
- `in_review`
- `quote_requested`
- `quote_received`
- `pending_client_approval`
- `approved_to_proceed`
- `dispatched`
- `assigned`
- `scheduled`
- `in_progress`
- `waiting_on_contractor`
- `waiting_on_customer`
- `completed`
- `ready_for_invoicing`
- `invoiced`
- `paid`
- `closed`
- `cancelled`

Strengths:

- Closer to the real operational and finance lifecycle
- Contains quote and payment concepts missing from Phase 3

Limitations:

- Not the lifecycle model the dashboard work order routes use
- Not aligned with the Phase 3 UI and repository model

### C. Rich lifecycle library model

There is also a richer lifecycle model under `src/lib/workflows/lifecycle` with states such as:

- `TRIAGE`
- `QUOTING_REQUIRED`
- `AWAITING_QUOTE`
- `QUOTE_RECEIVED`
- `QUOTE_REVIEW`
- `AWAITING_CLIENT_APPROVAL`
- `APPROVED_TO_PROCEED`
- `SCHEDULING`
- `SCHEDULED`
- `WORK_COMPLETED`
- `QA_REVIEW`
- `READY_FOR_INVOICING`
- `COMPLETED`
- `ON_HOLD`
- `ESCALATED`

Assessment:

- This model is the closest fit to the real Pinnacle workflow.
- It is not currently the authoritative persisted lifecycle for the dashboard work order experience.

## 3. Missing Workflow States/Actions

### Missing or not fully represented states

- Intake triage queue
- Quote required vs no-quote decision as a true work order state
- Awaiting contractor quote
- Contractor quote received pending manager review
- Client quote sent / awaiting client approval
- Quote approved and handed back to coordinator
- Scheduling pending vs scheduled
- Follow-up / waiting on contractor
- Follow-up / waiting on client
- QA or completion verification before finance
- Invoice sent / viewed / overdue as work order-visible finance states
- Payment received / finance closeout complete as explicit work order states
- Hold / escalation reasons with resumable context

### Missing or weak actions

- Coordinator “request quote” and “follow up quote” actions in the active dashboard lifecycle
- Manager “review contractor quote” as a native work order state transition
- Manager-to-coordinator handback after quote approval
- Coordinator “resume after quote approval” action/state
- Finance “close out after payment verified” action in the same work order lifecycle
- Owner override action model unified across all lifecycle stages

## 4. Role-Based Workflow Gaps

## Coordinators

Expected:

- intake
- dispatch
- follow-ups
- move work through completion

Current support:

- Strong support for assignment, reassignment, and operational progression in Phase 3
- Can own coordinator assignment and contractor dispatch
- Can move work toward completion in the dashboard lifecycle

Gaps:

- No first-class follow-up states in the active dashboard lifecycle
- No first-class “awaiting quote” or “awaiting client approval return” queue in the dashboard work order model
- Quote workflow is mostly off to the side rather than embedded in coordinator queues
- No explicit post-approval handback state that routes work from manager back to coordinator

Assessment:

- Coordinators are supported for dispatch execution, but not for the full real intake-to-close operational flow.

## Managers

Expected:

- review contractor quotes
- send client-facing quotes

Current support:

- Manager can review contractor quotes
- Manager can create/send client quotes
- Manager has broader quote authority than coordinator

Gaps:

- Quote review is not integrated into the primary dashboard status model
- No manager review queue in the work order list based on quote state
- No explicit handoff back to coordinators after client approval in the active dashboard workflow
- Manager approval work is visible in quote APIs but weakly represented in work order state and list UX

Assessment:

- Core quote actions exist.
- Workflow ownership and queueing around those actions are under-modeled.

## Finance/Admin

Expected:

- invoicing
- payment closeout

Current support:

- Invoice creation and transition flow exists
- Finance queue exists
- Finance can move invoices through sent, overdue, paid, void, and related actions

Gaps:

- Finance lifecycle is mostly invoice-centric, not work-order-centric
- Work order dashboard lifecycle does not naturally expose `invoiced`, `paid`, or closeout stages
- Finance panel visibility exists, but finance state is not prominent in list/detail lifecycle status
- Payment closeout is not modeled as a first-class end-of-work-order operational closure stage in Phase 3

Assessment:

- Finance operations exist, but they sit beside the dashboard lifecycle instead of inside it.

## Owner

Expected:

- broad visibility
- override ability

Current support:

- Owner has broad permissions across work order, quote, assignment, and finance actions
- Owner can bypass many role limits

Gaps:

- Override power is still constrained by split lifecycle architecture
- Broad visibility exists technically, but the UI does not provide a single authoritative lifecycle picture

Assessment:

- Owner support is comparatively strong, but still limited by fragmented lifecycle design.

## 5. Data Model Gaps

### Work order core model gaps in Phase 3

The active Phase 3 work order model does not natively include:

- current quote linkage
- current invoice linkage
- quote status summary
- invoice status summary
- client approval timestamps
- payment timestamps
- hold reason
- escalation reason
- previous status for resumable holds
- lifecycle stage ownership metadata by step
- quote review owner / finance owner as workflow assignments distinct from coordinator/manager

### Cross-entity linkage gaps

- Legacy work order type tracks `currentQuoteId` and `currentInvoiceId`, but the Phase 3 work order model does not.
- Quote and invoice lifecycle data must be fetched from separate systems rather than represented as durable state on the dashboard work order record.
- This makes list filtering, lifecycle badges, and queueing harder and more error-prone.

### Audit and timeline gaps

- Notes exist
- Attachments exist
- Activity logs exist

But:

- there is no unified persisted lifecycle event summary on the work order detail model
- activity is not surfaced in the internal dashboard detail UI
- notes are internal-only and do not replace a structured operational follow-up log

## 6. UX Gaps

- Work order list lacks lifecycle queue fidelity for coordinators, managers, and finance.
- Quote stage is reduced to “quote required” rather than actual workflow state.
- Finance stage is not represented in the primary work order status badge system.
- Internal detail page lacks an activity timeline despite an API existing.
- No role-specific inboxes such as:
  - awaiting contractor quote
  - awaiting manager quote review
  - awaiting client approval
  - approved quotes ready for coordinator dispatch
  - ready for invoicing
  - awaiting payment closeout
- No lifecycle map or breadcrumb showing where the job is in the full intake-to-closeout path.
- No explicit handoff UI between coordinator, manager, and finance roles.
- No visible hold/escalation reason model in the active dashboard lifecycle.

## 7. Risk Areas

### 1. Lifecycle inconsistency risk

The biggest risk is that work order status means different things in different subsystems.

- Dashboard routes use Phase 3 uppercase statuses.
- Quote and invoice services mutate legacy lowercase statuses.
- Rich lifecycle rules exist separately again.

Impact:

- lifecycle drift
- confusing UI
- brittle authorization
- hard-to-debug production issues

### 2. Authorization drift risk

Permissions are fairly strong server-side, but they are tied to multiple status models.

Impact:

- one route may allow or deny an action based on a different lifecycle interpretation than another route
- role expectations may be correct in one subsystem and wrong in another

### 3. Handoff gap risk

Coordinator -> Manager -> Coordinator -> Finance is the real business chain.

Current risk:

- handoffs are implicit rather than modeled
- approved quote return-to-coordinator is not a first-class workflow state
- finance readiness and payment closeout are not clearly expressed on the active work order lifecycle

### 4. Reporting and visibility risk

Without one authoritative lifecycle model, reporting on queue counts, cycle times, bottlenecks, and SLA aging will be unreliable.

### 5. Test coverage gap risk

Tests cover several isolated subsystems well, but not the full integrated lifecycle.

Current pattern:

- lifecycle library tests
- permission tests
- assignment workflow tests
- quote workflow service tests
- invoice service tests

Missing confidence:

- end-to-end lifecycle across work order + quote + invoice + role handoffs
- route-level integration proving the dashboard status and quote/invoice actions remain aligned

## 8. Recommended Lifecycle Redesign or Improvements

## Recommended direction

Adopt one authoritative work order lifecycle model across dashboard, quote, invoice, permissions, and tests.

Best candidate:

- the richer lifecycle model under `src/lib/workflows/lifecycle`

Why:

- It already maps much more closely to Pinnacle’s real operational flow.
- It cleanly separates intake, quoting, approval, scheduling, execution, completion, and exception states.
- It already has role-aware transition concepts.

## Recommended target lifecycle

Suggested authoritative work order lifecycle:

1. `NEW`
2. `TRIAGE`
3. `QUOTING_REQUIRED` or direct `APPROVED_TO_PROCEED` when no quote is needed
4. `AWAITING_QUOTE`
5. `QUOTE_RECEIVED`
6. `QUOTE_REVIEW`
7. `AWAITING_CLIENT_APPROVAL`
8. `APPROVED_TO_PROCEED`
9. `SCHEDULING`
10. `SCHEDULED`
11. `IN_PROGRESS`
12. `WORK_COMPLETED`
13. `QA_REVIEW` or coordinator completion review
14. `READY_FOR_INVOICING`
15. `INVOICED` or keep invoice detail as child status while work order remains finance-open
16. `PAYMENT_PENDING`
17. `COMPLETED` or `CLOSED`
18. exception states: `ON_HOLD`, `ESCALATED`, `CANCELLED`

If keeping work order statuses leaner is preferred, then:

- keep invoice-specific detail on the invoice entity
- but add explicit work order summary fields such as `invoiceSummaryStatus` and `quoteSummaryStatus`
- and add role queue states for the coordinator/manager handoffs

## Recommended role ownership mapping

- Coordinator:
  - `NEW` -> `TRIAGE`
  - `TRIAGE` -> `QUOTING_REQUIRED` or direct `APPROVED_TO_PROCEED`
  - `QUOTING_REQUIRED` -> `AWAITING_QUOTE`
  - `APPROVED_TO_PROCEED` -> `SCHEDULING`
  - `SCHEDULING` -> `SCHEDULED`
  - `IN_PROGRESS` -> `WORK_COMPLETED`
  - post-approval and post-completion follow-up ownership
- Manager:
  - `QUOTE_RECEIVED` -> `QUOTE_REVIEW`
  - `QUOTE_REVIEW` -> `AWAITING_CLIENT_APPROVAL`
  - approve/reject contractor quotes
  - create/send client quote
- Client:
  - approve/reject client quote
- Coordinator after client approval:
  - resume at `APPROVED_TO_PROCEED`
- Finance/Admin:
  - `READY_FOR_INVOICING` -> finance-open
  - invoicing, payment tracking, closeout
- Owner:
  - read/override across all valid transitions

## Recommended model changes

- Add canonical `lifecycleStatus` to the active work order record.
- Add `quoteSummaryStatus` and `invoiceSummaryStatus` to the work order record for fast list/detail rendering.
- Add `currentQuoteId` and `currentInvoiceId` to the active work order model.
- Add workflow timestamps:
  - `quoteRequestedAt`
  - `quoteReceivedAt`
  - `clientApprovalRequestedAt`
  - `clientApprovedAt`
  - `readyForInvoicingAt`
  - `invoiceSentAt`
  - `paidAt`
  - `closedAt`
- Add exception metadata:
  - `holdReason`
  - `escalationReason`
  - `previousLifecycleStatus`
- Add optional workflow owner fields if needed:
  - `financeOwnerUserId`
  - `quoteReviewerUserId`

## Recommended UX changes

- Replace the current coarse work order status badge with the canonical lifecycle status.
- Add queue views by role:
  - coordinator intake queue
  - awaiting contractor quote
  - awaiting manager quote review
  - awaiting client approval
  - approved and ready for dispatch
  - ready for invoicing
  - awaiting payment closeout
- Add internal activity timeline to work order detail.
- Show quote and invoice summaries directly in list and detail headers.
- Add explicit handoff indicators:
  - owned by coordinator
  - waiting on manager
  - waiting on client
  - waiting on finance

## 9. Implementation Phases Required

## Phase 1: Lifecycle decision and mapping

- Choose one authoritative lifecycle model.
- Map legacy lowercase statuses and Phase 3 uppercase statuses into that model.
- Define final role ownership for each transition.
- Freeze any new lifecycle work on the old split models.

Deliverables:

- canonical lifecycle spec
- transition matrix
- role/action matrix
- migration mapping table

## Phase 2: Data model unification

- Extend the active work order model with canonical lifecycle fields, quote linkage, invoice linkage, and summary state.
- Add migration-safe adapters from legacy records.
- Preserve backward compatibility during rollout.

Deliverables:

- unified work order schema
- repository updates
- read/write compatibility layer

## Phase 3: Service and authorization consolidation

- Move work order, quote, and invoice lifecycle reactions behind one consistent orchestration layer.
- Ensure all server-side authorization uses the same lifecycle vocabulary.
- Retire duplicate transition logic where possible.

Deliverables:

- unified transition/orchestration services
- consolidated permission checks
- reduced status-model duplication

## Phase 4: UI and queue redesign

- Update work order list to show canonical lifecycle state and role queues.
- Update detail page to show lifecycle timeline, quote summary, invoice summary, and handoff ownership.
- Add internal activity timeline panel.

Deliverables:

- coordinator queue UX
- manager review queue UX
- finance closeout queue UX
- improved owner oversight UX

## Phase 5: Migration and parity verification

- Migrate live work orders to canonical lifecycle state.
- Verify quote/invoice-linked work orders retain correct pointers and timestamps.
- Backfill reporting fields where needed.

Deliverables:

- migration scripts
- reconciliation checks
- audit report on migrated records

## Phase 6: Test hardening

- Add end-to-end tests for:
  - coordinator intake to dispatch
  - contractor quote submission
  - manager quote review
  - client approval and return to coordinator
  - completion to finance handoff
  - invoice send to payment closeout
  - owner override paths
- Add route-level integration tests proving list/detail/quote/invoice status consistency.

Deliverables:

- integrated lifecycle test suite
- cross-role regression coverage

## Test Coverage Assessment

Current coverage strengths:

- isolated lifecycle transition rules are tested
- assignment workflow rules are tested
- quote workflow service behavior is tested
- invoice service behavior is tested
- permissions are tested for both legacy and Phase 3 status sets

Current coverage gaps:

- no single end-to-end test proves the real Pinnacle workflow across coordinator, manager, finance, and owner roles
- no integrated test proves dashboard Phase 3 work order state stays synchronized with legacy quote and invoice state mutations
- no route/UI-level tests for role queues and lifecycle visibility

Overall assessment:

- good subsystem coverage
- insufficient end-to-end lifecycle coverage

## Final Assessment

How well does the platform currently support the real Pinnacle workflow?

- Intake and dispatch: partially supported
- Quote review and client quote flow: functionally supported, but not unified in the main work order lifecycle
- Approved quote return to coordinators: weakly supported and not modeled as a first-class handoff
- Finance invoicing and payment closeout: functionally supported, but lifecycle visibility is fragmented
- Owner visibility and override: mostly supported, but impaired by lifecycle fragmentation

Overall maturity rating:

- Moderate subsystem maturity
- Low-to-moderate end-to-end lifecycle cohesion

The highest-value next step is to unify the work order lifecycle around one canonical status model and make role handoffs first-class in both data and UI.

## Changed files

- `docs/audits/work-order-lifecycle-audit.md`

## Assumptions

- The dashboard Phase 3 work order routes are the current primary internal work order experience.
- Legacy quote and invoice services remain active in production because they are still wired to live APIs and UI panels.
- The richer lifecycle library is intended directionally, even though it is not yet the persisted dashboard lifecycle.

## Risks

- Some production behavior may depend on data not visible from code alone, especially around existing migrated records.
- If additional unpublished operational procedures exist outside the application, those may change the recommended target workflow design.

## Tests needed

- End-to-end lifecycle tests spanning work order, quote, assignment, invoice, and permissions
- Route integration tests validating lifecycle consistency across dashboard and workflow APIs
- Migration validation tests if lifecycle models are unified
