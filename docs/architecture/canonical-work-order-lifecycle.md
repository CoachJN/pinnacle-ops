# Canonical Work Order Lifecycle

Date: 2026-05-06

## 1. Executive summary

The current codebase does not have one authoritative work order lifecycle. It has three competing lifecycle systems:

1. An uppercase Phase 3 work order lifecycle used by `src/modules/work-orders/*`, `src/server/api/work-order-core.ts`, `src/server/services/work-order-core/*`, and several dashboard components.
2. A lowercase legacy lifecycle used by `src/types/work-order.ts`, `src/server/services/status-rules.ts`, `src/server/api/work-orders.ts`, `src/server/services/quote-workflow-service.ts`, `src/server/services/invoice-service.ts`, client portal flows, contractor portal flows, and mixed authorization rules.
3. A richer workflow-engine lifecycle in `src/lib/workflows/lifecycle/*` plus action gating, orchestration, SLA, and verification tests, but it is only partially wired into runtime persistence.

This split-brain architecture is the primary lifecycle conflict in the platform. Because this is a new app with no production migration constraint, the correct path is consolidation, not compatibility.

This document defines one canonical lifecycle vocabulary for future implementation:

- `new`
- `triage`
- `assigned`
- `awaiting_contractor_response`
- `quote_required`
- `contractor_quote_received`
- `quote_under_review`
- `client_approval_requested`
- `client_approved`
- `contractor_scheduled`
- `in_progress`
- `work_completed`
- `completion_review`
- `ready_for_invoicing`
- `invoiced`
- `paid`
- `closed`
- `on_hold`
- `escalated`
- `cancelled`

This lifecycle intentionally keeps quote detail, invoice detail, and assignment detail in dedicated summary fields instead of multiplying work-order status aliases.

## 2. Existing lifecycle/status audit summary

### 2.1 Work order lifecycle systems found

#### A. Uppercase Phase 3 runtime lifecycle

Primary files:

- `src/modules/work-orders/domain/constants.ts`
- `src/modules/work-orders/domain/transitions.ts`
- `src/modules/work-orders/domain/types.ts`
- `src/server/api/work-order-core.ts`
- `src/server/services/work-order-core/assignment-workflow.service.ts`
- `src/components/work-orders/list/work-order-status-badge.tsx`
- `src/components/work-orders/work-order-detail-header.tsx`
- `src/components/work-orders/work-order-finance-panel.tsx`
- `src/tests/work-order-core-domain.test.mts`
- `src/tests/work-order-core-services.test.mts`
- `src/tests/assignment-workflow.service.test.mts`

Statuses:

- `NEW`
- `OPEN`
- `ASSIGNED`
- `IN_PROGRESS`
- `COMPLETED`
- `READY_FOR_INVOICING`
- `CANCELLED`
- `CLOSED`

Assessment:

- Live runtime path.
- Too coarse for quote, approval, scheduling nuance, hold, escalation, and finance closeout.
- Uses uppercase constants that conflict with the broader app model.

#### B. Lowercase legacy runtime lifecycle

Primary files:

- `src/types/work-order.ts`
- `src/server/services/status-rules.ts`
- `src/server/api/work-orders.ts`
- `src/server/services/quote-workflow-service.ts`
- `src/server/services/invoice-service.ts`
- `src/modules/work-orders/contractor-portal.ts`
- `src/server/authorization/work-order.permissions.ts`
- `src/tests/quote-workflow-service.test.mts`
- `src/tests/invoice-service.test.mts`
- `src/tests/domain-services.test.mts`

Statuses found:

- `new`
- `draft`
- `submitted`
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
- `quoted`
- `approved`
- `completed`
- `ready_for_invoicing`
- `invoiced`
- `paid`
- `closed`
- `cancelled`

Assessment:

- Live runtime path for quote and invoice workflows.
- Closer to the real operating model than the uppercase path.
- Still mixes obsolete intake states, redundant approval vocabulary, and execution aliases.

#### C. Workflow engine lifecycle

Primary files:

- `src/lib/workflows/lifecycle/work-order-status.ts`
- `src/lib/workflows/lifecycle/work-order-transitions.ts`
- `src/lib/workflows/action-gating/work-order-actions.ts`
- `src/lib/workflows/rbac-transition/work-order-rules.ts`
- `src/lib/workflows/orchestration/rules/work-order-rules.ts`
- `src/lib/workflows/execution/*`
- `src/tests/action-gating.test.mts`
- `src/tests/rbac-transition.test.mts`
- `src/tests/workflow-orchestration.test.mts`
- `src/tests/transition-reactions.test.mts`

Statuses found:

- `NEW`
- `TRIAGE`
- `QUOTING_REQUIRED`
- `AWAITING_QUOTE`
- `QUOTE_RECEIVED`
- `QUOTE_REVIEW`
- `AWAITING_CLIENT_APPROVAL`
- `APPROVED_TO_PROCEED`
- `SCHEDULING`
- `SCHEDULED`
- `IN_PROGRESS`
- `WORK_COMPLETED`
- `QA_REVIEW`
- `READY_FOR_INVOICING`
- `COMPLETED`
- `ON_HOLD`
- `ESCALATED`
- `CANCELLED`

Assessment:

- Best conceptual fit for future automation, SLA, action gating, and orchestration.
- Not the persisted runtime source of truth.
- Still uppercase and not aligned with the required lowercase snake_case standard.

### 2.2 Assignment statuses found

Files:

- `src/types/work-order.ts`
- `src/modules/work-orders/domain/constants.ts`
- `src/modules/work-orders/domain/assignment-rules.ts`

Statuses:

- `assigned`
- `accepted`
- `declined`
- `completed`
- `cancelled`

Assessment:

- Reasonable separate sub-lifecycle.
- Must remain distinct from the primary work order lifecycle.

### 2.3 Quote statuses found

Files:

- `src/types/quote.ts`
- `src/lib/quotes/status.ts`
- `src/server/services/quote-workflow-service.ts`

Statuses found across quote models:

- Generic quote: `draft`, `submitted`, `under_review`, `ready_for_client`, `client_approved`, `client_rejected`, `superseded`
- Contractor quote: `draft`, `submitted`, `under_review`, `accepted`, `rejected`, `expired`, `cancelled`
- Client quote: `draft`, `sent`, `approved`, `rejected`, `expired`, `cancelled`

Assessment:

- Separate contractor and client quote models are still active.
- Work order lifecycle should summarize quote position rather than duplicate every quote status.

### 2.4 Invoice statuses found

Files:

- `src/types/invoice.ts`
- `src/modules/finance/domain/invoice-rules.ts`
- `src/server/services/invoice-service.ts`

Statuses found across invoice models:

- Client invoice: `draft`, `issued`, `sent`, `viewed`, `overdue`, `disputed`, `resolved`, `paid`, `void`, `cancelled`
- Contractor invoice: `draft`, `submitted`, `approved`, `rejected`, `paid`, `cancelled`

Assessment:

- Invoice detail lifecycle is richer than work-order finance lifecycle.
- The work order should summarize finance progression through `ready_for_invoicing`, `invoiced`, `paid`, and `closed`, while invoice detail remains on the invoice record.

### 2.5 Authorization/status coupling found

Primary mixed-status authorization file:

- `src/server/authorization/work-order.permissions.ts`

Observed issue:

- It unions `LegacyWorkOrderStatus | PhaseThreeWorkOrderStatus`.
- It grants status permissions across mixed lowercase and uppercase targets in one policy surface.

Assessment:

- This is an explicit duplicate authorization path and must be removed in Phase 2.

## 3. Identified duplicate/deprecated lifecycle paths

### 3.1 Duplicate paths

1. Uppercase Phase 3 work order lifecycle vs lowercase legacy lifecycle.
2. Runtime lifecycle vs workflow-engine lifecycle.
3. Work-order lifecycle states trying to encode assignment, quote, approval, and finance detail all at once.
4. Authorization rules that accept both uppercase and lowercase work-order statuses.
5. UI filters and badges that depend on different lifecycle vocabularies per surface.

### 3.2 Deprecated or redundant statuses

These should not survive the canonical model:

- `OPEN`
  Reason: vague operational meaning; replaced by `triage` or `assigned`.
- `draft`
  Reason: this is quote/invoice vocabulary, not work-order lifecycle vocabulary.
- `submitted`
  Reason: intake submission detail belongs to events and timestamps, not persisted lifecycle.
- `in_review`
  Reason: ambiguous; split into `triage`, `quote_under_review`, or `completion_review`.
- `quote_requested`
  Reason: replaced by `quote_required`.
- `quote_received`
  Reason: replaced by `contractor_quote_received`.
- `pending_client_approval`
  Reason: replaced by `client_approval_requested`.
- `approved_to_proceed`
  Reason: replaced by `client_approved`.
- `dispatched`
  Reason: dispatch is an action/event, not a distinct long-lived lifecycle state.
- `scheduled`
  Reason: replaced by `contractor_scheduled`.
- `waiting_on_contractor`
  Reason: duplicated by `awaiting_contractor_response` or `on_hold` with reason.
- `waiting_on_customer`
  Reason: duplicated by `client_approval_requested` or `on_hold` with reason.
- `quoted`
  Reason: redundant with quote summary statuses.
- `approved`
  Reason: ambiguous; replaced by `client_approved` or quote-specific approval fields.
- `WORK_COMPLETED` and `QA_REVIEW`
  Reason: keep the concepts but normalize to `work_completed` and `completion_review`.
- `COMPLETED`
  Reason: too overloaded; use `closed` as the true terminal operational closeout state and keep `paid` as pre-close finance complete.

## 4. Final canonical lifecycle vocabulary

### 4.1 Canonical statuses

1. `new`
2. `triage`
3. `assigned`
4. `awaiting_contractor_response`
5. `quote_required`
6. `contractor_quote_received`
7. `quote_under_review`
8. `client_approval_requested`
9. `client_approved`
10. `contractor_scheduled`
11. `in_progress`
12. `work_completed`
13. `completion_review`
14. `ready_for_invoicing`
15. `invoiced`
16. `paid`
17. `closed`
18. `on_hold`
19. `escalated`
20. `cancelled`

### 4.2 Why these statuses were selected

- They cover the real Pinnacle operating path from intake to payment closeout.
- They separate primary lifecycle state from quote, assignment, and invoice detail.
- They support clear next-actor ownership.
- They support future SLA automation and AI recommendations.
- They use lowercase snake_case only.

### 4.3 Statuses intentionally not included

- No `contractor_quote_requested` alias: `quote_required` already means quote is required and outstanding.
- No `invoice_sent` work-order status: invoice detail stays on `invoiceSummaryStatus`.
- No `waiting_on_customer` or `waiting_on_contractor` lifecycle states: these become structured reasons on `on_hold`, `escalated`, or the quote/approval states.
- No uppercase aliases.

## 5. Status definitions

| Status | Definition | Expected next actor | Terminal |
| --- | --- | --- | --- |
| `new` | Intake captured but not yet operationally triaged. | Coordinator | No |
| `triage` | Internal review of scope, urgency, routing, and quote requirement. | Coordinator or Manager | No |
| `assigned` | Internal owner and intended contractor/internal resource selected. | Coordinator | No |
| `awaiting_contractor_response` | Assignment sent and awaiting accept/decline or availability response. | Contractor Admin or Contractor Technician | No |
| `quote_required` | Quote is required before work can proceed. | Contractor Admin or Contractor Technician | No |
| `contractor_quote_received` | Contractor quote received and awaiting managerial intake. | Manager | No |
| `quote_under_review` | Internal review/comparison of quote is in progress. | Manager | No |
| `client_approval_requested` | Client-facing approval request is outstanding. | Client Head Office or Client Store | No |
| `client_approved` | Client approved scope/cost and work is cleared to proceed. | Coordinator | No |
| `contractor_scheduled` | Contractor schedule/time window is confirmed. | Contractor Technician | No |
| `in_progress` | Work is actively being performed. | Contractor Technician | No |
| `work_completed` | Contractor marked work complete; awaiting internal verification. | Coordinator | No |
| `completion_review` | Internal completion/quality/compliance review in progress. | Manager or Coordinator | No |
| `ready_for_invoicing` | Operational work is complete and finance packet is ready. | Finance/Admin | No |
| `invoiced` | Client invoice has been sent or is actively in collections workflow. | Finance/Admin or Client Head Office | No |
| `paid` | Payment received and finance obligations are satisfied; awaiting final closeout. | Finance/Admin | No |
| `closed` | Entire work order is fully complete with no remaining operational or finance actions. | None | Yes |
| `on_hold` | Work is intentionally paused with an explicit reason and resume owner. | Varies by `nextActionOwnerType` | No |
| `escalated` | Human escalation is required due to risk, SLA, cost, uncertainty, or relationship sensitivity. | Owner, Manager, or designated escalation owner | No |
| `cancelled` | Work order is terminated and will not continue. | None | Yes |

## 6. Status grouping by operational phase

| Phase | Statuses |
| --- | --- |
| Intake | `new`, `triage` |
| Dispatch and contractor coordination | `assigned`, `awaiting_contractor_response`, `contractor_scheduled` |
| Quote and approval | `quote_required`, `contractor_quote_received`, `quote_under_review`, `client_approval_requested`, `client_approved` |
| Execution | `in_progress`, `work_completed` |
| Completion and finance | `completion_review`, `ready_for_invoicing`, `invoiced`, `paid`, `closed` |
| Exception | `on_hold`, `escalated`, `cancelled` |

## 7. Allowed transition matrix

### 7.1 Primary forward transitions

| From | Allowed to |
| --- | --- |
| `new` | `triage`, `cancelled` |
| `triage` | `assigned`, `quote_required`, `on_hold`, `escalated`, `cancelled` |
| `assigned` | `awaiting_contractor_response`, `quote_required`, `contractor_scheduled`, `on_hold`, `escalated`, `cancelled` |
| `awaiting_contractor_response` | `assigned`, `quote_required`, `contractor_scheduled`, `on_hold`, `escalated`, `cancelled` |
| `quote_required` | `contractor_quote_received`, `on_hold`, `escalated`, `cancelled` |
| `contractor_quote_received` | `quote_under_review`, `on_hold`, `escalated`, `cancelled` |
| `quote_under_review` | `client_approval_requested`, `quote_required`, `on_hold`, `escalated`, `cancelled` |
| `client_approval_requested` | `client_approved`, `quote_required`, `on_hold`, `escalated`, `cancelled` |
| `client_approved` | `assigned`, `contractor_scheduled`, `on_hold`, `escalated`, `cancelled` |
| `contractor_scheduled` | `in_progress`, `on_hold`, `escalated`, `cancelled` |
| `in_progress` | `work_completed`, `on_hold`, `escalated`, `cancelled` |
| `work_completed` | `completion_review`, `on_hold`, `escalated` |
| `completion_review` | `ready_for_invoicing`, `assigned`, `on_hold`, `escalated` |
| `ready_for_invoicing` | `invoiced`, `on_hold`, `escalated` |
| `invoiced` | `ready_for_invoicing`, `paid`, `on_hold`, `escalated` |
| `paid` | `closed` |
| `closed` | none |
| `on_hold` | `previousLifecycleStatus`, `escalated`, `cancelled` |
| `escalated` | `previousLifecycleStatus`, `on_hold`, `cancelled` |
| `cancelled` | none |

### 7.2 Transition rules

1. `on_hold` and `escalated` are exception overlays with required reason metadata.
2. `previousLifecycleStatus` must be captured whenever entering `on_hold` or `escalated`.
3. `cancelled` is terminal and must not transition back to active work.
4. `closed` is terminal and must require finance and operational completeness.
5. `paid` is not terminal because final closeout, audit completion, and possible contractor-side reconciliations may still remain.
6. `invoiced -> ready_for_invoicing` is allowed only when the active invoice is voided or replaced.
7. `completion_review -> assigned` is the only approved operational re-open path for rework.

## 8. Role/action ownership matrix

| Status | Primary owner | Secondary actors | High-risk actions requiring human approval |
| --- | --- | --- | --- |
| `new` | Coordinator | Client Store, AI intake support | triage override, cancellation |
| `triage` | Coordinator | Manager | quote requirement decision, escalation, cancellation |
| `assigned` | Coordinator | Manager | assignment/reassignment, contractor selection |
| `awaiting_contractor_response` | Coordinator | Contractor Admin | reassignment, escalation |
| `quote_required` | Coordinator | Contractor Admin, Contractor Technician | quote request cancellation, contractor change |
| `contractor_quote_received` | Manager | Coordinator | quote acceptance routing |
| `quote_under_review` | Manager | Owner | spend recommendation, approval routing |
| `client_approval_requested` | Client Head Office | Client Store, Manager | client approval/rejection |
| `client_approved` | Coordinator | Manager | proceed without updated schedule |
| `contractor_scheduled` | Coordinator | Contractor Admin, Contractor Technician | schedule override, urgent reschedule |
| `in_progress` | Contractor Technician | Coordinator | cancellation, emergency escalation |
| `work_completed` | Coordinator | Contractor Technician | completion acceptance |
| `completion_review` | Manager | Coordinator | rework decision, finance release |
| `ready_for_invoicing` | Finance/Admin | Manager | invoice packet release |
| `invoiced` | Finance/Admin | Client Head Office | payment posting, void/reissue |
| `paid` | Finance/Admin | Owner | closeout release |
| `closed` | None | Owner for audit only | reopen is disallowed in canonical path |
| `on_hold` | Role stored in `nextActionOwnerType` | Owner, Manager | resume, cancellation |
| `escalated` | Owner or Manager | Coordinator, Finance/Admin | escalation resolution |
| `cancelled` | None | Owner for audit only | reopen is disallowed |

### 8.1 Actor responsibilities by role

- `Owner`: override approvals, escalation resolution, cross-functional conflict resolution, final policy exception authority.
- `Manager`: quote review, completion review, high-cost or sensitive approval decisions.
- `Coordinator`: intake, triage, assignment, dispatch, follow-up, scheduling coordination, completion intake.
- `Finance/Admin`: invoice release, collections progression, payment confirmation, closeout readiness.
- `Client Head Office`: financial and formal client approvals.
- `Client Store`: local operational confirmation and limited approval where contractually allowed.
- `Contractor Admin`: assignment acceptance, schedule coordination, quote submission.
- `Contractor Technician`: execution updates, arrival, work completion updates.

## 9. AI automation eligibility matrix

| Status | AI may do autonomously | AI may draft/recommend | Human review required before state change |
| --- | --- | --- | --- |
| `new` | intake summarization only | classification, duplicate detection, urgency recommendation | Yes |
| `triage` | none | routing, quote-needed recommendation, risk flags | Yes |
| `assigned` | reminder drafting only | contractor recommendation, reassignment suggestion | Yes |
| `awaiting_contractor_response` | follow-up reminders if policy-approved | stale-response escalation recommendation | Yes |
| `quote_required` | follow-up reminders if policy-approved | quote packet draft, contractor comparison context | Yes |
| `contractor_quote_received` | none | quote summarization, anomaly detection | Yes |
| `quote_under_review` | none | cost comparison, contract variance review, approval memo draft | Yes |
| `client_approval_requested` | reminder drafting only | approval summary, decision-risk summary | Yes |
| `client_approved` | none | scheduling recommendation | Yes |
| `contractor_scheduled` | reminder drafting only | schedule conflict detection | Yes |
| `in_progress` | status digesting only | delay prediction, parts-risk prediction | Yes |
| `work_completed` | none | completion summary, missing-proof detection | Yes |
| `completion_review` | none | review checklist generation, reopen recommendation | Yes |
| `ready_for_invoicing` | draft invoice packet assembly | missing-doc detection, billing summary | Yes |
| `invoiced` | reminder drafting only | collections prioritization, dispute risk detection | Yes |
| `paid` | reconciliation summary only | closeout readiness recommendation | Yes |
| `closed` | archival summary only | postmortem insight generation | No state changes allowed |
| `on_hold` | SLA reminder drafting only | hold reason normalization, resume recommendation | Yes |
| `escalated` | none | escalation summary and option set | Yes |
| `cancelled` | archival summary only | cancellation trend analysis | No state changes allowed |

### 9.1 Automation-safe state changes

The following are acceptable as system-safe, not AI-discretionary, transitions when triggered by verified events:

- `quote_required -> contractor_quote_received` upon persisted contractor quote submission.
- `client_approval_requested -> client_approved` upon authenticated client approval.
- `invoiced -> paid` upon verified finance payment posting.
- Entry into `escalated` from any non-terminal state on SLA breach, but only as escalation, not autonomous resolution.

All other lifecycle changes require human review.

### 9.2 Mandatory human escalation triggers

AI must route to human review when any of the following are true:

- emergency or safety issue
- high-cost work
- unclear scope
- duplicate-risk or conflicting open work
- contract/SLA ambiguity
- client relationship sensitivity
- contractor dispute
- payment dispute
- missing compliance evidence

## 10. SLA behavior by status

| Status | SLA behavior |
| --- | --- |
| `new` | Active: intake acknowledgment and triage-start timers |
| `triage` | Active: triage/dispatch decision timer |
| `assigned` | Active: assignment dispatch timer |
| `awaiting_contractor_response` | Active: contractor response timer |
| `quote_required` | Active: quote turnaround timer |
| `contractor_quote_received` | Active: manager review-start timer |
| `quote_under_review` | Active: quote review completion timer |
| `client_approval_requested` | Active: client approval response timer |
| `client_approved` | Active: scheduling commitment timer |
| `contractor_scheduled` | Active: arrival/start timer |
| `in_progress` | Active: repair completion timer |
| `work_completed` | Active: completion proof submission timer |
| `completion_review` | Active: internal QA/release timer |
| `ready_for_invoicing` | Active: invoice creation/send timer |
| `invoiced` | Active: payment and collections timer |
| `paid` | Active: finance closeout timer |
| `closed` | Stopped |
| `on_hold` | Paused, except hold-age monitoring |
| `escalated` | Escalated with breach-handling timers active |
| `cancelled` | Stopped |

## 11. Communication expectations by status

| Status | External communication expected | Primary communication audience |
| --- | --- | --- |
| `new` | Optional acknowledgment | Requester/client |
| `triage` | Internal only unless clarification is needed | Internal ops |
| `assigned` | Usually yes | Contractor Admin |
| `awaiting_contractor_response` | Yes | Contractor Admin or Contractor Technician |
| `quote_required` | Yes | Contractor Admin or Contractor Technician |
| `contractor_quote_received` | Internal only | Manager |
| `quote_under_review` | Internal only | Manager/Owner |
| `client_approval_requested` | Yes | Client Head Office or Client Store |
| `client_approved` | Internal confirmation plus optional client acknowledgment | Coordinator and client |
| `contractor_scheduled` | Yes | Contractor and client location |
| `in_progress` | Conditional updates | Client location and coordinator |
| `work_completed` | Internal completion notice; client notice optional | Coordinator and manager |
| `completion_review` | Internal only unless follow-up is needed | Internal ops |
| `ready_for_invoicing` | Internal only | Finance/Admin |
| `invoiced` | Yes | Client billing contact |
| `paid` | Optional receipt/confirmation | Client billing contact |
| `closed` | Optional closeout summary | Client and internal archive |
| `on_hold` | Usually yes | Impacted stakeholder(s) |
| `escalated` | Internal mandatory, external conditional | Escalation owner plus impacted parties |
| `cancelled` | Yes | Requester, client, contractor if assigned |

## 12. Quote lifecycle interaction

### 12.1 Canonical work-order to quote interaction

- `quote_required` means the work order cannot proceed without a quote.
- Contractor quote submission moves the work order to `contractor_quote_received`.
- Internal intake of that quote moves the work order to `quote_under_review`.
- Sending a client-facing quote moves the work order to `client_approval_requested`.
- Client approval moves the work order to `client_approved`.
- Client rejection or manager-requested revision returns the work order to `quote_required`.

### 12.2 Quote detail should not be duplicated into lifecycle status

The work order lifecycle must not embed these as lifecycle statuses:

- quote draft
- quote accepted/rejected
- quote expired
- client quote sent/rejected

Those belong in `quoteSummaryStatus` and quote records.

## 13. Invoice lifecycle interaction

### 13.1 Canonical work-order to invoice interaction

- `ready_for_invoicing` means operations has released the work order to finance.
- Sending the client invoice moves the work order to `invoiced`.
- Verified payment moves the work order to `paid`.
- Finance closeout moves the work order to `closed`.

### 13.2 Invoice detail stays in invoice summary fields

Work order lifecycle must not add separate statuses for:

- draft invoice
- viewed invoice
- overdue invoice
- disputed invoice
- resolved invoice
- void invoice

Those belong in `invoiceSummaryStatus` and invoice records.

### 13.3 Void/reissue rule

If the active invoice is voided and no replacement has been sent, the work order returns from `invoiced` to `ready_for_invoicing`.

## 14. Assignment/dispatch lifecycle interaction

### 14.1 Canonical interaction

- `assigned` means Pinnacle has chosen the internal operational owner and intended fulfillment path.
- `assignmentStatus` tracks assignment acceptance detail independently.
- `awaiting_contractor_response` is the work-order-level signal that fulfillment is blocked on contractor response.
- `contractor_scheduled` is the work-order-level signal that the visit is confirmed.
- `assignedContractorOrgId`, `assignedContractorContactId`, and assignment records remain the detailed source.

### 14.2 Assignment status should remain separate

Recommended `assignmentStatus` vocabulary:

- `unassigned`
- `pending_acceptance`
- `accepted`
- `declined`
- `scheduled`
- `completed`
- `cancelled`

This is separate from `lifecycleStatus`.

## 15. Terminal state rules

### 15.1 Terminal lifecycle states

- `closed`
- `cancelled`

### 15.2 Terminal rules

- No notes/attachments/assignment/quote/invoice mutations should advance lifecycle after `closed` or `cancelled`.
- `closed` requires:
  - operational completion accepted
  - invoice obligations settled or explicitly not required
  - payment confirmed where invoicing applied
  - audit trail intact
- `cancelled` requires:
  - cancellation reason
  - actor attribution
  - timestamps
  - downstream communication handling

## 16. Hold/escalation rules

### 16.1 `on_hold`

Use when work is intentionally paused for a known reason without yet requiring executive intervention.

Required fields:

- `holdReason`
- `previousLifecycleStatus`
- `nextActionOwnerType`
- `nextActionDueAt`
- `holdStartedAt`

### 16.2 `escalated`

Use when risk or uncertainty requires human intervention above the current owner.

Required fields:

- `isEscalated`
- `escalationReason`
- `previousLifecycleStatus`
- `escalatedAt`
- `nextActionOwnerType`
- `nextActionDueAt`

### 16.3 Resume rules

- Resume must return only to `previousLifecycleStatus`.
- Resume cannot bypass missing approvals, quote requirements, or finance controls.

## 17. Required WorkOrder schema fields

| Field | Purpose |
| --- | --- |
| `lifecycleStatus` | Authoritative canonical status |
| `assignmentStatus` | Assignment summary state separate from lifecycle |
| `quoteSummaryStatus` | Current quote position summary |
| `invoiceSummaryStatus` | Current invoice/collections summary |
| `approvalStatus` | Approval summary independent from quote detail |
| `currentQuoteId` | Active quote reference |
| `currentInvoiceId` | Active invoice reference |
| `assignedCoordinatorUserId` | Operational owner |
| `assignedManagerUserId` | Approval/review owner |
| `assignedContractorOrgId` | Fulfillment organization |
| `assignedContractorContactId` | Dispatch contact/lead tech |
| `financeOwnerUserId` | Finance closeout owner |
| `quoteReviewerUserId` | Current quote reviewer |
| `lastActivityAt` | Queue freshness and SLA anchor |
| `nextActionOwnerType` | Next accountable actor class |
| `nextActionDueAt` | SLA/action deadline |
| `isEscalated` | Escalation summary flag |
| `escalationReason` | Escalation context |
| `holdReason` | Hold context |
| `previousLifecycleStatus` | Resume source after hold/escalation |

### 17.1 Recommended enum values

- `nextActionOwnerType`: `owner`, `manager`, `coordinator`, `finance_admin`, `client_head_office`, `client_store`, `contractor_admin`, `contractor_technician`, `system`
- `approvalStatus`: `not_required`, `pending_internal_review`, `pending_client_approval`, `approved`, `rejected`

## 18. Required Quote summary fields on WorkOrder

| Field | Purpose |
| --- | --- |
| `quoteSummaryStatus` | Queue-friendly quote state |
| `currentQuoteId` | Active quote pointer |
| `currentQuoteVersionNumber` | Latest quote revision number |
| `quoteRequired` | Fast policy check |
| `quoteRequestedAt` | Quote SLA anchor |
| `contractorQuoteReceivedAt` | Review SLA anchor |
| `quoteReviewStartedAt` | Manager review SLA anchor |
| `clientApprovalRequestedAt` | Client approval SLA anchor |
| `clientApprovedAt` | Proceed authorization timestamp |
| `quoteSubtotalAmount` | Summary reporting |
| `quoteTaxAmount` | Summary reporting |
| `quoteTotalAmount` | Approval and billing context |
| `quoteCurrency` | Multi-tenant currency support |
| `quoteRejectedReason` | Revision context |

Recommended `quoteSummaryStatus` values:

- `not_required`
- `required`
- `awaiting_contractor_quote`
- `received`
- `under_review`
- `client_approval_requested`
- `client_approved`
- `rejected`
- `superseded`

## 19. Required Invoice summary fields on WorkOrder

| Field | Purpose |
| --- | --- |
| `invoiceSummaryStatus` | Queue-friendly finance state |
| `currentInvoiceId` | Active invoice pointer |
| `invoiceNumber` | Human-readable reference |
| `invoiceSentAt` | Collections SLA anchor |
| `invoiceDueAt` | Aging and overdue logic |
| `paidAt` | Payment confirmation |
| `invoiceSubtotalAmount` | Summary reporting |
| `invoiceTaxAmount` | Summary reporting |
| `invoiceTotalAmount` | Collections and revenue reporting |
| `invoiceCurrency` | Multi-tenant currency support |
| `paymentReference` | Reconciliation |
| `invoiceDisputeFlag` | Visibility into blocked collections |

Recommended `invoiceSummaryStatus` values:

- `not_ready`
- `ready`
- `draft`
- `sent`
- `viewed`
- `overdue`
- `disputed`
- `resolved`
- `paid`
- `void`

## 20. Required timestamps

Required lifecycle timestamps:

- `intakeReceivedAt`
- `triagedAt`
- `assignedAt`
- `contractorContactedAt`
- `contractorRespondedAt`
- `contractorScheduledAt`
- `workStartedAt`
- `quoteRequestedAt`
- `contractorQuoteReceivedAt`
- `quoteReviewStartedAt`
- `clientApprovalRequestedAt`
- `clientApprovedAt`
- `workCompletedAt`
- `completionReviewStartedAt`
- `readyForInvoicingAt`
- `invoiceSentAt`
- `paidAt`
- `closedAt`
- `cancelledAt`
- `holdStartedAt`
- `escalatedAt`

Additional recommended operational timestamps:

- `lastActivityAt`
- `nextActionDueAt`
- `lastExternalCommunicationAt`

## 21. Required audit/event records

Minimum required event types:

- `work_order_created`
- `work_order_triaged`
- `work_order_assigned`
- `contractor_contacted`
- `assignment_response_received`
- `quote_requested`
- `contractor_quote_received`
- `quote_review_started`
- `client_approval_requested`
- `client_approved`
- `client_rejected`
- `contractor_scheduled`
- `work_started`
- `work_completed`
- `completion_review_started`
- `rework_requested`
- `ready_for_invoicing`
- `invoice_sent`
- `invoice_voided`
- `payment_recorded`
- `work_order_closed`
- `work_order_cancelled`
- `work_order_placed_on_hold`
- `work_order_resumed`
- `work_order_escalated`
- `work_order_deescalated`

Each event record should include:

- work order id
- organization id / tenant id
- actor id
- actor type
- actor role
- from status
- to status
- timestamp
- visibility
- reason code
- human-readable message
- structured metadata payload

## 22. Removal map for deprecated statuses and old flows

| Current artifact | Current problem | Phase action |
| --- | --- | --- |
| `src/modules/work-orders/domain/constants.ts` | Uppercase lifecycle duplicates runtime model | Delete Phase 3 status vocabulary after migration |
| `src/modules/work-orders/domain/transitions.ts` | Parallel transition map | Delete after canonical transition service replaces it |
| `src/modules/work-orders/domain/types.ts` | Uppercase work-order type surface | Replace with canonical lowercase types |
| `src/server/api/work-order-core.ts` | Separate uppercase API stack | Retire and fold into canonical work-order API |
| `src/server/services/work-order-core/*` | Separate service path for status/assignment actions | Consolidate into canonical service layer |
| `src/server/services/status-rules.ts` | Legacy lowercase map includes deprecated statuses | Replace with canonical map |
| `src/types/work-order.ts` | Legacy status union includes deprecated states | Rewrite to canonical fields and statuses |
| `src/server/authorization/work-order.permissions.ts` | Mixed uppercase/lowercase permission logic | Rewrite to one canonical permission matrix |
| `src/server/api/work-orders.ts` | Hard-coded legacy status allowlists | Rewrite around canonical vocabulary |
| `src/server/services/quote-workflow-service.ts` | Mutates legacy work-order statuses | Rebind to canonical lifecycle transitions |
| `src/server/services/invoice-service.ts` | Mutates legacy work-order finance statuses | Rebind to canonical lifecycle transitions |
| `src/modules/work-orders/contractor-portal.ts` | Filters/actions depend on deprecated statuses | Replace with canonical contractor queue logic |
| `src/app/(contractor)/contractor/work-orders/page.tsx` | Portal filters use deprecated status names | Rewrite filters |
| `src/app/(contractor)/contractor/dashboard/page.tsx` | Summary widgets use deprecated workflow assumptions | Rewrite summaries |
| `src/components/work-orders/work-order-finance-panel.tsx` | Maps uppercase status model into lowercase finance states | Remove bridge logic |
| `src/components/work-orders/list/work-order-status-badge.tsx` | Uppercase badge model | Replace |
| `src/components/work-orders/work-order-detail-header.tsx` | Uppercase transitions in UI | Replace |
| `src/lib/workflows/lifecycle/*` | Best conceptual model, wrong case and slightly different vocabulary | Reuse semantics, rename to canonical lowercase, delete redundant statuses |
| `src/lib/workflows/transition-service/apply-quote-transition.ts` | Explicit unsupported runtime path | Implement canonical quote runtime or remove dead path |
| `src/tests/work-order-core-*.test.mts` | Encodes uppercase lifecycle | Rewrite or delete with Phase 3 removal |
| `src/tests/assignment-workflow.service.test.mts` | Encodes uppercase assignment-linked transitions | Rewrite to canonical lifecycle |
| `src/tests/quote-workflow-service.test.mts` | Encodes legacy work-order status reactions | Update to canonical work-order reactions |
| `src/tests/invoice-service.test.mts` | Encodes legacy finance reactions | Update to canonical finance lifecycle |
| `src/tests/action-gating.test.mts`, `src/tests/rbac-transition.test.mts`, `src/tests/workflow-*.test.mts` | Use workflow-engine statuses that partly overlap but do not match canonical names | Normalize and keep only one lifecycle engine |

## 23. Files likely impacted in future phases

### 23.1 Types and domain

- `src/types/work-order.ts`
- `src/types/quote.ts`
- `src/types/invoice.ts`
- `src/modules/work-orders/domain/*`
- `src/lib/workflows/lifecycle/*`
- `src/lib/workflows/action-gating/*`
- `src/lib/workflows/rbac-transition/*`

### 23.2 Service and repository layer

- `src/server/services/work-order-service.ts`
- `src/server/services/status-rules.ts`
- `src/server/services/quote-workflow-service.ts`
- `src/server/services/invoice-service.ts`
- `src/server/services/work-order-core/*`
- `src/server/repositories/firestore/models.ts`
- `src/server/repositories/firestore/mappers.ts`
- `src/server/repositories/firestore/repositories.ts`

### 23.3 API layer

- `src/server/api/work-orders.ts`
- `src/server/api/work-order-core.ts`
- `src/app/api/work-orders/[workOrderId]/status/route.ts`
- `src/app/api/work-orders/[workOrderId]/assignments/*`
- `src/app/api/work-orders/[workOrderId]/quote-workflow/route.ts`

### 23.4 UI and portal surfaces

- `src/components/work-orders/*`
- `src/components/dashboard/*`
- `src/components/contractor-portal/*`
- `src/app/(contractor)/contractor/*`
- `src/app/(client)/portal/work-orders/*`

### 23.5 Authorization and visibility

- `src/server/authorization/work-order.permissions.ts`
- `src/server/authorization/actions.ts`
- `src/server/authorization/capabilities.ts`
- `src/server/authorization/visibility.ts`

### 23.6 Tests

- `src/tests/work-order-core-*.test.mts`
- `src/tests/assignment-workflow.service.test.mts`
- `src/tests/quote-workflow-service.test.mts`
- `src/tests/invoice-service.test.mts`
- `src/tests/action-gating.test.mts`
- `src/tests/rbac-transition.test.mts`
- `src/tests/workflow-*.test.mts`
- `src/tests/server-authorization.test.mts`
- `src/tests/domain-services.test.mts`

## 24. Testing strategy for lifecycle enforcement

### 24.1 Required test layers

1. Domain transition tests
   - one canonical transition map only
   - no uppercase aliases
   - no deprecated status acceptance
2. Authorization tests
   - role-by-role action checks by canonical status
   - no duplicate permission matrices
3. Service integration tests
   - quote workflow updates canonical work-order status correctly
   - invoice workflow updates canonical work-order status correctly
   - hold/escalation rules enforce metadata requirements
4. API contract tests
   - reject deprecated statuses at boundaries
   - validate required reasons and timestamps
5. UI tests
   - filters, badges, and actions match canonical statuses only
6. Workflow-engine tests
   - action gating, SLA timers, orchestration, and reactions all use the same lifecycle vocabulary

### 24.2 Deletion-oriented test rules

- Remove tests that preserve uppercase or deprecated lifecycle models.
- Do not maintain compatibility fixtures for old statuses.
- Add explicit regression tests proving that deprecated statuses are rejected.

## 25. Recommended next phase

### Phase 2 recommendation

Implement canonical lifecycle consolidation in code:

1. Replace all work-order status definitions with the canonical lowercase vocabulary.
2. Remove the uppercase Phase 3 lifecycle and its duplicate API/service path.
3. Normalize the workflow engine to the same canonical vocabulary.
4. Rewrite authorization to one canonical matrix.
5. Rebind quote and invoice services to canonical work-order transitions.
6. Update dashboard, contractor portal, client portal, and finance UI filters/badges/actions.
7. Add schema fields, timestamps, and audit/event coverage defined in this document.
8. Delete deprecated tests and add canonical lifecycle enforcement coverage.

### Phase 2 implementation order

1. Types and repository schema
2. Domain transition and authorization layer
3. Quote and assignment integration
4. Invoice and finance integration
5. UI and portal alignment
6. Workflow engine and SLA/orchestration normalization
7. Final deletion of obsolete paths

