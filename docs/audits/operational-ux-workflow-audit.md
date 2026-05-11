# Operational UX & Workflow Audit

Date: 2026-05-07

## Scope

This audit reviews the current operational UX across:

- intake review flows
- internal dashboard queues
- work-order detail workflow surfaces
- finance queue UX
- client portal work-order and quote flows
- contractor operational flows
- communication rendering
- timeline rendering
- duplicate review and merge UX
- escalation visibility
- navigation and discoverability

The review is based on the current implementation in:

- `src/components/intake/intake-review-page.tsx`
- `src/app/(app)/dashboard/intake/page.tsx`
- `src/components/dashboard/*`
- `src/modules/dashboard/server/build-dashboard.ts`
- `src/components/work-orders/*`
- `src/components/invoices/*`
- `src/app/(client)/portal/*`
- `src/app/(contractor)/contractor/*`
- `src/modules/clients/server/client-portal.ts`
- `src/modules/contractors/server/contractor-portal.ts`
- `src/server/services/intake-service.ts`
- `src/lib/navigation/nav-config.ts`

## 1. Operational UX assessment

The platform has good foundational separation of internal, client, and contractor experiences, and most operational pages are readable at low volume. The main weakness is that the UX surfaces are thinner than the underlying operational model.

The backend already carries richer queue metadata, canonical communications, duplicate evidence, timeline history, escalation state, and role-scoped routing. The UI often reduces that into simple cards, isolated forms, or separate pages. This creates a gap between what the system knows and what operators can act on quickly.

Overall assessment:

- Coordinator efficiency: medium
- Reviewer efficiency: low-to-medium
- Operational clarity: medium
- Queue usability: medium at low volume, low at scale
- Timeline usability: low internally, medium externally
- Communication clarity: medium externally, low internally
- Scalability of UX: low-to-medium without stronger queue tooling

## 2. Queue/workflow assessment

### Strengths

- Internal dashboard sections are intentionally organized around operational intent: dispatch attention, quote bottlenecks, finance attention, and at-risk work.
- Finance work is separated into a dedicated queue with clear state buckets.
- Contractor and client portals each present simplified, role-safe views rather than exposing internal operational tooling directly.

### Weaknesses

- Dashboard queue sections are capped to 8 items per section, which is workable for summary but weak as a primary operational control surface when queues grow (`src/modules/dashboard/server/build-dashboard.ts:330-370`, `374-405`, `472-479`).
- Queue sections route into other screens rather than supporting inline triage, ownership, bulk review, or fast next-action handling.
- Internal work is split across `Dashboard`, `Work Orders`, `Intake`, and `Finance` without a single operator workbench. Navigation is broad but flat (`src/lib/navigation/nav-config.ts:27-98`).
- Work-order detail is a composite page, but not an operational command center. It includes overview, quote, finance, assignment, notes, and attachments, but no integrated activity timeline or communications feed (`src/components/work-orders/work-order-detail-page.tsx:582-740`).

Assessment:

- Good for overview and low-volume handling.
- Not yet strong enough for sustained queue-based coordination work.

## 3. Intake review UX assessment

The intake backend is richer than the intake UI.

The intake route supports filtering by review status, source type, assigned reviewer, urgency, lifecycle recommendation, sort mode, and confidence range (`src/app/(app)/dashboard/intake/page.tsx:21-52`). The page itself only exposes three status chips and reset (`src/components/intake/intake-review-page.tsx:149-166`).

The queue cards show summary, confidence, duplicate risk, duplicate count, and urgency, but they do not show assigned reviewer, escalation state, age, decision recency, or lifecycle recommendation even though those are present in the data model (`src/components/intake/intake-review-page.tsx:169-199`).

The reviewer action area is also manual-heavy:

- assignment requires selecting a reviewer and saving separately
- review start is a separate action
- decision actions are detached from duplicate resolution context
- merge requires typing a merge target ID manually (`src/components/intake/intake-review-page.tsx:254-347`, `398-419`)

Most importantly, duplicate review is not rendering the full comparison context already loaded by the service. The service fetches duplicate candidate timelines, communication timelines, and attachments (`src/server/services/intake-service.ts:842-873`), but the UI shows only summary metadata plus merge/false-positive actions (`src/components/intake/intake-review-page.tsx:369-419`).

Assessment:

- Human review authority is preserved correctly.
- Reviewer throughput is constrained by missing queue controls and a weak duplicate comparison experience.
- The UI will likely create hesitation and re-checking behavior for high-volume intake teams.

## 4. Communication/timeline UX assessment

### Internal experience

Internal communication and timeline rendering is the weakest operational area.

The intake detail page includes a simple timeline list, but it is not merged with evidence, duplicate context, or communication context in a way that helps reviewers reconstruct what happened (`src/components/intake/intake-review-page.tsx:211-251`, `350-367`).

The main internal work-order detail page does not render a canonical timeline or communications panel at all, despite those being core coordination artifacts (`src/components/work-orders/work-order-detail-page.tsx:582-740`).

This forces internal operators to infer state from status, notes, attachments, assignment history, quote panels, and finance panels rather than reading one operational history stream.

### Client portal

The client portal detail page does at least show communications, but it renders them as plain message body plus timestamp and actor (`src/app/(client)/portal/work-orders/[workOrderId]/page.tsx:62-80`). It does not expose communication type, subject, attachments, thread grouping, or a clearer distinction between updates, approvals, and conversational messages.

The client portal status display also uses raw lifecycle values (`src/app/(client)/portal/work-orders/[workOrderId]/page.tsx:84-103`), which is operationally accurate but not user-friendly.

### Contractor portal

The contractor portal is actually stronger than the internal work-order detail for activity context. It shows both communications and a contractor-visible timeline (`src/app/(contractor)/contractor/work-orders/[workOrderId]/page.tsx:120-162`). However, rendering is still flat and text-based, without grouping by milestone, highlighting blockers, or showing the next required action in the timeline itself.

Assessment:

- Internal timeline usability: low
- External timeline usability: medium
- Communication clarity: medium for simple cases, low for complex threaded coordination

## 5. Operational friction findings

### High impact

1. Intake queue exposes only a small subset of supported filters.
The route supports operational filters and sorting that the page does not surface, which forces URL hacks or future API-only usage instead of in-page triage (`src/app/(app)/dashboard/intake/page.tsx:21-52`, `src/components/intake/intake-review-page.tsx:149-166`).

2. Duplicate merge review is underpowered.
The service loads candidate work-order timelines, communications, and attachments, but the reviewer cannot see that comparison in the UI before deciding (`src/server/services/intake-service.ts:842-873`, `src/components/intake/intake-review-page.tsx:369-419`).

3. Internal work-order detail lacks a canonical timeline and communication feed.
This fragments operational understanding across notes, attachments, assignment history, quote workflow, and finance state (`src/components/work-orders/work-order-detail-page.tsx:582-740`).

4. Client portal uses non-canonical status options in its filter UI.
The client portal filter offers values like `in_review`, `quote_requested`, `pending_client_approval`, `approved_to_proceed`, and `completed` (`src/app/(client)/portal/work-orders/page.tsx:59-68`), while server filtering compares directly against canonical lifecycle statuses (`src/modules/clients/server/client-portal.ts:145-147`) and the canonical statuses are different (`src/modules/work-orders/domain/lifecycle.ts:1-20`). This creates a real ambiguity and likely broken or empty-filter behavior.

### Medium impact

5. Dashboard queues are summary slices, not operational backlogs.
Each section truncates to 8 items, which hides queue depth and encourages operators to bounce between screens (`src/modules/dashboard/server/build-dashboard.ts:334-370`, `398`, `476-479`).

6. Finance queue actions are single-record and detail-oriented rather than throughput-oriented.
The page is good for inspection, but there is no bulk aging view, grouped collections workflow, or fast finance decision pattern (`src/components/invoices/finance-queue-page.tsx:45-80`, `src/components/invoices/finance-queue-table.tsx:50-177`).

7. Assignment workflow is form-heavy and buried in detail view.
Changing owners, dispatching contractors, setting dates/windows, and completing actions all happen inside one long panel rather than a clearer staged dispatch flow (`src/components/work-orders/assignment-panel.tsx:101-327`).

8. Escalations are visible as alerts, but not made structurally prominent inside the owning workflow screen.
Operational alerts exist (`src/components/shared/notifications/operational-alerts-panel.tsx:17-69`), but the work-order detail and intake detail do not appear to elevate escalation reason, age, and handoff responsibility as first-class banners.

## 6. Cognitive load findings

The main cognitive load issue is fragmentation rather than density.

Operators have to mentally join:

- queue summary
- work-order detail
- assignment state
- quote state
- finance state
- notes
- attachments
- alerts
- intake review detail

This is manageable for a few records, but poor for real coordination throughput.

Specific load drivers:

- raw lifecycle labels instead of role-specific “what needs to happen next”
- separate surfaces for queue review and action completion
- manual merge target entry in intake
- missing side-by-side duplicate context
- multiple internal pages with different queue logic
- inconsistent depth across internal vs external experiences

The client and contractor portals are cognitively simpler, but sometimes too simple. They hide nuance that would help counterparties understand blockers or required responses.

## 7. Reviewer throughput assessment

Reviewer throughput is likely the weakest operational dimension today.

### Intake reviewers

Throughput risks:

- limited filter controls
- no batch review model
- no quick next/previous flow
- no comparison-optimized duplicate review
- no visible reviewer load balancing
- no explicit SLA aging indicators in the queue

Expected result:

- acceptable for low daily intake volume
- poor for sustained duplicate-heavy intake operations

### Coordinators

Coordinators can complete work, but they must navigate between dashboard, work-order detail, quote area, and finance area. The lack of one integrated activity/timeline view lowers confidence and increases re-checking.

### Finance reviewers

Finance throughput is better than intake throughput because the queue is tabular and state-bucketed. Still, it is optimized for record-by-record handling rather than collections operations, exception processing, or fast overdue follow-up.

## 8. Scalability assessment

The current UX scales functionally, but not operationally.

### What scales reasonably

- role separation
- canonical queue construction
- portal safety boundaries
- tabular finance review
- contractor self-service for basic assignment and quote actions

### What does not scale well

- intake reviewer throughput
- duplicate resolution confidence
- queue depth visibility
- escalation handling inside the primary workflow screens
- internal timeline reconstruction
- operational discoverability across many active records

At larger volumes, teams would likely compensate by moving coordination into Slack, email, or side spreadsheets because the product does not yet provide a single authoritative action surface for high-frequency coordination work.

## 9. Recommended UX/operational improvements

### Priority 1

1. Turn intake into a true reviewer workbench.
Add in-page controls for reviewer, escalation state, source type, urgency, lifecycle suggestion, confidence range, and sort mode. Add queue aging, SLA indicators, reviewer ownership, and next/previous navigation.

2. Replace manual duplicate review with side-by-side comparison UX.
Render the candidate work order timeline, communication history, and attachments already loaded by the service. Replace “merge target work order id” text entry with selectable candidates and explicit merge rationale capture.

3. Add a canonical internal timeline + communications panel to the work-order detail page.
This should become the primary operational history surface for coordinators and reviewers, instead of forcing them to infer state from scattered modules.

4. Fix client portal lifecycle vocabulary.
Use canonical lifecycle statuses or a deliberate mapped client-safe vocabulary, but do not mix obsolete labels in the filter UI with canonical filtering on the server (`src/app/(client)/portal/work-orders/page.tsx`, `src/modules/clients/server/client-portal.ts`, `src/modules/work-orders/domain/lifecycle.ts`).

### Priority 2

5. Promote queue depth and overflow visibility.
Dashboard summary cards are useful, but queue sections should show “view all”, queue counts by state, and aging distributions so teams can see backlog shape, not just top items.

6. Add fast-path operational actions in queues.
Examples:
- assign reviewer from intake queue row
- mark false positive from duplicate candidate list
- assign contractor from dispatch queue
- send reminder / open quote review from quote bottleneck queue
- create invoice directly from finance queue row

7. Make escalation first-class in page-level UX.
Show escalation banner, owner, reason, due time, and required resolution action on intake and work-order detail pages, not only in general alert cards.

8. Reframe assignment UX around staged decisions.
Separate internal ownership, dispatch planning, active assignment response, and completion handling into clearer subflows with visible state transitions and next-action prompts.

### Priority 3

9. Improve communication rendering across portals and internal views.
Add message type, subject, channel, attachments, and grouped thread presentation. Distinguish operational updates from conversational messages.

10. Normalize timeline storytelling across all roles.
Use milestone-based rendering with expandable detail so operators, clients, and contractors all see a coherent history tuned to their permissions.

11. Add throughput-oriented finance patterns.
Introduce grouped views for ready-to-bill, overdue, and paid-closeout work; allow bulk export or operator batch actions where appropriate.

12. Add cross-surface discoverability cues.
Use consistent badges, next-action summaries, and links between intake, work order, finance, and alert surfaces so operators always know where the authoritative next step lives.

## Summary

The platform already has the canonical operational data needed for stronger UX. The main gap is not missing workflow logic; it is missing operational presentation and action design.

Today’s UX is credible for early usage and low queue volume. It is not yet optimized for real coordination teams handling sustained intake, duplicate review, escalations, and multi-role handoffs. The biggest improvements should focus on:

- intake reviewer throughput
- duplicate comparison UX
- internal timeline/communications visibility
- canonical lifecycle clarity across portals
- queue depth and escalation discoverability
