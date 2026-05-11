Date: 2026-05-07
Scope: authoritative `workOrders` mutation surface in `src/server/services`
Method: static code audit of direct `workOrders.create(...)` and `workOrders.save(...)` writes plus indirect creation through `WorkOrderService`

# Work-Order Authoritative Mutation Map

## 1. Quick conclusion

The current authoritative `workOrders` write surface is concentrated in four services:

1. `src/server/services/work-order-service.ts`
2. `src/server/services/assignment-service.ts`
3. `src/server/services/quote-workflow-service.ts`
4. `src/server/services/invoice-service.ts`

One additional service creates work orders indirectly through the canonical service:

1. `src/server/services/intake-service.ts`

As of this audit, there are no additional direct `workOrders.create(...)` or `workOrders.save(...)` calls elsewhere in `src/server/services`.

## 2. Canonical service inventory

### A. `work-order-service.ts`

Primary canonical work-order service. It owns:

- work-order creation
- basic field updates
- internal staff assignment
- direct contractor assignment
- direct lifecycle transitions

Direct write points:

- Create work order: [work-order-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/work-order-service.ts:321)
- Update work order fields: [work-order-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/work-order-service.ts:413)
- Assign internal staff: [work-order-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/work-order-service.ts:456)
- Assign contractor snapshot directly on work order: [work-order-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/work-order-service.ts:517)
- Touch work order on note add: [work-order-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/work-order-service.ts:543)
- Direct lifecycle transition: [work-order-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/work-order-service.ts:639)

### B. `assignment-service.ts`

Not canonical for work orders, but it still mutates them directly as an assignment side effect.

Direct write point:

- Save assignment snapshot back onto work order: [assignment-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/assignment-service.ts:616)

### C. `quote-workflow-service.ts`

Not canonical for work orders, but it mutates them directly for quote pointer and lifecycle changes.

Direct write points:

- Update `currentQuoteId`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:703)
- Update lifecycle status from quote workflow: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:724)

### D. `invoice-service.ts`

Not canonical for work orders, but it mutates them directly for invoice pointer and finance-driven lifecycle changes.

Direct write points:

- Update `currentInvoiceId` on invoice creation: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:339)
- Transition to `invoiced`: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:765)
- Transition to `paid`: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:785)
- Clear `currentInvoiceId` and optionally revert to `ready_for_invoicing` on void: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:809)

### E. `intake-service.ts`

Does not write `workOrders` directly, but it creates new work orders through the canonical service during intake conversion.

- Intake-triggered work-order creation: [intake-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/intake-service.ts:1220)

## 3. Direct status mutation map

### A. Direct lifecycle mutations in `work-order-service.ts`

- Create initializes `lifecycleStatus` and legacy `status` to `triage` or `new`: [work-order-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/work-order-service.ts:262)
- Direct contractor assignment can mutate `client_approved -> assigned`: [work-order-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/work-order-service.ts:508)
- `transition(...)` writes `lifecycleStatus = input.toStatus`: [work-order-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/work-order-service.ts:575)

### B. Direct lifecycle mutations in `assignment-service.ts`

- Assignment snapshot write can mutate `client_approved -> assigned`: [assignment-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/assignment-service.ts:625)

### C. Direct lifecycle mutations in `quote-workflow-service.ts`

- Contractor quote submitted: `-> contractor_quote_received`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:271)
- Contractor quote accepted: `-> quote_under_review`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:380)
- Contractor quote rejected: `-> quote_required`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:380)
- Client quote sent: `-> client_approval_requested`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:459)
- Client quote approved: `-> client_approved`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:537)
- Client quote rejected: `-> quote_required`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:600)

### D. Direct lifecycle mutations in `invoice-service.ts`

- Invoice sent from `work_completed | completion_review | ready_for_invoicing -> invoiced`: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:749)
- Invoice paid from `invoiced -> paid`: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:776)
- Invoice void from `invoiced -> ready_for_invoicing`: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:796)

## 4. Side-effect lifecycle writes

These are the non-canonical lifecycle writes that happen inside adjacent workflows instead of routing through `WorkOrderService.transition(...)`.

### A. Assignment side-effect lifecycle write

- `assignment-service.ts`
- Method path: `assignContractor(...) -> saveWorkOrderAssignmentSnapshot(...)`
- Write: updates `assignedContractorOrgId`, `contractorSnapshot`, `assignedAt`, and conditionally `lifecycleStatus`
- Lifecycle side effect: `client_approved -> assigned`
- Code: [assignment-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/assignment-service.ts:170), [assignment-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/assignment-service.ts:604)

### B. Quote side-effect lifecycle writes

- `quote-workflow-service.ts`
- Method path: quote actions call `updateWorkOrderStatusIfNeeded(...)`
- Write: updates `lifecycleStatus` and `lastActivityAt`
- Transition audit: records `domainEvents.recordTransition(...)` with `metadata.source = "quote_workflow"`
- Code: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:714)

### C. Invoice side-effect lifecycle writes

- `invoice-service.ts`
- Method path: `transition(...) -> applyWorkOrderReaction(...)`
- Write: updates `lifecycleStatus`, finance timestamps, and on void clears `currentInvoiceId`
- Transition audit: records `domainEvents.recordTransition(...)` with `metadata.source = "invoice_workflow"`
- Code: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:743), [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:824)

## 5. Assignment-triggered work-order mutation map

### `assignment-service.ts`

`assignContractor(...)`

- Creates assignment record: [assignment-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/assignment-service.ts:170)
- Mutates work order snapshot directly: [assignment-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/assignment-service.ts:171)
- Writes:
  - `assignedContractorOrgId`
  - `contractorSnapshot`
  - `assignedAt`
  - conditional `lifecycleStatus = "assigned"` when current state is `client_approved`

`reassignContractor(...)`

- Cancels current assignment, then calls `assignContractor(...)`: [assignment-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/assignment-service.ts:280), [assignment-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/assignment-service.ts:290)
- Work-order mutation therefore occurs through the same snapshot write path as assignment create

`updateStatus(...)`

- Does not mutate the work order directly
- Only mutates assignment state and emits events/notifications: [assignment-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/assignment-service.ts:409)

## 6. Quote-triggered work-order mutation map

### `quote-workflow-service.ts`

`submitContractorQuote(...)`

- Mutates work order lifecycle to `contractor_quote_received`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:271)

`reviewContractorQuote(...)`

- On accept, mutates work order lifecycle to `quote_under_review`
- On reject, mutates work order lifecycle to `quote_required`
- Code: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:380)

`createClientQuoteFromContractorQuote(...)`

- No lifecycle mutation by itself
- Downstream create path updates `currentQuoteId` only: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:667)

`createManualClientQuote(...)`

- No lifecycle mutation by itself
- Updates `currentQuoteId` only through shared create path: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:667)

`sendClientQuote(...)`

- Mutates work order lifecycle to `client_approval_requested`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:459)

`approveClientQuote(...)`

- Updates `currentQuoteId`
- Mutates work order lifecycle to `client_approved`
- Code: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:536), [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:537)

`rejectClientQuote(...)`

- Updates `currentQuoteId`
- Mutates work order lifecycle to `quote_required`
- Code: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:599), [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:600)

Shared quote pointer write:

- `updateWorkOrderClientQuotePointer(...)` writes `currentQuoteId`: [quote-workflow-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/quote-workflow-service.ts:693)

## 7. Invoice-triggered work-order mutation map

### `invoice-service.ts`

`createInvoiceFromWorkOrder(...)`

- Updates `currentInvoiceId`
- No lifecycle change at create time
- Code: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:338)

`transition(...)`

- Always mutates invoice state first, then may mutate the work order through `applyWorkOrderReaction(...)`: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:487)

`sendInvoice(...)`

- Via `transition(... toStatus: "sent")`
- Mutates work order to `invoiced`
- Sets `invoiceSentAt`
- Code: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:557), [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:757)

`markInvoiceViewed(...)`

- No work-order mutation

`markInvoiceOverdue(...)`

- No work-order mutation

`markInvoicePaid(...)`

- Via `transition(... toStatus: "paid")`
- Mutates work order to `paid`
- Sets `paidAt`
- Code: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:600), [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:777)

`voidInvoice(...)`

- Via `transition(... toStatus: "void")`
- Clears `currentInvoiceId`
- If work order is currently `invoiced`, mutates it back to `ready_for_invoicing`
- Code: [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:617), [invoice-service.ts](/home/craig/projects/pinnacle-ops/src/server/services/invoice-service.ts:801)

## 8. Split-authority findings

The current authoritative mutation map shows four separate services writing `workOrders` directly:

1. `work-order-service.ts`
2. `assignment-service.ts`
3. `quote-workflow-service.ts`
4. `invoice-service.ts`

The most important split-authority seams are:

1. Contractor assignment lifecycle advancement exists in both `work-order-service.assignContractor(...)` and `assignment-service.saveWorkOrderAssignmentSnapshot(...)`.
2. Quote workflow owns multiple work-order lifecycle transitions without routing through `WorkOrderService.transition(...)`.
3. Invoice workflow owns finance-driven work-order lifecycle transitions without routing through `WorkOrderService.transition(...)`.
4. Quote and invoice services also own current-pointer writes on `currentQuoteId` and `currentInvoiceId`.

## 9. Canonical recommendation

If this surface is being consolidated, the canonical target should be:

1. `WorkOrderService` as the only service allowed to mutate authoritative `workOrders`
2. assignment, quote, and invoice services publishing intent into that service rather than writing `workOrders` directly
3. one canonical lifecycle transition path for all status changes
4. one canonical pointer/snapshot mutation path for `currentQuoteId`, `currentInvoiceId`, and contractor assignment snapshots
