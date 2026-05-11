# Security & Multi-Tenant Isolation Audit

Date: 2026-05-07

Scope reviewed:

- authorization runtime
- visibility services
- communication visibility
- intake visibility
- provider visibility
- portal projections
- event/timeline filtering
- attachment access
- diagnostics APIs
- repository query patterns
- tenant scoping
- organization scoping
- actor attribution
- internal/admin API protections

## 1. Security architecture assessment

The core security architecture is directionally strong, but it is not enforced consistently at the API and runtime projection layer.

What is solid:

- The canonical actor model is explicit and tenant-scoped in `src/types/auth.ts` and is built centrally in `src/server/api/work-orders.ts:145-185`.
- The primary authorization layer in `src/lib/access-policy.ts:1272-1390` correctly models tenant, client-organization, location, and contractor-assignment scope.
- Communication visibility and domain-event visibility both have dedicated server-side filters in `src/modules/communications/domain/types.ts:211-236` and `src/server/services/domain-event-service.ts:221-314`.
- Operational diagnostics and replay routes are generally protected through `getRuntimeApiContext()` / `getProviderRuntimeApiContext()` and `authorizeOperationalRuntimeAccess()` in `src/server/api/provider-runtime.ts:11-35`.

What breaks the model:

- Several high-risk APIs bypass the authorization helpers that already exist.
- Shared runtime serializers return internal fields to external actors instead of using portal-safe projections.
- Some reads are scoped only to `organizationId`, not to the caller’s client, location, or contractor boundary.
- One provider webhook endpoint trusts caller-supplied tenant identity and accepts unauthenticated ingestion requests.

Overall assessment:

- Canonical design: good.
- Enforcement consistency: poor.
- Current security posture: not tenant-safe enough for broad external exposure until the bypasses below are fixed.

## 2. Tenant isolation assessment

The repository and policy foundations are tenant-aware, but tenant isolation is not consistently enforced at every entrypoint.

Strengths:

- Tenant checks are built into the access-policy layer for internal, client, and contractor actors.
- Runtime and provider diagnostics APIs consistently pass `organizationId: context.actor.scope.organizationId` into service calls.
- Provider diagnostics, replay, and connection reads are organization-scoped once the request reaches the authenticated admin runtime APIs.

Findings:

- `POST /api/provider-runtime/webhooks/microsoft` is unauthenticated and accepts `organizationId` from `x-organization-id`, request payload, or a hard-coded fallback of `"org-1"` in `src/app/api/provider-runtime/webhooks/microsoft/route.ts:18-31`.
- That same webhook route immediately enqueues canonical runtime work under the supplied organization in `src/app/api/provider-runtime/webhooks/microsoft/route.ts:41-58`.
- This is the most serious cross-tenant isolation gap in the current audit because an external caller can select the target tenant boundary without an authenticated server-side tenant binding.

Assessment:

- Internal authenticated runtime surfaces are mostly tenant-scoped correctly.
- External provider ingress is not tenant-safe in its current form.

## 3. Portal visibility assessment

Portal-safe projection intent exists, but the shared work-order runtime API bypasses it.

Evidence of intended safe design:

- `src/modules/work-orders/client-portal.ts` defines a client-safe detail projection.
- `src/tests/client-portal-foundation.test.mts:55-64` explicitly asserts that client work-order projections omit `notes` and `attachments`.

Current runtime/API behavior:

- `GET /api/work-orders` uses `serializeWorkOrderListItem()` and spreads the full work-order record for every actor in `src/server/api/work-order-runtime.ts:341-353`.
- `GET /api/work-orders/[workOrderId]` uses `serializeWorkOrderDetail()` and returns shared runtime detail to all readable actors in `src/server/api/work-order-runtime.ts:269-339`.
- That detail includes:
  - `notes`
  - `attachments`
  - `requestedByEmail`
  - `requestedByPhone`
  - `internalAssignees`
  - internal lifecycle and staffing metadata

Impact:

- Client and contractor portals can receive data the codebase’s own portal projection tests say should be omitted.
- This is a client visibility leak and a contractor visibility leak, not just a stylistic inconsistency.

Additional portal leak:

- `GET /api/client-organizations/[clientOrganizationId]` returns `safeClientDetail(...)` in `src/app/api/client-organizations/[clientOrganizationId]/route.ts:19-34`.
- `safeClientDetail()` includes `notes` and `recordStatus` in `src/server/api/business-entities.ts:439-451`.
- Client users authorized to read their own client organization therefore receive internal client-organization notes and record-state metadata.

Assessment:

- Portal-safe projections exist but are not the canonical read path.
- External-facing shared runtime APIs are currently overexposing internal data.

## 4. Communication/intake visibility assessment

The communication and intake visibility model is better than the portal/runtime projection layer, but there are still role-boundary gaps.

Strengths:

- Communication visibility is actor-aware in `src/modules/communications/domain/types.ts:211-236`.
- Timeline filtering respects event visibility in `src/server/services/domain-event-service.ts:221-314`.
- Intake review routes correctly block non-internal actors through `requireVisibleReviewEvent()` / `requireVisibleReviewDraft()`.

Findings:

- Intake review access is granted to any internal actor in `src/server/services/intake-service.ts:715-840`; there is no role-based restriction beyond “internal”.
- That means finance admins can read review queue entries, linked communication messages, evidence, and intake attachments even though the provider/runtime admin surface separately models a more privileged operations boundary.
- `getReviewContext()` loads linked communication directly in `src/server/services/intake-service.ts:795-808`.
- `getEvidence()` returns raw linked communication messages and attachments in `src/server/services/intake-service.ts:820-839`.

Assessment:

- No direct client/contractor intake exposure was found.
- Internal least-privilege is too broad around intake review and evidence visibility.

## 5. Attachment security assessment

Attachment security is currently one of the weakest areas.

High-severity findings:

- `listRuntimeWorkOrderAttachments()` returns all work-order attachments to any actor who can read the work order in `src/server/api/work-order-runtime.ts:170-180`.
- `accessRuntimeWorkOrderAttachmentContent()` issues a signed download URL to any actor who can read the work order in `src/server/api/work-order-runtime.ts:249-266`.
- The same attachment flow records communication attachments and domain events as `internal` only in `src/server/api/work-order-runtime.ts:205-237`, but the separate work-order attachment API does not enforce any comparable visibility filter.

Metadata leakage:

- `serializeAttachments()` returns `storagePath`, uploader identity, and `accessPath` for every attachment in `src/server/api/work-order-runtime.ts:545-567`.

Related visibility issue:

- `serializeWorkOrderDetail()` always embeds attachments in the work-order response in `src/server/api/work-order-runtime.ts:317-318`.

Impact:

- Client users and assigned contractor users can read and download internal-only work-order attachments.
- Internal attachment visibility recorded in communications/events is not honored by the attachment read surface.

Assessment:

- Attachment read protection is not aligned with attachment classification.
- This is a concrete attachment leakage issue, not a theoretical one.

## 6. Diagnostics/API assessment

Diagnostics hardening is mixed: most authenticated runtime diagnostics are good, but one external provider ingress and several operational mutation APIs are not.

What is hardened:

- Runtime diagnostics and replay APIs consistently require internal manager, finance admin, or owner access through `authorizeOperationalRuntimeAccess()` in `src/server/api/provider-runtime.ts:23-35`.
- Services for runtime jobs, dead letters, subscribers, replay summaries, provider diagnostics, and sync runs are generally called with the authenticated actor’s organization id.

What is not hardened:

- `POST /api/provider-runtime/webhooks/microsoft` is unauthenticated and tenant-selectable by caller input.
- `PATCH /api/work-orders/[workOrderId]` does not call `authorizeWorkOrderEdit()` before mutating in `src/app/api/work-orders/[workOrderId]/route.ts:27-47`.
- `PATCH /api/work-orders/[workOrderId]/status` does not call `authorizeWorkOrderTransition()` before mutating in `src/app/api/work-orders/[workOrderId]/status/route.ts:15-35`.
- `POST /api/work-orders/[workOrderId]/assign-internal` does not require an internal actor or any work-order edit authorization in `src/app/api/work-orders/[workOrderId]/assign-internal/route.ts:15-35`.
- The work-order service methods those routes call do not enforce actor authorization internally:
  - update: `src/server/services/work-order-service.ts:353-424`
  - assign internal staff: `src/server/services/work-order-service.ts:426-456`
  - transition: `src/server/services/work-order-service.ts:557-670`

Impact:

- Any authenticated actor able to reach those routes can attempt direct work-order mutation without the canonical route-level authorization checks.
- Because the service layer does not re-check permissions, this is an authorization bypass, not just a missing defense-in-depth layer.

Assessment:

- Diagnostics reads are mostly hardened.
- Several operational write APIs are not.

## 7. Event visibility assessment

Event visibility itself is mostly implemented correctly, but it is undermined by side-channel APIs that bypass the same visibility rules.

Strengths:

- `DomainEventService.listTimelineForWorkOrder()` and `.listTimelineForEntity()` filter through `canActorReadVisibility()` in `src/server/services/domain-event-service.ts:204-314`.
- Communication timeline reads filter through `canActorReadCommunicationVisibility()` in `src/server/services/communication-service.ts` and `src/modules/communications/domain/types.ts:211-236`.

Findings:

- Internal notes bypass communication visibility when exposed through the work-order runtime serializer:
  - `listCanonicalAndLegacyNotes()` always pulls `listInternalNotesForWorkOrder()` in `src/server/api/work-order-runtime.ts:503-524`.
  - The work-order detail response always includes `notes` in `src/server/api/work-order-runtime.ts:317`.
- Attachment visibility bypasses event visibility entirely because the work-order attachment API does not consult communication visibility or domain-event visibility before returning metadata or download access.
- The event/timeline surfaces are therefore more restrictive than the sibling note and attachment endpoints, which creates inconsistent visibility guarantees for the same operational record set.

Assessment:

- Timeline filtering is mostly sound.
- Visibility consistency across adjacent APIs is not sound.

## 8. Remaining security risks

Highest risk:

- Unauthenticated provider webhook can target arbitrary organizations and enqueue canonical runtime work.
- Work-order mutation routes bypass edit/transition authorization and rely on service methods that do not enforce actor permissions.
- External users can read internal work-order notes and attachments through shared runtime work-order APIs.
- External users can retrieve contact details by id with only organization-level checks.

Medium risk:

- Client organization detail leaks internal `notes` and `recordStatus` to client users.
- Shared work-order list/detail serializers expose internal assignee identity and broader work-order fields to external actors.
- Intake review is internal-only but not role-restricted, so finance admins can see provider/intake evidence that should likely remain operations-scoped.
- Runtime/provider diagnostics role gating currently treats `finance_admin` as an operational runtime admin in `src/server/api/provider-runtime.ts:28-34`, which is broader than least privilege.

Lower but notable architectural risk:

- Repository methods are intentionally broad and depend on service/API callers to add scope filters. That pattern is workable, but the current bugs show it is easy to bypass accidentally.

## 9. Recommended corrective actions

1. Lock down provider ingress first.
   Remove caller-supplied `organizationId` from `POST /api/provider-runtime/webhooks/microsoft`, bind the webhook to a canonical provider connection lookup, validate provider authenticity, and remove the `"org-1"` fallback entirely.

2. Make authorization mandatory inside canonical work-order mutation services.
   `work-order-service.update`, `assignInternalStaff`, and `transition` should enforce canonical actor authorization directly so routes cannot bypass it.

3. Repair the route-level work-order mutation guards immediately.
   Add `authorizeWorkOrderEdit()` / `authorizeWorkOrderTransition()` or equivalent canonical checks to:
   - `src/app/api/work-orders/[workOrderId]/route.ts`
   - `src/app/api/work-orders/[workOrderId]/status/route.ts`
   - `src/app/api/work-orders/[workOrderId]/assign-internal/route.ts`

4. Split internal runtime serializers from external portal projections.
   Stop using `serializeWorkOrderListItem()` and `serializeWorkOrderDetail()` as shared external responses. Route client and contractor reads through dedicated portal-safe projection modules.

5. Enforce attachment visibility explicitly.
   Add attachment-level visibility checks before listing metadata or issuing download URLs, and do not expose `storagePath` to external actors.

6. Stop exposing internal notes to external actors.
   Gate `listCanonicalAndLegacyNotes()` by actor type/visibility and keep internal-note delivery aligned with communication visibility rules.

7. Fix contact visibility by binding ids to scope.
   External contact reads must be resolved through linked client/location/contractor scope, not by raw `contactId` plus `organizationId`. Also prevent `ids=<single-id>` from returning `toContactDetail()` for external actors.

8. Redact client-organization detail for client actors.
   Introduce a client-safe projection equivalent to `safeLocationDetailForActor()` and remove `notes` / `recordStatus` from external responses.

9. Narrow intake and provider operational roles.
   Require an explicit operations/admin capability for intake review, provider diagnostics, and provider replay instead of allowing all internal users or all finance admins by default.

10. Add regression tests for every fixed boundary.
   Add API tests covering:
   - external denial for work-order update/status/assign-internal
   - external denial for internal notes and internal attachments
   - external denial for cross-scope contact ids
   - denial of unauthenticated provider webhook mutation attempts
   - client-safe and contractor-safe work-order projections

## Conclusion

The codebase already has a credible canonical authorization and visibility model, but several real-world APIs bypass it in ways that create tenant-boundary, portal-visibility, attachment, and mutation-control failures. The highest-priority fixes are the unauthenticated provider webhook, the missing work-order mutation authorization checks, and the external exposure of internal notes and attachments.
