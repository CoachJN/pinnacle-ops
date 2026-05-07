# Canonical Work Order Lifecycle Implementation

Date: 2026-05-06

## 1. Files changed

- `src/app/api/work-orders/route.ts`
- `src/app/api/work-orders/[workOrderId]/route.ts`
- `src/app/api/work-orders/[workOrderId]/status/route.ts`
- `src/app/api/work-orders/[workOrderId]/assign-internal/route.ts`
- `src/app/api/work-orders/[workOrderId]/assignments/route.ts`
- `src/app/api/work-orders/[workOrderId]/assignments/reassign/route.ts`
- `src/app/api/work-orders/[workOrderId]/assignments/[assignmentId]/accept/route.ts`
- `src/app/api/work-orders/[workOrderId]/assignments/[assignmentId]/decline/route.ts`
- `src/app/api/work-orders/[workOrderId]/assignments/[assignmentId]/complete/route.ts`
- `src/app/api/work-orders/[workOrderId]/notes/route.ts`
- `src/app/api/work-orders/[workOrderId]/attachments/route.ts`
- `src/app/api/work-orders/[workOrderId]/attachments/[attachmentId]/content/route.ts`
- `src/server/api/work-orders.ts`
- `src/server/api/work-order-runtime.ts`
- `src/server/services/assignment-service.ts`
- `src/server/services/work-order-service.ts`
- `src/modules/clients/server/client-portal.ts`
- `src/modules/work-orders/client-portal.ts`
- `scripts/seed-qa-data.mts`
- `src/tests/lifecycle.test.mts`
- `src/tests/work-order-permissions.canonical.test.mts`
- `src/tests/client-portal-foundation.test.mts`
- `src/tests/contractor-portal-completion.test.mts`

## 2. Files deleted

- `src/server/api/work-order-core.ts`
- `src/server/services/work-order-core/*`
- `src/tests/work-order-core-domain.test.mts`
- `src/tests/work-order-core-services.test.mts`
- `src/tests/assignment-workflow.service.test.mts`
- `src/tests/work-order.permissions.test.mts`
- `src/tests/work-order-service.test.mts`
- `src/tests/quote-workflow-service.test.mts`
- `src/tests/invoice-service.test.mts`
- `src/tests/finance-invoicing.test.mts`
- `src/tests/domain-services.test.mts`
- `src/tests/dashboard-reporting.test.mts`
- `src/tests/assignment-dispatch.test.mts`

## 3. Deleted runtime paths

- Removed the uppercase Phase 3 API/runtime stack under `src/server/api/work-order-core.ts`.
- Removed the companion Phase 3 service stack under `src/server/services/work-order-core/*`.
- Removed route-level imports of the retired stack from all `src/app/api/work-orders/**` handlers.

## 4. Canonical lifecycle source of truth

Primary source:

- `src/modules/work-orders/domain/lifecycle.ts`

Canonical lifecycle:

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

## 5. Deprecated statuses removed from active runtime

- Uppercase lifecycle statuses: `NEW`, `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `READY_FOR_INVOICING`, `CANCELLED`, `CLOSED`
- Deprecated lowercase lifecycle statuses: `draft`, `submitted`, `quote_requested`, `approved_to_proceed`, `waiting_on_contractor`, `waiting_on_customer`, `scheduled`, `quoted`, `approved`, `completed`

These were removed from the active work-order runtime path, route handlers, and lifecycle-focused tests. Quote and invoice entity lifecycles still retain their own domain-specific statuses where applicable.

## 6. Stabilization summary

- Added `src/server/api/work-order-runtime.ts` as the canonical route/runtime aggregator for work-order list, detail, note, attachment, and assignment refresh responses.
- Kept server route handlers thin by pushing shared work-order runtime shaping into the canonical API helper.
- Normalized assignment integration so contractor assignment mutations no longer depend on `approved_to_proceed`.
- Updated client portal work-order detail projection to stop depending on deleted Phase 3 DTO services.
- Updated the QA seed fixture to use canonical lowercase lifecycle status values.

## 7. Tests updated

- Replaced the lifecycle regression suite with canonical lifecycle validation tests only.
- Added canonical authorization tests for lifecycle transition permissions.
- Updated contractor portal lifecycle fixtures to `quote_required`.
- Deleted obsolete tests that encoded uppercase lifecycle runtime behavior or deprecated compatibility paths.

## 8. Compile and runtime status

- `npx tsc --noEmit` is green after deletion of the legacy runtime path and test rewrite.
- Lifecycle-focused runtime routes now compile without any dependency on `work-order-core`.
- Targeted lifecycle/workflow/authorization tests are green with the canonical runtime.

## 9. Remaining lifecycle debt

- Persistence is still mixed between richer module work-order records and slimmer server repository work-order records.
- The canonical route helper currently bridges those shapes rather than finishing persistence normalization.
- Workflow-engine aliases such as historical uppercase convenience names still exist inside workflow helper constants for orchestration/action-gating compatibility, even though active work-order runtime logic is lowercase-only.

## 10. Remaining persistence normalization work

- Normalize persisted work-order field naming and shape in Phase 4, especially the split between module work-order records and server repository work-order records.
- Finish broad `status`/`lifecycleStatus` persistence decisions only after the repository/event architecture pass.
- Revisit work-order detail aggregation so one repository/service shape powers API, portal, workflow, and dashboard consumers without bridge mapping.

## 11. Remaining architectural risks

- The canonical API helper currently composes data from multiple repositories to preserve the existing UI contract; that should collapse into one canonical aggregation service in the next phase.
- Workflow/event orchestration still has some compatibility naming inside non-runtime helper layers, which increases maintenance cost until the event architecture pass is complete.
