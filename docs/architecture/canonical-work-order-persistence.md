# Canonical Work Order Persistence

Date: 2026-05-06

## 1. Canonical persistence model

The canonical persisted work-order lifecycle field is `lifecycleStatus`.

Canonical runtime/persistence work orders now center on the Firestore repository model in:

- `src/server/repositories/firestore/models.ts`
- `src/server/repositories/firestore/mappers.ts`
- `src/server/repositories/firestore/repositories.ts`

The canonical operational model includes:

- Core identity and ownership scope from audit fields plus `clientOrganizationId`, `locationId`, and `createdByUserId`
- Lifecycle state through `lifecycleStatus`
- Summary workflow fields through `assignmentStatus`, `quoteSummaryStatus`, `invoiceSummaryStatus`, and `approvalStatus`
- Ownership fields through assigned internal/contractor/finance/reviewer references
- Linked records through `currentQuoteId` and `currentInvoiceId`
- Operational metadata through activity, next-action, escalation, hold, and resume context
- Canonical lifecycle timestamps for intake, triage, assignment, quote, approval, execution, invoicing, payment, closeout, hold, escalation, and cancellation

## 2. `lifecycleStatus` migration summary

- Firestore work-order documents now serialize the canonical lifecycle field as `lifecycleStatus`
- Work-order services, runtime projections, finance queue shaping, client portal shaping, contractor portal shaping, and dashboard shaping now read canonical lifecycle data from `lifecycleStatus`
- Runtime read filters now accept `lifecycleStatus`, with `status` only tolerated at the query-string boundary while consumers move to the canonical parameter

## 3. Repository normalization summary

- The server Firestore repository is the canonical work-order persistence repository
- Canonical work-order list/detail reads now flow through `context.repositories.workOrders` and `context.services.workOrders`
- Firestore mapping owns timestamp serialization/deserialization for the canonical work-order lifecycle metadata
- Contractor organization linkage now reads canonical `assignedContractorOrgId`

## 4. Removed bridge/runtime aggregation paths

- `src/server/api/work-order-runtime.ts` no longer reads work orders through `src/lib/repositories/work-order.repository.ts`
- `src/modules/clients/server/client-portal.ts` no longer falls back to the legacy module work-order repository for detail hydration

## 5. Canonical projection architecture

- Canonical work-order persistence is read through the server repository/service stack
- Runtime detail projections assemble notes, attachments, assignments, related entities, and action availability around the canonical work-order record
- Finance, client portal, contractor portal, and dashboard projections all derive lifecycle display state from the same canonical field

## 6. Portal/dashboard projection strategy

- Client portal summary/detail projections consume canonical work-order lifecycle state from `lifecycleStatus`
- Contractor portal list/detail projections consume canonical work-order lifecycle state from `lifecycleStatus`
- Dashboard queue and finance queue shaping consume canonical lifecycle state from `lifecycleStatus`

## 7. Remaining persistence debt

- Some internal TypeScript surfaces still retain temporary compatibility fields while repo-wide lifecycle consumers finish moving off legacy property names
- Work-order notes and attachments still live in the older module-side repository helpers and should be folded behind canonical work-order query services in a follow-up pass

## 8. Future event architecture integration points

- Lifecycle transition events should be emitted from the canonical work-order service/repository path only
- Future orchestration/event persistence should attach to canonical work-order ids, `lifecycleStatus`, and lifecycle timestamps instead of maintaining parallel status vocabularies

## 9. Future communications integration points

- Communication timelines should reference canonical work-order ids and lifecycle timestamps
- Customer/contractor messaging triggers should derive from canonical lifecycle and summary fields rather than local portal-specific status interpretation
