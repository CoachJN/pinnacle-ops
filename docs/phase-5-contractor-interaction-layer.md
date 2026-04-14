# Phase 5: Contractor Interaction Layer

Phase 5 adds contractors as assignable MVP entities and exposes a restricted contractor workspace at `/contractor/dashboard` and `/contractor/work-orders`. Internal coordinator, manager, and owner users can manage contractor records and assign active contractors to non-terminal work orders. Finance/admin users can view contractor records and assignment state without changing them.

Contractor access is enforced through centralized helpers in `src/lib/permissions/contractor-permissions.ts` and contractor-facing selectors in `src/lib/contractors/projections.ts`. The selectors only return assigned work orders for the current contractor id and intentionally omit internal notes, internal review notes, client approval commentary, finance actions, invoice state, internal dashboards, and unrelated contractor jobs.

Quote submission remains subordinate to the work order. Contractors can submit quote details only when the assigned work order is in `quote_requested`; submission creates or updates the contractor-side draft and moves the work order to `quote_received` for internal review. Contractors cannot send quotes to client approval or record client decisions.

Execution status uses the Phase 5 MVP direct-completion model. Assigned contractors can move `approved_to_proceed` or `dispatched` work to `in_progress`, and can move `in_progress` work to `completed` with required completion notes. Contractors cannot close work orders.

Manual QA checklist:
- Create and edit an active contractor as coordinator/manager/owner; confirm finance/admin sees read-only contractor details.
- Assign an active contractor from an internal work-order detail page; confirm inactive contractors are not assignable.
- Open `/contractor/dashboard?contractorId=contractor-summit-mechanical` and confirm only assigned work appears.
- Open `/contractor/work-orders/wo-1008?contractorId=contractor-summit-mechanical` and confirm internal notes, review notes, and invoice controls are absent.
- Submit a contractor quote for `wo-1008`; confirm it moves to `quote_received` and appears in internal quote history.
- Mark an approved/dispatched assigned job in progress, then complete an in-progress assigned job with completion notes.
- Attempt `/contractor/work-orders/wo-1003?contractorId=contractor-summit-mechanical`; confirm it fails safely instead of leaking details.
