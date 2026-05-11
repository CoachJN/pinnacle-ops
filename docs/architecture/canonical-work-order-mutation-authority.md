Date: 2026-05-07
Phase: Phase 2
Scope: canonical authoritative `workOrders` mutation authority

# Canonical Work-Order Mutation Authority

## 1. Canonical mutation authority rule

`WorkOrderService` is the only service in `src/server/services` allowed to persist authoritative `workOrders` mutations through `workOrders.create(...)` or `workOrders.save(...)`.

Adjacent services may own their own aggregates and workflow rules, but they must express work-order mutation intent through explicit `WorkOrderService` methods.

## 2. Allowed work-order mutation surface

The canonical authoritative mutation surface is:

- `WorkOrderService.create(...)`
- `WorkOrderService.update(...)`
- `WorkOrderService.assignInternalStaff(...)`
- `WorkOrderService.assignContractor(...)`
- `WorkOrderService.addNote(...)`
- `WorkOrderService.transition(...)`
- `WorkOrderService.applyContractorAssignment(...)`
- `WorkOrderService.applyQuoteWorkflowPointer(...)`
- `WorkOrderService.applyQuoteWorkflowTransition(...)`
- `WorkOrderService.applyInvoiceWorkflowPointer(...)`
- `WorkOrderService.applyInvoiceWorkflowTransition(...)`

These methods are the only approved entry points for changing authoritative work-order fields, lifecycle state, and workflow pointers.

## 3. Disallowed direct writers

The following services must not call `repositories.workOrders.save(...)` or `repositories.workOrders.create(...)` directly:

- `src/server/services/assignment-service.ts`
- `src/server/services/quote-workflow-service.ts`
- `src/server/services/invoice-service.ts`
- `src/server/services/intake-service.ts`

`intake-service.ts` may create work orders only by calling `WorkOrderService.create(...)`.

## 4. Assignment workflow delegation model

`AssignmentService` still owns assignment aggregate creation, reassignment, and assignment status changes.

When assignment creation needs to update the authoritative work order, it delegates to:

- `WorkOrderService.applyContractorAssignment(...)`

That canonical method is responsible for:

- updating `assignedContractorOrgId`
- updating `contractorSnapshot`
- updating `assignedAt`
- conditionally advancing `client_approved -> assigned`

## 5. Quote workflow delegation model

`QuoteWorkflowService` still owns contractor quote and client quote aggregate behavior.

When quote workflow needs to mutate the authoritative work order, it delegates to:

- `WorkOrderService.applyQuoteWorkflowPointer(...)`
- `WorkOrderService.applyQuoteWorkflowTransition(...)`

This preserves quote-owned aggregate behavior while making `WorkOrderService` the only authoritative writer for:

- `currentQuoteId`
- quote-driven work-order lifecycle changes
- work-order `lastActivityAt` changes caused by lifecycle movement

## 6. Invoice workflow delegation model

`InvoiceService` still owns invoice aggregate creation and invoice status transitions.

When invoice workflow needs to mutate the authoritative work order, it delegates to:

- `WorkOrderService.applyInvoiceWorkflowPointer(...)`
- `WorkOrderService.applyInvoiceWorkflowTransition(...)`

This preserves invoice-owned aggregate behavior while making `WorkOrderService` the only authoritative writer for:

- `currentInvoiceId`
- `currentInvoiceId` clearing on void
- `invoiceSentAt`
- `paidAt`
- invoice-driven lifecycle changes including `ready_for_invoicing -> invoiced`, `invoiced -> paid`, and invoice-void reopening

## 7. Intake conversion rule

`IntakeService` is allowed to create work orders only through `WorkOrderService.create(...)`.

It may not write directly to the `workOrders` repository and may not introduce a separate authoritative creation path.

## 8. Remaining known risks

- Authorization is still split across adjacent services and `WorkOrderService`; Phase 3 consolidates canonical authorization enforcement.
- Work-order persistence and event persistence are still not atomic; Phase 5 addresses outbox/event durability.
- Quote and invoice workflows still emit domain events outside `WorkOrderService`; this is intentional for Phase 2 because the goal is authoritative mutation consolidation, not full event topology consolidation.
- Runtime subscriber hardening, replay guarantees, and worker safety remain later-phase work.

## 9. Relationship to later phases

Phase 3 authorization consolidation:

- moves mutation authorization toward the canonical work-order boundary
- removes remaining duplicated authorization decisions around workflow-originated work-order changes

Phase 5 atomic event/outbox persistence:

- makes canonical work-order mutations and event emission durable together
- eliminates partial-success risk between authoritative writes and downstream events

Phase 7 subscriber productionization:

- builds reliable subscriber/runtime behavior on top of the single canonical work-order mutation authority established here
- depends on Phase 2 so subscribers do not observe multiple competing authoritative writers
