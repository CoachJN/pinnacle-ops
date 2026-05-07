# Phase 11 QBO Integration Planning

## Purpose

This phase prepares the codebase for a future QuickBooks Online integration without implementing OAuth, API clients, webhooks, or sync jobs yet.

The design below is grounded in the current canonical model:

- operational workflow remains centered on `WorkOrder`
- commercial workflow remains centered on `ContractorQuote` and `ClientQuote`
- receivables workflow remains centered on `ClientInvoice`
- vendor-side payables remain represented by `ContractorInvoice` as a separate canonical concern

## Current Canonical Attachment Points

### Core entities

- `ClientOrganization` is the canonical client account entity.
- `ContractorOrganization` is the canonical contractor/vendor entity.
- `WorkOrder` owns the operational lifecycle and holds the current finance linkage through `currentInvoiceId`.
- `ClientInvoice` is the canonical customer-facing receivables record.
- `ContractorInvoice` exists in the shared type system as a distinct payables concept, but it is not yet backed by the same service/repository workflow as client invoices.

### Existing service and repository seams

- `src/server/services/invoice-service.ts` already centralizes client invoice creation, transitions, finance queue behavior, and work-order finance reactions.
- `src/server/repositories/firestore/repositories.ts` exposes `clientInvoices` as the persistence boundary for client invoice sync state.
- `src/app/api/work-orders/[workOrderId]/invoices/**` keeps route handlers thin and delegates finance behavior to services.
- `src/app/api/finance/queue/route.ts` reads queue state only and is not an integration boundary.

### Existing QBO placeholders in code

`ClientInvoice` already includes:

- `qboInvoiceId`
- `qboSyncStatus`

`InvoiceService` already includes:

- `prepareInvoiceForAccountingSync(invoiceId)`
- `markInvoiceSyncPending(...)`
- `markInvoiceSyncSuccess(...)`
- `markInvoiceSyncFailed(...)`

This is the strongest current indicator that QBO should attach to the canonical invoice workflow through `InvoiceService`, not through UI code or direct repository mutations.

## Source Of Truth Boundaries

### App-owned source of truth

The app should remain source of truth for:

- client organizations, contractors, contacts, and locations
- work orders and their lifecycle status
- quote lifecycles and approvals
- client invoice draft contents, numbering, due dates, and workflow state
- whether a work order is ready for invoicing, invoiced, paid, or closed
- finance visibility and role-based access

### QBO-owned source of truth

QBO should be treated as source of truth only for:

- the existence and identifier of the external accounting object after export
- QBO-native bookkeeping state that does not drive operational workflow directly
- externally recorded payment events once they have been reconciled into the canonical invoice workflow

### Shared-but-canonicalized boundary

Payment completion must not update canonical entities directly from QBO payloads. QBO should provide an external signal, but the app should still apply the canonical state change through service methods. In practice:

- QBO payment/import events should reconcile to a `ClientInvoice`
- reconciliation logic should then call canonical invoice transition behavior
- `WorkOrder.status` changes must continue to happen through the existing invoice-to-work-order reaction logic in `InvoiceService`

## Entity Mapping Design

### QBO customers

The canonical entity that should map to a QBO `Customer` is `ClientOrganization`.

Rationale:

- every `WorkOrder` belongs to one `ClientOrganization`
- every `ClientInvoice` belongs to one `ClientOrganization`
- billing contacts already hang off `ClientOrganization`
- customer ownership is tenant-safe and stable

`Location` should not be a standalone QBO customer. It should remain contextual invoice metadata or, later, a subordinate shipping/service address projection.

### QBO vendors

The canonical entity that should map to a QBO `Vendor` is `ContractorOrganization`.

Rationale:

- contractor commercial identity is modeled at the organization level
- billing contacts already exist on contractor records
- assignment and quote flow point back to the contractor organization

This vendor mapping should be planned now but not activated for syncing until a real contractor-invoice or vendor-bill service/repository workflow is implemented.

### Work orders

`WorkOrder` should not become an accounting master record in QBO. It should remain the operational parent record inside the app and only contribute reference metadata:

- work order number
- title/description
- client snapshot
- location snapshot

## Invoice Sync Direction And Ownership

### Client invoices

`ClientInvoice` should be the first and primary QBO sync candidate.

Recommended direction:

- app -> QBO for invoice create/update/void intent
- QBO -> app for payment/reconciliation signal

Ownership rules:

- canonical invoice content originates in the app
- the app decides when an invoice becomes externally syncable
- QBO IDs are attached only after successful export
- canonical invoice lifecycle remains in the app even after export

### Contractor invoices

Do not include `ContractorInvoice` in the first QBO implementation phase.

Reason:

- it exists in shared types and permissions, but not in a mature canonical service/repository/API workflow comparable to `ClientInvoice`
- introducing vendor-bill sync first would force QBO design onto an incomplete internal AP flow

Plan contractor-side QBO support as a later phase after the contractor invoice lifecycle is implemented canonically.

## Payment Status Handling

The app should remain the canonical owner of receivables status used by work orders:

- `ClientInvoice.status`
- `ClientInvoice.paidAt`
- `ClientInvoice.paymentReference`
- `WorkOrder.status`

Recommended behavior:

- finance users may still mark invoices paid directly in-app
- QBO payment import/webhook events may propose a payment match
- once matched, the app should transition the invoice through canonical service logic
- the work order should move to `paid` only through existing service-layer reaction logic

This avoids a split-brain model where QBO changes bypass canonical business rules.

## External ID Storage

### Existing invoice storage

Keep using `ClientInvoice.qboInvoiceId` and `ClientInvoice.qboSyncStatus` as the invoice-level summary sync fields.

For the actual implementation phase, extend invoice sync observability with additive fields such as:

- last sync attempt timestamp
- last sync success timestamp
- last sync error code/message
- sync version/hash for outbound payload comparison

### Customer and vendor mappings

Do not scatter provider IDs across unrelated UI code.

Recommended design:

- store client/customer and contractor/vendor mappings in a dedicated integration mapping entity or repository
- keep invoice-level external IDs on `ClientInvoice` because that pattern already exists canonically

Recommended future mapping fields:

- internal entity type
- internal entity id
- provider name (`qbo`)
- provider realm/company id
- external object type (`customer`, `vendor`)
- external object id
- sync metadata

This preserves clean boundaries if the platform later supports providers beyond QBO.

## Retry, Failure, And Reconciliation Strategy

### Where retry logic should live

Retry logic should live in a dedicated server-side accounting sync layer, not in route handlers, UI components, or repository classes.

Recommended placement:

- service layer under `src/server/services/` such as `accounting-sync-service` or `qbo-integration-service`
- a dedicated repository/entity for sync jobs or outbox records

`InvoiceService` should remain responsible for canonical invoice state. The future integration service should orchestrate export attempts by calling:

- `prepareInvoiceForAccountingSync`
- `markInvoiceSyncPending`
- `markInvoiceSyncSuccess`
- `markInvoiceSyncFailed`

### Failure model

Use `ClientInvoice.qboSyncStatus` as the user-visible summary state:

- `pending`
- `synced`
- `failed`

Use a dedicated job/outbox record for operational detail:

- retry count
- next retry time
- last provider response
- job type such as `invoice_export`, `invoice_void`, or `payment_import_reconcile`

### Reconciliation model

Introduce a reconciliation service for:

- invoices marked `paid` in QBO but not in the app
- invoices marked `void` or adjusted in QBO unexpectedly
- missing or duplicated external mappings
- export failures after canonical invoice transitions

Reconciliation should produce internal operational logs and, where safe, drive canonical service updates instead of direct repository writes.

## Webhook, Import, And Export Flow Recommendations

### Outbound export flow

Recommended trigger points from the current model:

- invoice sent
- invoice paid
- invoice void

The current `InvoiceService` already sets `qboSyncStatus` to `pending` on `sent`, `paid`, and `void`, which makes those the natural outbound sync boundaries.

Recommended future flow:

1. canonical invoice transition completes
2. invoice marked sync `pending`
3. integration job reads invoice via `prepareInvoiceForAccountingSync`
4. QBO export runs
5. success/failure is written back through the service layer

### Inbound webhook/import flow

Likely future inbound flows:

- payment received against exported invoice
- invoice updated or voided externally
- customer/vendor lookup refresh

Recommended route shape:

- dedicated QBO webhook endpoint under `src/app/api/`
- webhook handler verifies authenticity, performs minimal parsing, and delegates to a service
- service resolves mapping and performs reconciliation

### Manual backfill and repair flow

The implementation should also plan for an admin-triggered reconciliation/import action for:

- re-exporting failed invoices
- linking an existing QBO invoice to a canonical invoice
- rebuilding entity mappings after migration or QBO reconnect

## Permissions And Visibility Constraints

Current finance visibility should remain unchanged by QBO planning:

- finance create/edit/pay authority for client invoices remains finance-admin/owner driven
- managers and coordinators must not gain hidden billing controls because of integration work
- client users can only see the reduced invoice projection currently exposed through data visibility rules
- billing data and profitability remain restricted to finance-admin/owner

QBO webhook or background sync operations should act as a system actor and must never be used to bypass user-facing permission rules in interactive routes.

## Canonical Integration Boundaries

QBO should attach to the current architecture at these boundaries:

### Attach now

- `ClientInvoice` as the exported receivables record
- `InvoiceService` as the canonical transition and sync-state boundary
- `ClientOrganization` as the QBO customer mapping source
- `ContractorOrganization` as the planned QBO vendor mapping source

### Do not attach directly

- UI components
- finance dashboard queue builders
- route handlers beyond thin webhook delegation
- direct Firestore repository mutations from integration code
- `WorkOrder` as an external accounting master object

### Defer

- contractor invoice/vendor bill sync
- quote sync
- work order sync as a first-class external object
- direct location-to-customer mapping

## Recommended Next Implementation Phases

### Phase 12: Integration data model and connection boundary

- add canonical provider-connection and entity-mapping persistence
- decide realm/company scoping per tenant organization
- add audit-safe sync metadata fields for invoices
- add service interfaces for provider connection lookup

### Phase 13: Outbound client invoice export

- implement QBO OAuth and tenant connection management
- build service-layer export for `ClientInvoice`
- create sync job/outbox processing
- support create/update/void export using `InvoiceService` sync markers

### Phase 14: Payment reconciliation

- implement webhook intake and verification
- reconcile QBO payments to canonical `ClientInvoice`
- transition invoices through canonical service methods
- preserve work-order finance reactions

### Phase 15: Admin repair and observability

- add failed-sync queue and retry tooling
- add reconciliation reports and manual relink/re-export actions
- add activity logging and internal notifications for sync failures

### Phase 16: Contractor/vendor-side accounting

- implement canonical contractor invoice service/repository/API workflow first
- only then map `ContractorOrganization` and contractor invoices to QBO vendor/bill flows
