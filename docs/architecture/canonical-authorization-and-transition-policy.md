# Canonical Authorization And Transition Policy

Date: 2026-05-07
Phase: 3 Authorization Consolidation
Scope: authoritative `workOrders` mutation enforcement

## 1. Canonical actor context model

Authoritative work-order mutations now require `WorkOrderMutationContext`.

Required fields:

- `organizationId`
- `actor`
- `source`

Supported actor shapes:

- Human actor: canonical `AccessActor`
  - `actorType`
  - `userId`
  - `role`
  - persisted scope
- System actor: trusted explicit runtime actor
  - `actorType = "system"`
  - `role = "system"`
  - `scope.kind = "system"`
  - `scope.trusted = true`

Optional audit/correlation fields:

- `requestId`
- `now`
- `correlationId`
- `causationId`
- `sourceEventId`

Supported mutation sources:

- `work_order_api`
- `assignment_workflow`
- `quote_workflow`
- `invoice_workflow`
- `intake_review`
- `system_runtime`

## 2. Human actor vs system actor rules

- Human actors must carry canonical persisted organization scope.
- External actors are allowed only on explicitly approved workflow paths.
- System actors are fail-closed by default.
- Direct `WorkOrderService` create, edit, note, assignment, and transition calls do not allow system actors.
- A system actor is valid only when explicit, trusted, and routed through an approved source.
- Missing actor, missing organization scope, invalid source, or untrusted system scope are all authorization failures.

## 3. Service-layer enforcement rule

`WorkOrderService` is the canonical enforcement point for authoritative `workOrders` mutations.

This means:

- actor context is validated before mutation
- tenant scope is validated before mutation
- workflow source is validated before mutation
- lifecycle permission is validated before mutation
- workflow-specific mutations are restricted to their canonical source
- route guards are no longer the sole protection layer
- adjacent services cannot bypass service-layer authorization by calling canonical mutation methods without actor context

## 4. Route guards as defense-in-depth

Routes still construct actor context from persisted auth state and may perform early guards, but they are no longer authoritative.

Routes must:

- derive role and scope from persisted auth/session state
- never trust caller-supplied role or org values
- pass canonical actor context into services
- avoid direct repository writes
- treat route-level permission checks as early denial only, not authoritative enforcement

## 5. Lifecycle transition permission matrix

Direct work-order transitions:

- internal actors only
- enforced through canonical status policy plus `WorkOrderService.transition(...)`

Workflow-driven transitions:

- assignment workflow
  - `client_approved -> assigned`
  - internal assignment-capable actor required
- quote workflow
  - contractor: `quote_required -> contractor_quote_received`
  - manager/owner: `contractor_quote_received -> quote_under_review`
  - manager/owner: `quote_under_review -> client_approval_requested`
  - client/manager/owner: `client_approval_requested -> client_approved`
  - client/manager/owner: `client_approval_requested -> quote_required`
- invoice workflow
  - finance/owner: `work_completed | completion_review | ready_for_invoicing -> invoiced`
  - finance/owner: `invoiced -> paid`
  - finance/owner: `invoiced -> ready_for_invoicing` on controlled void rollback

All canonical transitions also require:

- current work order tenant to match actor tenant scope
- source workflow to match the allowed mutation source
- audit metadata sufficient to attribute the mutation

## 6. Assignment workflow authority

- `assignment-service.ts` may validate assignment aggregate rules
- authoritative work-order mutation still routes through `applyContractorAssignment(...)`
- direct work-order repository writes remain disallowed outside `WorkOrderService`
- assignment workflow cannot drive unrelated quote, client approval, or finance transitions

Removed legacy behavior:

- assignment-side work-order authorization as the only protection layer

## 7. Quote workflow authority

- `quote-workflow-service.ts` may validate quote aggregate rules
- authoritative work-order pointer and lifecycle changes route through:
  - `applyQuoteWorkflowPointer(...)`
  - `applyQuoteWorkflowTransition(...)`
- quote workflow cannot drive finance-only or generic direct transitions

Removed legacy behavior:

- quote workflow deciding final work-order authority without canonical service enforcement

## 8. Invoice workflow authority

- `invoice-service.ts` may validate invoice aggregate rules
- authoritative work-order pointer and lifecycle changes route through:
  - `applyInvoiceWorkflowPointer(...)`
  - `applyInvoiceWorkflowTransition(...)`
- invoice workflow cannot drive quote, assignment, or generic direct transitions

Removed legacy behavior:

- finance workflow mutating work-order lifecycle without canonical service-layer actor checks

## 9. Intake conversion authority

- intake review remains an aggregate-specific review flow
- authoritative work-order creation now requires explicit `source = "intake_review"`
- intake conversion cannot bypass canonical work-order create authorization and tenant validation
- intake conversion is not authorized to use direct transition or workflow mutation paths unrelated to creation

## 10. Denial-path testing strategy

Regression coverage now includes:

- missing actor context denied
- invalid organization context denied
- client blocked from internal-only direct transitions
- contractor blocked from client approval transition path
- coordinator blocked from finance-only invoice transition path
- untrusted system actor denied
- approved external actor allowed only on canonical workflow transition path

## 11. Removed flows and canonical replacements

Removed effective behavior:

- route-only authorization as the final protection layer
- thin `userId`/`role` audit envelopes as sufficient mutation authority
- assign-internal route using broad `update(...)`
- actorless workflow-originated work-order mutations
- legacy verification scenarios that modeled duplicate lifecycle vocabulary like separate `awaiting_quote` and `approved_to_proceed` runtime states

Canonical replacements:

- `WorkOrderMutationContext`
- `WorkOrderService` authorization enforcement
- source-aware workflow mutation methods
- verification scenarios aligned to current canonical lifecycle states

## 12. Remaining known risks

- Event replay/runtime behavior still has at least one unrelated failing suite and was not refactored in this phase.
- Domain events still store a normalized event actor view and do not yet persist the full mutation context payload.
- System/runtime authorization is explicit now, but broader worker/runtime governance hardening remains for later phases.

## 13. Relationship to later phases

- Phase 4 Atomic Idempotency
  - applies to runtime replay/idempotent mutation guarantees
- Phase 5 Atomic Event/Outbox Persistence
  - applies to durable multi-write persistence boundaries
- Phase 7 Subscriber Productionization
  - applies to durable subscriber execution/runtime hardening
- Phase 10 AI Governance
  - depends on canonical persisted actor-scoped operational artifacts, not route projections or unmanaged text
