# RBAC And Security Expansion Audit

## Executive Summary

The platform has a meaningful server-side authorization foundation already in place. Authentication is centralized around Firebase session cookies, most sensitive reads and mutations pass through server-side context builders, Firestore is locked down for browser access, and the codebase has multiple authorization and projection tests for internal, client, contractor, and finance behavior.

It is not yet ready for broad expansion across internal users, client users, contractor users, communications data, AI processing, financial data, and richer portal access without additional hardening. The biggest blockers are:

- the role model is still too coarse for the future role set
- several external-scope boundaries rely heavily on mutable user-profile fields with limited defense in depth
- some portal/API endpoints leak more data than future external roles should receive
- attachment upload controls are weaker than attachment read controls
- durable security audit logging is not fully implemented
- AI and communications governance is largely absent because those features are not yet formalized

Current recommendation: safe for continued controlled internal use and limited portal use, but not yet safe for major external-role and sensitive-data expansion without a dedicated hardening phase.

## 1. Current RBAC Model

Current canonical role vocabulary is six roles defined in `src/lib/rbac/roles.ts` and `src/types/permissions.ts`:

- `owner`
- `manager`
- `coordinator`
- `finance_admin`
- `client_user`
- `contractor_user`

The platform uses:

- Firebase-authenticated session cookies in `src/lib/auth/session.ts`
- role and organization claims from the session token, with fallback to the `users` collection
- actor typing in `src/types/auth.ts`:
  - internal
  - client
  - contractor
- a permission matrix in `src/types/permissions.ts`
- tenant and scope evaluation in `src/lib/access-policy.ts`
- work-order-specific authorization helpers in `src/server/authorization/work-order.permissions.ts`

Strengths:

- internal vs external actor types are explicit
- client scope supports either all client locations or selected locations
- contractor scope is tied to a contractor organization and optionally assigned work order ids
- finance visibility is at least partially separated from operational roles

Limitations:

- `finance_admin` combines finance and admin authority into one role
- `client_user` does not distinguish head office vs store
- `contractor_user` does not distinguish contractor admin vs field technician
- `owner` is a broad override role without break-glass controls
- some authorization logic exists in multiple layers, which increases drift risk

## 2. Current Permission Enforcement Patterns

### Authentication

Authentication is cookie-based and server-side:

- session creation and verification: `src/lib/auth/session.ts`
- current-user resolution: `src/lib/auth/current-user.ts`
- server auth context: `src/server/auth/index.ts`

Notable behavior:

- role and organization can come from token claims or fallback profile data
- `getWorkOrderApiContext()` in `src/server/api/work-orders.ts` builds the authoritative actor used by most protected APIs
- if token claims contain role/org and the canonical user profile is missing, access can still succeed unless the fetched profile is explicitly marked inactive

This is a meaningful risk for future expansion because canonical account state is not enforced strongly enough at request time.

### Role and permission checks

Enforcement is mostly server-side:

- matrix-based role/entity/action checks in `src/types/permissions.ts`
- policy-based tenant and ownership checks in `src/lib/access-policy.ts`
- route/service helpers in `src/server/authorization/*`
- route handlers are generally thin and delegate to services

This is good architecture overall, but there are overlapping enforcement paths:

- `src/lib/access-policy.ts`
- `src/lib/authorization.ts`
- `src/server/authorization/work-order.permissions.ts`
- portal-specific checks in `src/modules/clients/server/client-portal.ts` and `src/modules/contractors/server/contractor-portal.ts`

That duplication raises long-term drift risk as new roles are introduced.

### Client-side route protection

Client-side protection is minimal by design, which is acceptable as long as server checks remain authoritative.

- `middleware.ts` only protects internal app paths such as `/dashboard`, `/work-orders`, `/finance`
- client and contractor portals rely on server layouts:
  - `src/app/(client)/layout.tsx`
  - `src/app/(contractor)/layout.tsx`

This means portal protection is mostly server-render/layout based rather than middleware-based. That is not a direct data-exposure flaw, but it is thinner than the internal shell path protection model.

### Firestore and storage rules

Firestore rules are fully deny-all:

- `firestore.rules`

This is safe for the current server-mediated model because the Admin SDK bypasses rules.

Storage rules are mixed:

- `storage.rules` denies reads, updates, and deletes
- attachment object creation is allowed for any authenticated user if type and size checks pass

That means attachment read control is stronger than attachment upload control.

## 3. Missing Role Boundaries

The future role set cannot be represented safely with the current six-role model.

### Internal roles

Current gaps:

- `finance_admin` conflates finance and broader admin behavior
- `owner` is both executive visibility and unrestricted override
- no distinction between operational governance and security administration

Future target roles needing explicit separation:

- Owner
- Manager
- Coordinator
- Finance/Admin

These mostly map today, but `owner` and `finance_admin` need narrower capability decomposition and explicit override logging.

### Client roles

Current gap:

- only one `client_user` role exists

Future roles not modeled today:

- Client Head Office
- Client Store

This matters because the code currently treats client access mainly as:

- one client organization id
- optionally a list of location ids

That is not enough to encode differences like:

- store-local ticket visibility
- head-office quote approval
- store-local requester contact visibility
- head-office financial visibility

### Contractor roles

Current gap:

- only one `contractor_user` role exists

Future roles not modeled today:

- Contractor Admin
- Contractor Technician

The current contractor portal exposes assignment details, location contacts, access notes, quote data, and visible activity to the single contractor role. That is too broad if technicians should see only execution details while contractor admins manage quote and commercial flows.

## 4. Tenant/Client/Contractor Scoping Risks

### Tenant scope is profile-driven

Most enforcement depends on:

- `organizationId`
- `clientOrganizationId`
- `locationIds`
- `contractorOrganizationId`

These are sourced from token claims and/or user profile documents. This is workable, but it creates a single-point-of-failure model around profile correctness.

Risk:

- there is limited defense in depth if claims or user profile bindings become stale, orphaned, or misconfigured

### Canonical active-profile enforcement is weak

`buildAccessActor()` in `src/server/api/work-orders.ts` blocks access when the fetched user profile status is `"inactive"`, but it does not require a canonical active profile row to exist if the authenticated session already contains role and organization data.

Risk:

- an account with valid role/org claims but a missing canonical profile can still authorize
- deprovisioning rigor depends too much on token/profile synchronization

### Client scoping is better than contractor scoping, but still coarse

Client scoping:

- organization id
- client organization id
- all locations or selected locations

This is a good start, but it is not enough for head-office/store separation, requester-only access, or financial segmentation within a client account.

### Contractor scope is organization-centric

Contractor access is mainly bounded by:

- `contractorOrganizationId`
- assignment linkage

Risks:

- no admin vs technician boundary
- some code paths check current assigned contractor on the work order, others derive assignment context separately
- future subcontractor or multi-team contractor structures are not yet modeled

## 5. Portal Access Risks

### Client portal data exposure is broader than future external roles should allow

Good current controls:

- client layout requires `client_user`
- client work order visibility checks client organization and allowed locations
- client projections omit work-order notes and attachments in `src/modules/work-orders/client-portal.ts`
- client location projections omit location internal notes in `src/modules/locations/client-portal.ts`

Concrete risks:

- `src/app/api/client-organizations/[clientOrganizationId]/route.ts` returns `safeClientDetail(...)`, which includes `notes` and `recordStatus`
- there is no client-safe redaction layer for client organization detail comparable to `safeLocationDetailForActor()`

Impact:

- a client user can receive internal client-organization notes and internal record-status metadata

### Contact endpoint scoping is too weak for external actors

`src/app/api/contacts/route.ts` and `src/app/api/contacts/[contactId]/route.ts` are high-risk findings.

Observed behavior:

- external actors are not fully limited to contact records attached to their own client location or contractor boundary
- `GET /api/contacts/[contactId]` only checks `organizationId`
- `GET /api/contacts?ids=<single-id>` can return full detail via `toContactDetail()`
- `toContactDetail()` includes contact `notes`

Impact:

- a client or contractor user who learns a contact id may retrieve contact details outside their intended business boundary, as long as the contact is in the same tenant organization

This is one of the clearest current external-data boundary risks in the platform.

### Portal route protection is mostly layout-based

Portal routes are not covered by the same middleware path protection used for internal app routes. Server layouts still enforce role checks, so this is not a primary authorization flaw, but it is a thinner posture operationally.

## 6. Communication Data Security Risks

The platform does not yet appear to have a full communications system for email, SMS, or chat. That reduces immediate exposure, but it also means the governance model for communications data is not ready yet.

Current related data types include:

- contacts
- work-order notes
- activity logs
- internal notifications
- quote and invoice notes

Risks:

- contact endpoint leakage described above
- no formal communication-thread domain with ownership, retention, or visibility rules
- no explicit separation between operational notes, customer-visible communications, and potentially sensitive free-text content
- no evidence of data-classification or redaction controls for communication payloads before reuse in portals or future AI systems

For future communications expansion, the current model is insufficient.

## 7. AI Data Processing Risks

I did not find a mature external AI processing pipeline in the active application code. That is positive in the short term, but it means there is also no established AI security control plane yet.

Current state:

- no clear AI consent model
- no prompt/output audit model
- no data minimization layer for sensitive records before model use
- no model/vendor segregation policy
- no human-approval workflow for AI-generated actions
- no retention or deletion rules for AI inputs/outputs

Expansion risk:

- the current domain objects contain sensitive free text, contact details, quote data, invoice data, notes, and attachments
- if AI features are added on top of current APIs without a dedicated data-sanitization layer, the platform could easily over-share confidential customer, financial, or operational data

Current conclusion:

- AI is not the current exposure point
- the platform is not yet prepared to add AI safely

## 8. Required Security Hardening

### Priority 0

1. Fix external contact access boundaries.
   Scope `GET /api/contacts` and `GET /api/contacts/[contactId]` to client-location or contractor-organization ownership, not just tenant membership.

2. Redact client-organization detail for external users.
   Introduce a client-safe projection equivalent to `safeLocationDetailForActor()` and remove internal `notes` and `recordStatus` from client-visible responses.

3. Require a canonical active user profile at authorization time.
   Do not authorize solely from token claims when the canonical profile is missing or inactive.

### Priority 1

4. Tighten attachment upload rules.
   `storage.rules` should not allow any authenticated user to upload to any work-order attachment path. Add a controlled upload pattern:
   - short-lived upload tokens or signed uploads issued by the server
   - path binding to actor scope and intended work order
   - orphan cleanup

5. Make security audit logging durable.
   Authorization audit events currently route through `defaultSecurityAuditLogger` in `src/lib/audit-log.ts`, but I did not find evidence that a persistent sink is configured. Denials, overrides, and sensitive access should be durably written.

6. Add owner override controls.
   Require explicit override reasons, durable logging, and ideally secondary review for the highest-risk actions.

### Priority 2

7. Consolidate authorization logic.
   Reduce drift by moving toward one canonical runtime authorization surface rather than parallel policy/helper stacks.

8. Add generalized mutation protections.
   I did not find evidence of a shared CSRF/anti-automation layer on normal cookie-authenticated mutation routes beyond browser cookie settings. Add explicit origin/CSRF enforcement where appropriate.

9. Introduce data classification.
   Mark fields and artifacts as internal-only, customer-visible, contractor-visible, finance-sensitive, AI-restricted, and attachment-sensitive.

10. Define retention and deletion policies for notes, activity, attachments, and future communications/AI artifacts.

## 9. Test Coverage Gaps

Existing tests are useful and meaningful:

- `src/tests/server-authorization.test.mts`
- `src/tests/work-order.permissions.test.mts`
- `src/tests/client-portal-foundation.test.mts`
- `src/tests/contractor-portal-completion.test.mts`
- `src/tests/finance-invoicing.test.mts`
- `src/tests/rbac-transition.test.mts`

These validate:

- canonical role vocabulary
- permission matrix basics
- work-order scope handling
- some client redaction behavior
- some contractor boundary behavior
- finance visibility separation

Important gaps remain:

- no tests for contact endpoint authorization across client and contractor actors
- no tests for client-organization detail redaction
- no tests for missing-profile vs inactive-profile auth behavior
- no tests for storage rule abuse or upload-path scoping
- no tests for signed attachment URL issuance and misuse cases
- no tests for durable security audit sink configuration
- no tests for owner override auditing
- no tests for future-role decomposition because those roles do not yet exist
- no tests for AI/communications governance because those systems do not yet exist

## 10. Recommended Implementation Phases

### Phase 1: Immediate external-boundary fixes

- lock down contact APIs by actor scope
- redact client-organization detail for client users
- require canonical active profile presence for all privileged access
- add regression tests for the above

### Phase 2: Attachment and audit hardening

- replace open authenticated attachment uploads with server-issued scoped uploads
- add orphaned-upload cleanup
- persist security audit events durably
- log owner and finance-sensitive overrides with explicit reasons

### Phase 3: Role-model expansion

- split current roles into:
  - Owner
  - Manager
  - Coordinator
  - Finance/Admin
  - Client Head Office
  - Client Store
  - Contractor Admin
  - Contractor Technician
- define capability matrices per role and per entity
- avoid using only location lists as the long-term client-role model

### Phase 4: Authorization consolidation

- converge duplicated permission paths into one canonical runtime evaluator
- standardize resource projections by actor type
- define reusable scope guards for client, store, contractor-admin, technician, and finance data

### Phase 5: Communications governance

- create explicit communication-thread entities and visibility rules
- separate internal notes from customer-visible communication content
- define retention, export, and audit requirements
- add tests for client/contractor communication isolation

### Phase 6: AI security control plane

- introduce AI-safe projections and redaction pipelines
- define approved use cases and disallowed data classes
- log prompts, model versions, actor, record ids, and outcomes
- require human review for sensitive or state-changing AI suggestions

## Bottom Line

The current platform shows solid security intent and better-than-average server-side authorization discipline for its stage. It can continue supporting controlled internal and limited external workflows, but it should not be treated as ready for major role expansion, broader portal exposure, communications data handling, or AI processing until the external-scope leaks, upload controls, canonical identity enforcement, and durable auditing gaps are addressed.
