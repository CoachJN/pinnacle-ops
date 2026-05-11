# External Boundary Lockdown

Date: 2026-05-07
Phase: 1

## 1. Provider ingress trust model

External provider ingress is fail-closed.

Canonical rules:

- provider webhooks never choose `organizationId` from request headers, body fields, or query params
- trusted tenant resolution happens only from persisted provider connection metadata
- Microsoft Graph webhooks must resolve through one active connection mapped by `metadata.webhookSubscriptionId`
- Microsoft Graph webhooks must present the configured `metadata.webhookClientState`
- if the trusted mapping is missing, disabled, ambiguous, or mismatched, ingress is rejected

Current Microsoft Graph checks:

- required notification array
- required `subscriptionId`
- required `clientState`
- active trusted connection lookup by persisted subscription mapping
- constant-time `clientState` comparison
- tenant match against `providerTenantId` when configured
- request `Date` header replay-window validation when present
- duplicate webhook/receipt deduplication through canonical idempotency keys

Removed unsafe behavior:

- caller-supplied `x-organization-id`
- request-body `organizationId`
- `"org-1"` fallback tenant authority

## 2. Tenant resolution rules

Canonical tenant authority rules:

- authenticated internal, client, and contractor users derive tenant from server session context
- provider ingress derives tenant from trusted provider connection mappings only
- runtime jobs use persisted `organizationId`, `tenantId`, `correlationId`, `causationId`, and `sourceEventId`
- unresolved tenant context is an error, not a fallback path

## 3. Visibility classification model

Canonical visibility remains role-aware and server-enforced:

- `internal`
- `client`
- `contractor`
- `finance`
- `system`

Visibility enforcement rules:

- communication messages are filtered server-side by actor visibility
- communication attachments are filtered independently from message bodies
- timeline attachment projections do not expose raw storage paths or provider attachment identifiers
- client portal work-order projections omit internal staffing and contact identifiers

## 4. Attachment visibility policy

Attachment policy is split by canonical source:

- legacy work-order attachment metadata is treated as `internal` only
- communication attachments inherit canonical communication visibility and are filtered per actor
- external responses never expose raw blob storage paths
- signed download redirects for legacy work-order attachments are restricted to internal runtime users

This phase does not add a new external download surface for communication attachments. External portals can receive safe attachment metadata only after visibility filtering.

## 5. Portal projection safety rules

Portal-safe projections must:

- be generated server-side
- omit internal-only operational metadata
- omit raw infrastructure references such as storage paths
- rely on canonical visibility services, not component-level filtering

Client portal work-order detail now excludes internal assignee ids and internal contact ids.

## 6. Replay protection strategy

Replay protection is layered:

- trusted ingress mapping blocks forged tenant selection
- request timestamp skew rejects stale webhook requests when a request timestamp is available
- webhook events dedupe by canonical idempotency key
- provider receipts dedupe by canonical idempotency key
- duplicate deliveries remain diagnosable through persisted webhook and receipt records

## 7. Runtime trust assumptions

Runtime trust is explicit:

- operational work-order runtime endpoints are internal-only
- mixed internal/external surfaces must use dedicated portal-safe projections
- authoritative work-order read authorization must use the persisted work-order tenant, never the caller tenant echoed back into policy targets

## 8. External boundary threat model

Primary threats addressed in this phase:

- forged webhook requests that attempt caller-selected tenant routing
- cross-tenant reads caused by request-scoped tenant echo bugs
- external attachment leakage through raw storage path exposure
- portal overexposure of internal staffing metadata
- visibility drift where readable messages carried unreadable attachments

Remaining limitations:

- Microsoft Graph does not currently provide platform-native HMAC webhook signing in this implementation
- request timestamp validation depends on provider-supplied request headers
- communication attachment download routes for external actors remain intentionally disabled until a canonical attachment access boundary is introduced
