# Canonical Architecture Integrity Audit

Date: 2026-05-07
Scope: lifecycle runtime, persistence/runtime boundaries, event architecture, timeline architecture, communication architecture, intake architecture, provider boundaries, review/conversion boundaries, workflow integrations, authorization/runtime enforcement, portal projections, repository patterns, service mutation paths
Method: static code audit only; no code changes

## 1. Canonical architecture assessment

The platform still has a recognizable canonical operational architecture, but it is not fully intact.

The strongest canonical spine is:

- lifecycle vocabulary centralized in [`src/modules/work-orders/domain/lifecycle.ts`](../../src/modules/work-orders/domain/lifecycle.ts) and re-exported through [`src/server/services/status-rules.ts`](../../src/server/services/status-rules.ts)
- service composition centralized in [`src/server/services/index.ts`](../../src/server/services/index.ts)
- durable domain events centralized in [`src/server/services/domain-event-service.ts`](../../src/server/services/domain-event-service.ts)
- background execution centralized in the runtime queue, lease, dead-letter, and subscriber stack under `src/modules/runtime/*`
- intake conversion routed through human review into `workOrders.create`, not through provider or AI direct mutation

However, the integrity of that architecture is weakened by five material drift patterns:

1. Some authoritative work-order mutations bypass authorization at the route boundary.
2. Multiple services mutate `workOrders` directly instead of routing all work-order changes through one canonical work-order domain service.
3. Provider receipt processing has two enqueue paths for the same job.
4. Legacy work-order notes and attachments still exist as a parallel persistence/projection path.
5. Authorization still spans two policy stacks: the newer server-side surface and an older `src/lib/*` transition/permission surface.

Assessment: partially canonical, with moderate-to-high drift risk and two high-severity control gaps.

## 2. Runtime authority map

Canonical runtime substrate:

- Queue authority: `runtimeJobs`, `runtimeDeadLetters`, `runtimeEventProcessings` via [`src/modules/runtime/server/worker-runtime-service.ts`](../../src/modules/runtime/server/worker-runtime-service.ts)
- Lease authority: [`src/modules/runtime/server/worker-lease-service.ts`](../../src/modules/runtime/server/worker-lease-service.ts)
- Event-to-job conversion: [`src/modules/runtime/server/event-subscriber-service.ts`](../../src/modules/runtime/server/event-subscriber-service.ts), [`src/modules/runtime/server/event-to-job-service.ts`](../../src/modules/runtime/server/event-to-job-service.ts), [`src/modules/runtime/server/event-subscriber-registry.ts`](../../src/modules/runtime/server/event-subscriber-registry.ts)
- Worker execution: [`src/modules/runtime/server/worker-runner-service.ts`](../../src/modules/runtime/server/worker-runner-service.ts)

Runtime execution surfaces currently present:

- manual operator event processing: [`src/app/api/runtime/operator/events/process/route.ts`](../../src/app/api/runtime/operator/events/process/route.ts)
- manual operator job processing: [`src/app/api/runtime/operator/jobs/process/route.ts`](../../src/app/api/runtime/operator/jobs/process/route.ts)
- loop-based execution orchestration: [`src/modules/runtime-loops/server/runtime-loop-runtime.ts`](../../src/modules/runtime-loops/server/runtime-loop-runtime.ts)
- scheduler-driven enqueueing: [`src/modules/scheduler/server/runtime-scheduler-service.ts`](../../src/modules/scheduler/server/runtime-scheduler-service.ts)

Assessment:

- These are not separate authoritative runtimes; they operate over the same queue and lease substrate.
- This is acceptable architecture as long as the single queue/lease/dead-letter model remains authoritative.
- The provider webhook route is the main exception because it performs direct enqueue work outside the canonical event-subscriber path.

## 3. Persistence authority map

Current authority by artifact:

- `workOrders`: primarily `work-order-service`, but also directly mutated by `quote-workflow-service`, `invoice-service`, and `assignment-service`
- `clientQuotes` and `contractorQuotes`: `quote-workflow-service`
- `clientInvoices`: `invoice-service`
- `assignments`: `assignment-service`
- `domainEvents`, `transitionEvents`, `transitionAudits`: `domain-event-service`
- `communicationThreads`, `communicationMessages`, `communicationAttachments`, `communicationLinks`, `communicationParticipants`: `communication-service` and provider intake internals in `intake-service`
- `intakeEvents`, `intakeArtifacts`, `aiIntakeDrafts`, `intakeDecisions`, `intakeApprovals`: `intake-service`
- provider sync and ingestion records: `provider-service`
- provider delivery/webhook receipts: `modules/provider-runtime/*`
- runtime jobs and dead letters: `modules/runtime/*`

Assessment:

- Persistence authority is clear for most bounded contexts.
- `workOrders` is the main integrity problem because it has multiple direct mutators.
- work-order notes and attachments remain fragmented across legacy subcollection repositories and canonical communication records.

## 4. Event/timeline authority map

Canonical event authority:

- all domain events flow through [`src/server/services/domain-event-service.ts`](../../src/server/services/domain-event-service.ts)
- work-order timeline is derived from `domainEvents` through [`src/server/services/timeline-service.ts`](../../src/server/services/timeline-service.ts)
- communication timeline is separately derived from immutable communication messages via [`src/server/services/communication-service.ts`](../../src/server/services/communication-service.ts)

Strengths:

- one canonical domain-event recorder
- durable event subscriber registry for runtime fan-out
- explicit event-driven downstream flow for SLA, escalation, delivery, transport, and provider receipt reconciliation in [`src/modules/runtime/server/event-subscriber-registry.ts`](../../src/modules/runtime/server/event-subscriber-registry.ts)

Weaknesses:

- transition writes are intentionally triplicated into `domainEvents`, `transitionEvents`, and `transitionAudits`; this is acceptable only because one service owns all three writes
- notes and attachments still partially sit outside the canonical communication timeline, so work-order history is not fully consolidated

## 5. Communication/intake authority map

Communication authority:

- first-class records live in `communicationThreads`, `communicationMessages`, `communicationAttachments`, `communicationLinks`, `communicationParticipants`
- creation is canonical through [`src/server/services/communication-service.ts`](../../src/server/services/communication-service.ts)

Intake authority:

- provider ingestion normalizes into intake events, immutable artifacts, communication records, provider receipts, and thread mappings in [`src/server/services/intake-service.ts`](../../src/server/services/intake-service.ts)
- review is explicitly human-gated before conversion:
  - start review rejects `system` actors at lines 497-499 in [`src/server/services/intake-service.ts`](../../src/server/services/intake-service.ts)
  - assignment rejects `system` actors at lines 550-552
  - conversion to a work order happens through `workOrders.create` at lines 1220-1236

Assessment:

- no evidence of direct AI to work-order mutation
- no evidence of provider payloads directly mutating work orders
- intake and communications are largely aligned with the intended canonical design
- legacy note and attachment repositories still undermine full consolidation

## 6. Architectural drift findings

### Finding A: Route-level authorization drift on work-order mutations

Severity: High

The routes below invoke authoritative work-order mutations without calling the existing authorization helpers:

- [`src/app/api/work-orders/[workOrderId]/route.ts:27`](../../src/app/api/work-orders/[workOrderId]/route.ts:27) calls `context.services.workOrders.update(...)`
- [`src/app/api/work-orders/[workOrderId]/assign-internal/route.ts:15`](../../src/app/api/work-orders/[workOrderId]/assign-internal/route.ts:15) calls `context.services.workOrders.update(...)`
- [`src/app/api/work-orders/[workOrderId]/status/route.ts:15`](../../src/app/api/work-orders/[workOrderId]/status/route.ts:15) calls `context.services.workOrders.transition(...)`

The work-order service itself validates lifecycle and data integrity but does not enforce actor permissions before saving at:

- update save: [`src/server/services/work-order-service.ts:413`](../../src/server/services/work-order-service.ts:413)
- assign internal save: [`src/server/services/work-order-service.ts:456`](../../src/server/services/work-order-service.ts:456)
- transition save: [`src/server/services/work-order-service.ts:639`](../../src/server/services/work-order-service.ts:639)

This creates an unauthorized mutation path whenever a caller can reach the route.

### Finding B: Work-order authority is split across multiple services

Severity: High

The canonical work-order entity is directly mutated outside `work-order-service`:

- quote workflow updates quote pointer and lifecycle in [`src/server/services/quote-workflow-service.ts:693`](../../src/server/services/quote-workflow-service.ts:693) and [`src/server/services/quote-workflow-service.ts:714`](../../src/server/services/quote-workflow-service.ts:714)
- assignment workflow updates contractor snapshot and lifecycle in [`src/server/services/assignment-service.ts:604`](../../src/server/services/assignment-service.ts:604)
- invoice workflow updates invoice pointer and lifecycle in [`src/server/services/invoice-service.ts:338`](../../src/server/services/invoice-service.ts:338), [`src/server/services/invoice-service.ts:765`](../../src/server/services/invoice-service.ts:765), [`src/server/services/invoice-service.ts:785`](../../src/server/services/invoice-service.ts:785), and [`src/server/services/invoice-service.ts:809`](../../src/server/services/invoice-service.ts:809)

This is the clearest violation of a single canonical mutation path for work orders.

### Finding C: Authorization policy is still split between old and new stacks

Severity: Medium

The server authorization entry point still exports both newer server-layer policies and the older `src/lib/*` permission/transition stack:

- transitional note in [`src/server/authorization/index.ts`](../../src/server/authorization/index.ts)
- server evaluator delegates into [`src/lib/authorization.ts:1`](../../src/lib/authorization.ts:1)
- older transition helper explicitly marks itself legacy in [`src/lib/status-transitions.ts:23`](../../src/lib/status-transitions.ts:23)
- a separate newer work-order permission surface exists in [`src/server/authorization/work-order.permissions.ts:1`](../../src/server/authorization/work-order.permissions.ts:1)

This is not yet a direct mutation bug by itself, but it is clear architectural split-brain.

### Finding D: Legacy note and attachment persistence paths remain live

Severity: Medium

Work-order runtime APIs still use legacy attachment and note repositories:

- attachment listing and creation use `attachmentRepository` in [`src/server/api/work-order-runtime.ts:170`](../../src/server/api/work-order-runtime.ts:170) and [`src/server/api/work-order-runtime.ts:183`](../../src/server/api/work-order-runtime.ts:183)
- attachment repository persists directly to legacy subcollections in [`src/lib/repositories/work-order-attachment.repository.ts:47`](../../src/lib/repositories/work-order-attachment.repository.ts:47)
- note reads merge canonical and legacy data in [`src/server/api/work-order-runtime.ts:503`](../../src/server/api/work-order-runtime.ts:503)

This leaves a transitional dual-write/dual-read model in place.

### Finding E: Provider receipt processing has duplicate enqueue paths

Severity: Medium

Webhook receipt ingestion records `provider_receipt_recorded` events in [`src/modules/provider-runtime/server/provider-webhook-runtime.ts:154`](../../src/modules/provider-runtime/server/provider-webhook-runtime.ts:154), and the runtime subscriber registry already maps that event to `provider.receipt.process` in [`src/modules/runtime/server/event-subscriber-registry.ts:250`](../../src/modules/runtime/server/event-subscriber-registry.ts:250).

But the webhook route also directly enqueues the same `provider.receipt.process` job in [`src/app/api/provider-runtime/webhooks/microsoft/route.ts:41`](../../src/app/api/provider-runtime/webhooks/microsoft/route.ts:41).

The idempotency key prevents duplicate execution, but the architecture now has two enqueue authorities for the same work.

## 7. Hidden coupling findings

- `quote-workflow-service`, `invoice-service`, and `assignment-service` all encode work-order state side effects internally instead of publishing an intent to a single work-order authority.
- manual attachment creation writes a legacy attachment record, then separately creates a communication attachment record and then separately records a domain event in [`src/server/api/work-order-runtime.ts:197`](../../src/server/api/work-order-runtime.ts:197) through [`src/server/api/work-order-runtime.ts:237`](../../src/server/api/work-order-runtime.ts:237); this is hidden coupling and a non-transactional dual-write.
- provider webhook handling is coupled directly to runtime enqueueing in the route instead of relying solely on the durable-event subscriber boundary.

## 8. Unauthorized mutation path findings

### Confirmed

- work-order `PATCH` route lacks explicit edit authorization before mutation
- work-order status `PATCH` route lacks explicit transition authorization before mutation
- internal assignment update route lacks explicit edit authorization before mutation

### Contributing factor

- `work-order-service` trusts callers for authorization and only enforces lifecycle/data rules

### Additional concern

- provider webhook route is externally callable, creates services without authenticated context, accepts organization id from header/body, and falls back to `"org-1"` if absent in [`src/app/api/provider-runtime/webhooks/microsoft/route.ts:18`](../../src/app/api/provider-runtime/webhooks/microsoft/route.ts:18)

This is an especially serious provider-boundary control gap even though it does not directly mutate work orders.

## 9. Duplicate runtime findings

### Not a true duplicate runtime

- operator processing routes, loop runtime, scheduler, and worker runner all share the same queue and lease substrate
- claim/lease semantics remain canonical in [`src/modules/runtime/server/worker-lease-service.ts`](../../src/modules/runtime/server/worker-lease-service.ts)

### Real duplicate runtime behavior

- provider receipt reconciliation job creation exists both as:
  - durable event subscriber logic
  - direct webhook-route enqueue logic

This is duplicate runtime initiation, not duplicate execution authority.

## 10. Remaining transitional/legacy debt

- `src/lib/workflows/*` and `src/lib/status-transitions.ts` remain in the tree and still influence live authorization logic
- `src/server/authorization/index.ts` explicitly acknowledges a transition state
- legacy work-order note repository still exists and legacy note reads are still merged into API responses
- legacy work-order attachment repository still exists and remains the primary API read/write path for manual attachments
- unused or low-usage work-order service methods such as `assignContractor`, `assignInternalStaff`, and `addNote` still represent parallel mutation vocabulary compared with active assignment/communication services

## 11. Architectural risk assessment

Overall risk: High

Risk drivers:

- High likelihood of authorization regression because route and service responsibilities are inconsistent
- High likelihood of work-order state drift because multiple services mutate the same aggregate directly
- Moderate likelihood of historical/projection inconsistency because notes and attachments are split across legacy and canonical stores
- Moderate likelihood of operational confusion because provider receipt processing has two enqueue paths
- Moderate likelihood of future regressions because the old `src/lib/*` workflow/authorization stack is still partially live

What is still solid:

- canonical lifecycle vocabulary itself
- domain event recording surface
- runtime queue/lease/dead-letter substrate
- human-gated intake review and conversion boundary
- no observed direct provider-to-work-order or AI-to-work-order mutation path

## 12. Recommended corrective actions

1. Make server-side authorization mandatory inside authoritative mutation services, starting with `work-order-service`, so route omissions cannot create mutation bypasses.
2. Immediately patch the three exposed work-order mutation routes to call the existing authorization helpers before invoking service methods.
3. Collapse all direct `workOrders.save(...)` calls outside `work-order-service` into explicit work-order domain commands or a single work-order aggregate service.
4. Remove the webhook-route direct enqueue for `provider.receipt.process` and rely only on the `provider_receipt_recorded` durable event subscriber.
5. Lock down the Microsoft webhook route so organization scope is derived from trusted provider connection resolution, not caller-controlled header/body values, and remove the `"org-1"` fallback entirely.
6. Choose one authorization system. Prefer the server authorization surface, then retire `src/lib/status-transitions.ts` and live `src/lib/workflows/*` authorization dependencies.
7. Delete the legacy work-order notes and attachments repositories after migrating reads and writes fully to canonical communication records.
8. Consolidate work-order timeline rendering so communication-derived notes and attachments come from one canonical store and do not require legacy merge logic.
9. Treat unused work-order service mutation methods as transitional debt and remove or fold them into the canonical bounded contexts in the same pass.
10. Add architecture tests that fail if:
   - a route mutates `workOrders` without authorization
   - a service outside the canonical work-order authority writes `repositories.workOrders.save`
   - provider receipt jobs are enqueued anywhere except the canonical subscriber path
   - legacy note/attachment repositories are referenced by live runtime routes

## Conclusion

The platform has not fully regressed into architectural chaos, but it has re-accumulated enough parallel authority that the "one canonical operational architecture" claim is no longer strictly true.

The highest-priority corrections are:

- close the work-order authorization bypasses
- restore one canonical work-order mutation authority
- remove the duplicate provider receipt enqueue path
- finish deleting the legacy note/attachment persistence path
