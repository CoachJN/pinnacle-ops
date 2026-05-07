# Data Entity Standards

This document is the single source of truth for persistent entity structure across Pinnacle Ops.

## 1. Global Entity Standards

- Every persistent entity must have one primary key named `id`.
- Use globally unique string IDs. UUIDs are the default strategy for all system primary keys.
- Use UTC datetime values for all persisted timestamps.
- Separate business data from lifecycle metadata.
- Keep entity boundaries explicit. Each table should represent one domain concept.
- Prefer explicit columns for operational data. Do not hide core workflow fields in flexible metadata blobs.
- Support future extensibility with additive columns and optional metadata fields, not schema rewrites.
- Use soft deletion for operational entities unless a table is clearly ephemeral.
- Keep ownership explicit so authorization, reporting, and retention rules remain clear.

## 2. Required Base Fields

All persistent entities should include these fields unless a documented exception is approved:

- `id`
- `organization_id`
- `created_at`
- `updated_at`
- `created_by_user_id`
- `updated_by_user_id`
- `record_status`
- `is_deleted`
- `deleted_at`
- `deleted_by_user_id`

Notes:

- `created_at` is immutable after insert.
- `updated_at` changes on every persisted mutation.
- `record_status` describes the record lifecycle, not business workflow state.
- `deleted_at` and `deleted_by_user_id` are nullable until soft deletion occurs.

Optional but encouraged where useful:

- `display_code` for human-readable identifiers
- `version` for optimistic concurrency on high-churn records

## 3. Relationship Rules

- Every foreign key column must use the `<entity>_id` naming pattern.
- Use real foreign keys for persistent relationships unless there is a deliberate archival exception.
- Each entity must have one clear ownership boundary:
  - tenant-owned by `organization_id`
  - parent-owned by a containing business entity
  - reference-only to another entity without lifecycle inheritance
- Many-to-many relationships must use explicit join tables.
- Do not encode relationships as arrays of IDs in a single column.
- Cross-organization references are not allowed unless intentionally designed and documented.
- Avoid hard-delete cascades for operational records. Prefer restrict or soft-delete behavior.
- Until a database schema exists, core create/update paths must use the shared relationship-integrity validator before persisting related records.

## 4. Status Handling Rules

- Status values must be controlled and finite.
- Store status as stable machine-readable codes, for example `draft` or `in_progress`.
- Do not use free-text status fields.
- Keep independent state dimensions separate:
  - `status` for workflow
  - `priority` for urgency
  - `approval_status` for approval flow
  - `record_status` for record lifecycle
- Track important business transitions with dedicated timestamps such as `submitted_at` or `completed_at`.
- Null is not a valid business status.

## 5. Audit Rules

- All business entities must capture creator, last updater, and timestamps through base fields.
- Soft deletion must capture who deleted the record and when.
- Workflow-critical changes should be historically traceable through append-only audit records or equivalent event history.
- Audit records should capture:
  - entity type
  - entity ID
  - action
  - actor
  - timestamp
  - before and after values for critical fields when practical
- Comments and notes are not substitutes for audit history.
- `Comment` is human-entered communication or note content attached to a
  parent business record; it is not an activity log or workflow status history.
- `Attachment` is a file reference attached to a parent business record; it is
  not comment content, audit history, or file storage/persistence behavior.
- System-initiated changes must identify a system actor distinctly from a human user.

## 6. Current Application Guidance

- `WorkOrder` remains the primary workflow entity and should inherit the global base fields through shared types.
- Every `WorkOrder` must belong to one `ClientOrganization` and one `Location`.
- Every `Location` must belong to one `ClientOrganization`.
- `Assignment` is a separate operational entity and should not be collapsed into `WorkOrder`.
- Every `Assignment` must belong to one `WorkOrder` and one `ContractorOrganization`.
- `ContractorQuote`, `ClientQuote`, and `Invoice` are distinct entities with separate status models and timestamps.
- Every `ContractorQuote` must belong to one `WorkOrder` and one `ContractorOrganization`.
- Every `ClientQuote` must belong to one `WorkOrder`.
- When present, `ClientQuote.contractorQuoteId` must reference a `ContractorQuote`
  in the same tenant and for the same `WorkOrder`.
- Every `ClientInvoice` must belong to one `WorkOrder`, one `ClientOrganization`,
  and one `Location`.
- `ClientInvoice` is the canonical receivables entity and may store explicit
  external accounting sync identifiers when an integration requires them.
- `ContractorInvoice` is a distinct canonical payables entity and must remain
  separate from `ClientInvoice` even when future accounting integrations are added.
- `Comment` and `Attachment` records must use shared visibility tagging and
  keep parent business record references explicit for future RBAC enforcement.
- Work order workflow status remains separate from `record_status`.
- New entity types should adopt these fields and rules before adding entity-specific columns.
