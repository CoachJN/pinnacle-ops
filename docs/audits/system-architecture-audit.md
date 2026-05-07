# System Architecture Audit

Date: 2026-05-06

## 1. Current architecture summary

The Work Order Platform is a Next.js App Router application with a fairly strong separation between route wiring, reusable UI, server orchestration, and Firestore persistence. The intended target architecture is clear:

- `src/app` owns routes, layouts, and thin page/route wiring.
- `src/components` owns UI composition.
- `src/server` owns runtime auth, API helpers, services, and Firestore-backed repositories.
- `src/modules` is the preferred long-term home for feature-owned domain logic.
- `src/lib` still contains a large amount of shared domain, workflow, auth, and legacy compatibility logic.

In practice, the platform is mid-migration between older `lib`/shared-type patterns and newer feature-module + Phase 3 service patterns. The architecture is not chaotic, but it is split across two active models:

- A legacy/lowercase workflow model centered around `src/types/*`, `src/lib/access-policy.ts`, `src/lib/authorization.ts`, `src/server/services/status-rules.ts`, and `src/server/services/work-order-service.ts`.
- A newer Phase 3 model centered around `src/modules/work-orders`, `src/server/services/work-order-core/*`, `src/server/api/work-order-core.ts`, and the lifecycle/transition engine under `src/lib/workflows/*`.

The result is a codebase with real platform depth, but without a fully unified canonical domain model yet.

## 2. Existing major modules/features

### Application and route structure

- Route groups are well organized into `(public)`, `(app)`, `(client)`, and `(contractor)`.
- Internal authenticated surfaces exist for dashboard, work orders, finance, client organizations, locations, contacts, and contractors.
- Separate client and contractor portal surfaces exist and are not mixed into the internal shell.
- API routes are concentrated under `src/app/api/*` and are generally thin wrappers over `src/server/api/*`.

### Server services and repositories

- Firestore is the active persistence layer through `src/server/repositories/firestore/*`.
- Repository contracts are explicit and normalized around top-level collections for work orders, assignments, quotes, invoices, contacts, organizations, locations, activity logs, and internal notifications.
- Core server services exist for work orders, assignments, quotes, invoices, contacts, locations, contractors, notifications, activity logging, and dashboard visibility.
- The newer `work-order-core` service set is decomposed into focused use cases rather than one large god service.

### Domain and workflow modules

- `src/modules/work-orders` contains explicit schemas, constants, transitions, assignment rules, and domain DTOs.
- `src/modules/notifications`, `src/modules/contractors`, `src/modules/dashboard`, and `src/modules/finance` contain meaningful domain logic, not just UI helpers.
- `src/lib/workflows/*` contains substantial platform infrastructure:
  - lifecycle definitions
  - transition engine
  - RBAC-aware transition authorization
  - audit event builders
  - orchestration rules
  - SLA timer creation/evaluation
  - reaction handlers
  - optimization/insight primitives
  - verification scenarios

### Authentication and RBAC

- Firebase Auth session handling exists, including session-cookie creation and current-user resolution.
- App user profile enrichment is server-side and loads role/org scope from Firestore.
- Runtime authorization is centralized behind `src/server/authorization/*`, even though some underlying policy logic still lives in `src/lib`.
- Role vocabulary covers internal, client, and contractor actors.
- Work-order-specific permission helpers support org, client, location, and contractor scoped access.

### Audit/activity and notifications

- Work-order activity logging is implemented as a service and persisted to Firestore.
- Security/authorization audit event structures exist.
- Internal notification and operational alert feed primitives exist and are wired to Firestore-backed notifications.

### Testing coverage

- The repo has strong unit/service/domain coverage for architecture-heavy areas, with 30+ test files across:
  - authorization
  - work-order services
  - quote/invoice services
  - transition engine/service
  - orchestration
  - workflow execution
  - operational alerts
  - platform hardening
  - client/contractor portal logic
- There are some integration API tests, especially around location, client organization, and contact-linking flows.

## 3. Missing or incomplete areas

### Canonical domain unification

The biggest missing piece is a single canonical domain model. Work orders, statuses, and transitions are still represented in multiple active forms:

- lowercase legacy statuses in `src/types/work-order.ts`
- uppercase Phase 3 statuses in `src/modules/work-orders`
- lifecycle-engine statuses in `src/lib/workflows/lifecycle/*`

This is the main blocker for safe expansion into automation, AI intake, and analytics.

### Quote runtime unification

Quote behavior is materially incomplete at the platform layer:

- Runtime quote persistence is split between contractor quotes and client quotes.
- `src/lib/workflows/transition-service/apply-quote-transition.ts` explicitly reports the runtime path as unsupported.
- That means the transition engine is not yet a clean end-to-end source of truth for quote workflows.

### SLA automation runtime

SLA and scheduled workflow execution primitives exist, but the operational runtime is incomplete:

- SLA timers, claiming, retries, and batch processing are implemented as library functions.
- There is no clearly established scheduler/worker boundary, job runner entrypoint, or operational ownership pattern in the app surface.
- This makes the platform “automation capable” in design, but not fully productionized for autonomous execution.

### Communications and omnichannel intake

The codebase does not yet show a durable communications architecture for:

- inbound email/SMS/chat intake
- threaded conversation storage
- communication event correlation to work orders
- outbound delivery tracking
- consent/preferences beyond core contact fields

Internal notifications exist, but that is not the same as a communications platform.

### AI intake and intelligence layer

There is no clear bounded context yet for:

- AI-assisted intake parsing
- triage classification
- confidence/review queues
- model prompt/version governance
- structured operational intelligence pipelines

There are optimization and insight primitives, but not a production intelligence subsystem.

### Persistent security audit and observability depth

- Security audit events can default to process-local storage unless a sink is configured.
- There is no obvious dedicated audit query/reporting surface.
- Observability is present as structured logging helpers, but not as a cohesive production telemetry layer with trace/correlation standards, metrics, or failure dashboards.

### Transactional integrity for cross-entity workflows

I did not find Firestore transaction or batch-write usage in the active server/workflow code. Multi-entity operations such as status changes, assignments, notifications, activity records, and related side effects appear vulnerable to partial-write failure unless each service explicitly compensates for it.

### End-to-end coverage

The test suite is strong at the service/domain level, but there is limited evidence of:

- full authenticated route/API integration against Firestore
- cross-module end-to-end workflow regression
- background execution/runtime tests
- portal-to-core workflow contract tests

## 4. Duplicated/deprecated/legacy patterns

### Active duplicate architectural paths

- `src/server/authorization/*` is the intended runtime boundary, but it still delegates into `src/lib/authorization.ts` and `src/lib/access-policy.ts`.
- Work-order lifecycle logic exists in at least three places:
  - `src/server/services/status-rules.ts`
  - `src/modules/work-orders/domain/transitions.ts`
  - `src/lib/workflows/lifecycle/work-order-transitions.ts`
- Work-order types exist both in `src/types/work-order.ts` and `src/modules/work-orders/domain/types.ts`.
- Firestore persistence abstractions exist in both:
  - `src/server/repositories/firestore/*`
  - older `src/lib/repositories/*`

### Bridge and compatibility code

- `src/modules/clients/server/client-portal.ts` bridges a legacy work-order service call and a newer detail service call in the same request path.
- `src/app/api/_utils/phase-two.ts` and several docs/tests still explicitly reference earlier phase-era compatibility.
- The repository still carries evidence of removed legacy surfaces, and the test suite includes hardening checks to ensure some older route paths stay removed.

### Data model drift

- Firestore collection naming includes both `clientQuotes` and `quotes`, which suggests ongoing migration or queue compatibility concerns.
- Work-order/quote/invoice lifecycle terminology is more mature than the runtime write path that currently enforces it.

## 5. Architecture risks

1. Canonical-model drift
   Multiple status vocabularies and type systems create a real risk of contradictory behavior between UI gating, service rules, transition engines, and reporting.

2. Automation on unstable workflow foundations
   Expanding into SLA automation or AI-triggered actions before unifying work-order and quote state models will amplify hidden inconsistencies.

3. Partial-write and side-effect integrity risk
   Without explicit transactional patterns, cross-entity workflow operations can leave work orders, assignments, activity logs, and notifications out of sync during failures.

4. Authorization fragmentation
   Authorization is conceptually centralized, but active logic still spans `src/server`, `src/lib`, and type-driven permission helpers. That increases the chance of drift between route enforcement and domain workflow enforcement.

5. Portal/core divergence
   Client and contractor portal paths are real products now, but parts of their data shaping still depend on bridge code rather than a single portal-facing application service contract.

6. Auditability gap for enterprise expansion
   Activity logs exist, but enterprise-grade immutable audit, compliance-friendly event querying, and security event persistence are not yet clearly complete.

7. Analytics and intelligence reliability risk
   Operational intelligence built on top of mixed statuses and partially unified lifecycle models would produce noisy or misleading metrics.

## 6. Expansion readiness score

**6/10**

Why not lower:

- The codebase already has strong service/repository separation.
- Firestore persistence is normalized rather than ad hoc.
- Auth/RBAC, workflows, notifications, portals, and finance primitives are all meaningfully present.
- The test suite covers a lot of the hard domain logic.

Why not higher:

- The platform is still carrying multiple live domain models.
- Quote transition architecture is not fully operationalized.
- Automation runtime and transactional safety are not yet fully stabilized.
- Observability and audit persistence are not yet mature enough for heavy autonomous expansion.

## 7. Required stabilization work before new expansion

1. Choose and enforce one canonical work-order, quote, and invoice lifecycle model.
   All route handlers, services, portals, workflows, analytics, and RBAC checks should resolve through the same status vocabulary and transition source of truth.

2. Finish the migration from legacy `src/types` and `src/lib` ownership to module/server ownership.
   Especially for work orders, quotes, permissions, and persistence contracts.

3. Unify quote runtime architecture.
   Decide whether contractor quote and client quote remain distinct bounded entities or become a coordinated aggregate with one transition authority. Then finish the runtime transition path.

4. Establish transaction/consistency patterns for multi-entity workflows.
   Define when Firestore transactions are required, when idempotent side effects are required, and how retries/compensation are handled.

5. Promote workflow execution into an operational subsystem.
   Add clear scheduler/worker entrypoints, ownership, monitoring, dead-letter handling, retry visibility, and operational runbooks.

6. Harden audit and observability.
   Persist security audit events durably, standardize correlation IDs, expose audit query/reporting paths, and define service-level metrics/logging expectations.

7. Create a canonical application-service layer for client and contractor portals.
   Portals should not need to compose legacy and new services together to render core workflow detail.

8. Define extension boundaries for communications and AI.
   Add clear domain seams for intake events, communication threads, automation commands, AI suggestions, and human approval checkpoints before implementing those features.

## 8. Recommended next build phases

### Phase A: Domain consolidation

- Canonicalize lifecycle/status models.
- Collapse duplicate work-order and authorization pathways.
- Retire legacy repository/service/type surfaces that are still active.

### Phase B: Workflow runtime hardening

- Complete quote transition runtime support.
- Add transactional/idempotent workflow guarantees.
- Productionize scheduled workflow execution and SLA handling.

### Phase C: Audit, observability, and reporting foundation

- Durable security audit persistence.
- Correlation and tracing standards.
- Trusted operational reporting model built on canonical statuses.

### Phase D: Communications platform

- Message/thread domain model
- inbound/outbound event ingestion
- delivery state tracking
- communication-to-work-order linkage
- notification preference and consent handling

### Phase E: AI-assisted intake and automation

- intake normalization pipeline
- classification/summarization suggestions
- review queue and confidence gating
- human approval workflow
- audit trail for AI-generated actions

### Phase F: Operational intelligence

- SLA breach analytics
- queue health and bottleneck reporting
- contractor performance insights
- forecasting/recommendations built on stabilized workflow data

## Bottom line

The platform already has enough architecture to justify expansion, but not enough canonical consistency to expand safely at high speed. The immediate priority should be stabilization around one lifecycle model, one authorization path, one persistence strategy, and one workflow runtime contract before layering on communications, AI intake, or intelligence-heavy automation.
